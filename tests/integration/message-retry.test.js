// ABOUTME: Integration tests for message retry loop in conversation endpoint
// ABOUTME: Tests retry logic without LLM mocks (uses actual parseToolCalls)

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { closeDb, saveFlow } from '../../server/db.js';
import { executeToolCalls } from '../../server/tools/executor.js';

beforeEach(() => {
  process.env.DB_PATH = ':memory:';
});

afterEach(() => {
  closeDb();
});

describe('Message Retry Loop - Tool Execution', () => {
  it('should execute tools successfully on first attempt', async () => {
    const toolCalls = [
      { name: 'addNode', params: { label: 'Login' } }
    ];

    const results = await executeToolCalls(toolCalls);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(true);
    expect(results[0].nodeId).toBeDefined();
  });

  it('should continue executing after one tool fails', async () => {
    const toolCalls = [
      { name: 'addNode', params: { label: 'Home' } },
      { name: 'deleteNode', params: { nodeId: 'nonexistent' } }, // This will fail
      { name: 'addNode', params: { label: 'Dashboard' } }
    ];

    const results = await executeToolCalls(toolCalls);

    expect(results).toHaveLength(3);
    expect(results[0].success).toBe(true); // Home created
    expect(results[1].success).toBe(false); // Delete failed
    expect(results[2].success).toBe(true); // Dashboard created

    // Flow should have 2 nodes (first and third succeeded)
    const { readFlow } = await import('../../server/server.js');
    const flow = await readFlow();
    expect(flow.nodes).toHaveLength(2);
  });

  it('should handle mixed success and failure in batch', async () => {
    // First create a node
    await executeToolCalls([{ name: 'addNode', params: { id: 'home', label: 'Home' } }]);

    // Now try batch with mix of valid and invalid
    const toolCalls = [
      { name: 'addNode', params: { label: 'Login', parentNodeId: 'home' } }, // Valid
      { name: 'addEdge', params: { sourceNodeId: 'bad', targetNodeId: 'bad' } }, // Invalid
      { name: 'updateNode', params: { nodeId: 'home', label: 'Updated Home' } } // Valid
    ];

    const results = await executeToolCalls(toolCalls);

    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
    expect(results[1].error).toContain('not found');
    expect(results[2].success).toBe(true);
  });

  it('should provide clear error messages for failures', async () => {
    const toolCalls = [
      { name: 'addEdge', params: { sourceNodeId: 'source123', targetNodeId: 'target456' } }
    ];

    const results = await executeToolCalls(toolCalls);

    expect(results[0].success).toBe(false);
    expect(results[0].error).toBeDefined();
    expect(results[0].error).toContain('not found');
    expect(results[0].error).toContain('source123');
  });

  it('should handle rapid sequential tool calls', async () => {
    // Simulate what retry loop does: execute, fail, execute again
    const attempt1 = await executeToolCalls([
      { name: 'addNode', params: { id: 'test', label: 'Test' } }
    ]);
    expect(attempt1[0].success).toBe(true);

    // Try to create same ID again (should fail)
    const attempt2 = await executeToolCalls([
      { name: 'addNode', params: { id: 'test', label: 'Duplicate' } }
    ]);
    expect(attempt2[0].success).toBe(false);
    expect(attempt2[0].error).toContain('already exists');

    // Create different node (should succeed)
    const attempt3 = await executeToolCalls([
      { name: 'addNode', params: { label: 'Different' } }
    ]);
    expect(attempt3[0].success).toBe(true);
  });

  it('should maintain flow state consistency across retries', async () => {
    const { readFlow, writeFlow } = await import('../../server/server.js');

    // Initial state
    await writeFlow({ nodes: [], edges: [] });

    // First batch
    await executeToolCalls([
      { name: 'addNode', params: { label: 'Node1' } }
    ]);

    let flow = await readFlow();
    expect(flow.nodes).toHaveLength(1);

    // Second batch (simulating retry)
    await executeToolCalls([
      { name: 'addNode', params: { label: 'Node2' } }
    ]);

    flow = await readFlow();
    expect(flow.nodes).toHaveLength(2);
    expect(flow.nodes[0].data.label).toBe('Node1');
    expect(flow.nodes[1].data.label).toBe('Node2');
  });
});
