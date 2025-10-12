// ABOUTME: Integration tests for POST /api/node endpoint
// ABOUTME: Tests manual node creation via API with group membership inheritance

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import { closeDb } from '../server/db.js';
import { executeToolCalls } from '../server/tools/executor.js';

async function executeTool(toolName, params) {
  const results = await executeToolCalls([{ name: toolName, params }]);
  return results[0];
}

let app;

beforeAll(async () => {
  process.env.DB_PATH = ':memory:';

  // Import server setup
  const serverModule = await import('../server/server.js');
  app = serverModule.default || serverModule.app;
});

beforeEach(() => {
  process.env.DB_PATH = ':memory:';
});

afterEach(() => {
  closeDb();
});

describe('POST /api/node', () => {
  it('should create node with parent and return updated flow', async () => {
    // Create a parent node first
    const parentResult = await executeTool('addNode', { label: 'Parent' });

    // Call API to create child
    const response = await request(app)
      .post('/api/node')
      .send({
        parentNodeId: parentResult.nodeId,
        label: 'Child'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.flow).toBeDefined();
    expect(response.body.flow.nodes).toHaveLength(2);
    expect(response.body.flow.edges).toHaveLength(1);

    // Verify edge connects parent to child
    const edge = response.body.flow.edges[0];
    expect(edge.source).toBe(parentResult.nodeId);
  });

  it('should inherit group membership when parent belongs to a group', async () => {
    // Create parent node with group membership
    const parentResult = await executeTool('addNode', { label: 'Parent' });
    const { saveFlow } = await import('../server/db.js');
    const { readFlow } = await import('../server/server.js');

    let flow = await readFlow();
    flow.nodes[0].parentGroupId = 'test-group-123';
    saveFlow(flow);

    // Create child via API
    const response = await request(app)
      .post('/api/node')
      .send({
        parentNodeId: parentResult.nodeId,
        label: 'Child'
      })
      .expect(200);

    expect(response.body.success).toBe(true);

    // Find the child node
    const childNode = response.body.flow.nodes.find(n => n.data.label === 'Child');
    expect(childNode).toBeDefined();
    expect(childNode.parentGroupId).toBe('test-group-123');
  });

  it('should generate label if not provided', async () => {
    const parentResult = await executeTool('addNode', { label: 'Parent' });

    const response = await request(app)
      .post('/api/node')
      .send({
        parentNodeId: parentResult.nodeId
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const newNode = response.body.flow.nodes.find(n => n.id !== parentResult.nodeId);
    expect(newNode.data.label).toMatch(/Node \d+/);
  });

  it('should fail when parentNodeId does not exist', async () => {
    const response = await request(app)
      .post('/api/node')
      .send({
        parentNodeId: 'nonexistent-id',
        label: 'Child'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
  });
});
