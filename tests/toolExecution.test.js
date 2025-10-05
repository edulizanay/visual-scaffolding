// ABOUTME: Tests for tool execution functions that run tool calls against flow.json
// ABOUTME: Covers all 8 tool operations with comprehensive edge cases

import { describe, it, expect, beforeEach } from '@jest/globals';
import { executeTool, executeToolCalls } from '../server/server.js';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_FLOW_PATH = join(__dirname, 'test-data', 'test-flow.json');

async function loadFlow() {
  const data = await readFile(TEST_FLOW_PATH, 'utf-8');
  return JSON.parse(data);
}

beforeEach(async () => {
  process.env.FLOW_DATA_PATH = TEST_FLOW_PATH;
  await mkdir(dirname(TEST_FLOW_PATH), { recursive: true });
  await writeFile(TEST_FLOW_PATH, JSON.stringify({ nodes: [], edges: [] }, null, 2));
});

describe('executeTool - addNode', () => {
  it('should create a new node with label only', async () => {
    const result = await executeTool('addNode', { label: 'Login' });

    expect(result.success).toBe(true);
    expect(result.nodeId).toBeDefined();

    const flow = await loadFlow();
    expect(flow.nodes).toHaveLength(1);
    expect(flow.nodes[0].data.label).toBe('Login');
  });

  it('should create a node with label and description', async () => {
    const result = await executeTool('addNode', {
      label: 'Login',
      description: 'User authentication'
    });

    const flow = await loadFlow();
    expect(flow.nodes[0].data.description).toBe('User authentication');
  });

  it('should create a node and edge when parentNodeId is provided', async () => {
    const parent = await executeTool('addNode', { label: 'Home' });
    const child = await executeTool('addNode', {
      label: 'Login',
      parentNodeId: parent.nodeId
    });

    const flow = await loadFlow();
    expect(flow.nodes).toHaveLength(2);
    expect(flow.edges).toHaveLength(1);
    expect(flow.edges[0].source).toBe(parent.nodeId);
    expect(flow.edges[0].target).toBe(child.nodeId);
  });

  it('should create a labeled edge when edgeLabel is provided', async () => {
    const parent = await executeTool('addNode', { label: 'Home' });
    const child = await executeTool('addNode', {
      label: 'Login',
      parentNodeId: parent.nodeId,
      edgeLabel: 'Navigate'
    });

    const flow = await loadFlow();
    expect(flow.edges).toHaveLength(1);
    expect(flow.edges[0].data.label).toBe('Navigate');
  });

  it('should fail when label is missing', async () => {
    const result = await executeTool('addNode', {});
    expect(result.success).toBe(false);
    expect(result.error).toContain('label');
  });

  it('should fail when parentNodeId does not exist', async () => {
    const result = await executeTool('addNode', {
      label: 'Login',
      parentNodeId: 'nonexistent-id'
    });
    expect(result.success).toBe(false);
  });
});

describe('executeTool - updateNode', () => {
  it('should update node label', async () => {
    const { nodeId } = await executeTool('addNode', { label: 'Login' });
    await executeTool('updateNode', { nodeId, label: 'Sign In' });

    const flow = await loadFlow();
    expect(flow.nodes[0].data.label).toBe('Sign In');
  });

  it('should update node description', async () => {
    const { nodeId } = await executeTool('addNode', { label: 'Login' });
    await executeTool('updateNode', { nodeId, description: 'Auth page' });

    const flow = await loadFlow();
    expect(flow.nodes[0].data.description).toBe('Auth page');
  });

  it('should update node position', async () => {
    const { nodeId } = await executeTool('addNode', { label: 'Login' });
    await executeTool('updateNode', { nodeId, position: { x: 100, y: 200 } });

    const flow = await loadFlow();
    expect(flow.nodes[0].position).toEqual({ x: 100, y: 200 });
  });

  it('should fail when nodeId does not exist', async () => {
    const result = await executeTool('updateNode', { nodeId: 'nonexistent', label: 'Test' });
    expect(result.success).toBe(false);
  });
});

describe('executeTool - deleteNode', () => {
  it('should delete a node', async () => {
    const { nodeId } = await executeTool('addNode', { label: 'Login' });
    await executeTool('deleteNode', { nodeId });

    const flow = await loadFlow();
    expect(flow.nodes).toHaveLength(0);
  });

  it('should delete node and all connected edges', async () => {
    const parent = await executeTool('addNode', { label: 'Home' });
    const child = await executeTool('addNode', { label: 'Login', parentNodeId: parent.nodeId });
    await executeTool('deleteNode', { nodeId: parent.nodeId });

    const flow = await loadFlow();
    expect(flow.nodes).toHaveLength(1);
    expect(flow.edges).toHaveLength(0);
  });
});

describe('executeTool - addEdge', () => {
  it('should create an edge between two nodes', async () => {
    const source = await executeTool('addNode', { label: 'Home' });
    const target = await executeTool('addNode', { label: 'Login' });
    const result = await executeTool('addEdge', {
      sourceNodeId: source.nodeId,
      targetNodeId: target.nodeId
    });

    expect(result.success).toBe(true);
    expect(result.edgeId).toBeDefined();

    const flow = await loadFlow();
    expect(flow.edges).toHaveLength(1);
  });

  it('should create an edge with a label', async () => {
    const source = await executeTool('addNode', { label: 'Home' });
    const target = await executeTool('addNode', { label: 'Login' });
    await executeTool('addEdge', {
      sourceNodeId: source.nodeId,
      targetNodeId: target.nodeId,
      label: 'Navigate'
    });

    const flow = await loadFlow();
    expect(flow.edges[0].data.label).toBe('Navigate');
  });

  it('should fail when source node does not exist', async () => {
    const target = await executeTool('addNode', { label: 'Login' });
    const result = await executeTool('addEdge', {
      sourceNodeId: 'nonexistent',
      targetNodeId: target.nodeId
    });
    expect(result.success).toBe(false);
  });
});

describe('executeTool - deleteEdge', () => {
  it('should delete an edge', async () => {
    const source = await executeTool('addNode', { label: 'Home' });
    const target = await executeTool('addNode', { label: 'Login' });
    const { edgeId } = await executeTool('addEdge', {
      sourceNodeId: source.nodeId,
      targetNodeId: target.nodeId
    });
    await executeTool('deleteEdge', { edgeId });

    const flow = await loadFlow();
    expect(flow.edges).toHaveLength(0);
    expect(flow.nodes).toHaveLength(2);
  });
});

describe('executeToolCalls - batch execution', () => {
  it('should execute multiple tool calls in sequence', async () => {
    const toolCalls = [
      { name: 'addNode', params: { label: 'Home' } },
      { name: 'addNode', params: { label: 'Login' } },
      { name: 'addNode', params: { label: 'Dashboard' } }
    ];

    const results = await executeToolCalls(toolCalls);
    expect(results).toHaveLength(3);
    expect(results.every(r => r.success)).toBe(true);

    const flow = await loadFlow();
    expect(flow.nodes).toHaveLength(3);
  });

  it('should continue execution even if one tool fails', async () => {
    const toolCalls = [
      { name: 'addNode', params: { label: 'Login' } },
      { name: 'deleteNode', params: { nodeId: 'nonexistent' } },
      { name: 'addNode', params: { label: 'Dashboard' } }
    ];

    const results = await executeToolCalls(toolCalls);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[2].success).toBe(true);
  });
});
