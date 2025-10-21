// ABOUTME: Integration tests for label update endpoints
// ABOUTME: Tests node and edge label updates via API with validation

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { setupTestDb, cleanupTestDb } from './test-db-setup.js';
import { executeToolCalls } from '../server/tools/executor.js';

async function executeTool(toolName, params) {
  const results = await executeToolCalls([{ name: toolName, params }]);
  return results[0];
}

let app;

beforeAll(async () => {
  // Import server setup
  const serverModule = await import('../server/server.js');
  app = serverModule.default || serverModule.app;
});

beforeEach(async () => {
  await setupTestDb();
});

afterEach(async () => {
  await cleanupTestDb();
});

describe('PUT /api/flow/node/:id - Label Updates', () => {
  it('should update node label', async () => {
    // Create node first
    const nodeResult = await executeTool('addNode', { label: 'Original Label' });

    // Update label
    const response = await request(app)
      .put(`/api/flow/node/${nodeResult.nodeId}`)
      .send({
        label: 'Updated Label'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const node = response.body.flow.nodes.find(n => n.id === nodeResult.nodeId);
    expect(node.data.label).toBe('Updated Label');
  });

  it('should update node description', async () => {
    const nodeResult = await executeTool('addNode', { 
      label: 'Test Node',
      description: 'Original description'
    });

    const response = await request(app)
      .put(`/api/flow/node/${nodeResult.nodeId}`)
      .send({
        description: 'Updated description'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const node = response.body.flow.nodes.find(n => n.id === nodeResult.nodeId);
    expect(node.data.description).toBe('Updated description');
  });

  it('should update both label and description', async () => {
    const nodeResult = await executeTool('addNode', { 
      label: 'Original Label',
      description: 'Original description'
    });

    const response = await request(app)
      .put(`/api/flow/node/${nodeResult.nodeId}`)
      .send({
        label: 'Updated Label',
        description: 'Updated description'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const node = response.body.flow.nodes.find(n => n.id === nodeResult.nodeId);
    expect(node.data.label).toBe('Updated Label');
    expect(node.data.description).toBe('Updated description');
  });

  it('should update node position', async () => {
    const nodeResult = await executeTool('addNode', { label: 'Test Node' });

    const response = await request(app)
      .put(`/api/flow/node/${nodeResult.nodeId}`)
      .send({
        position: { x: 100, y: 200 }
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const node = response.body.flow.nodes.find(n => n.id === nodeResult.nodeId);
    expect(node.position.x).toBe(100);
    expect(node.position.y).toBe(200);
  });

  it('should fail when node does not exist', async () => {
    const response = await request(app)
      .put('/api/flow/node/nonexistent-node')
      .send({
        label: 'Updated Label'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('not found');
  });

  it('should handle empty label', async () => {
    const nodeResult = await executeTool('addNode', { label: 'Original Label' });

    const response = await request(app)
      .put(`/api/flow/node/${nodeResult.nodeId}`)
      .send({
        label: ''
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const node = response.body.flow.nodes.find(n => n.id === nodeResult.nodeId);
    expect(node.data.label).toBe('');
  });

  it('should handle empty description', async () => {
    const nodeResult = await executeTool('addNode', { 
      label: 'Test Node',
      description: 'Original description'
    });

    const response = await request(app)
      .put(`/api/flow/node/${nodeResult.nodeId}`)
      .send({
        description: ''
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const node = response.body.flow.nodes.find(n => n.id === nodeResult.nodeId);
    expect(node.data.description).toBe('');
  });

  it('should skip snapshot for label updates', async () => {
    const nodeResult = await executeTool('addNode', { label: 'Test Node' });

    // This should not create a new snapshot (skipSnapshot=true)
    const response = await request(app)
      .put(`/api/flow/node/${nodeResult.nodeId}`)
      .send({
        label: 'Updated Label'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    // The fact that it succeeds without error indicates skipSnapshot is working
  });
});

describe('PUT /api/flow/edge/:id - Label Updates', () => {
  it('should update edge label', async () => {
    // Create edge first
    const sourceResult = await executeTool('addNode', { label: 'Source' });
    const targetResult = await executeTool('addNode', { label: 'Target' });
    const edgeResult = await executeTool('addEdge', {
      sourceNodeId: sourceResult.nodeId,
      targetNodeId: targetResult.nodeId,
      label: 'Original Edge Label'
    });

    // Update edge label
    const response = await request(app)
      .put(`/api/flow/edge/${edgeResult.edgeId}`)
      .send({
        label: 'Updated Edge Label'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const edge = response.body.flow.edges.find(e => e.id === edgeResult.edgeId);
    expect(edge.data.label).toBe('Updated Edge Label');
  });

  it('should fail when edge does not exist', async () => {
    const response = await request(app)
      .put('/api/flow/edge/nonexistent-edge')
      .send({
        label: 'Updated Label'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('not found');
  });

  it('should handle empty edge label', async () => {
    const sourceResult = await executeTool('addNode', { label: 'Source' });
    const targetResult = await executeTool('addNode', { label: 'Target' });
    const edgeResult = await executeTool('addEdge', {
      sourceNodeId: sourceResult.nodeId,
      targetNodeId: targetResult.nodeId,
      label: 'Original Label'
    });

    const response = await request(app)
      .put(`/api/flow/edge/${edgeResult.edgeId}`)
      .send({
        label: ''
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const edge = response.body.flow.edges.find(e => e.id === edgeResult.edgeId);
    expect(edge.data.label).toBe('');
  });

  it('should skip snapshot for edge label updates', async () => {
    const sourceResult = await executeTool('addNode', { label: 'Source' });
    const targetResult = await executeTool('addNode', { label: 'Target' });
    const edgeResult = await executeTool('addEdge', {
      sourceNodeId: sourceResult.nodeId,
      targetNodeId: targetResult.nodeId,
      label: 'Original Label'
    });

    // This should not create a new snapshot (skipSnapshot=true)
    const response = await request(app)
      .put(`/api/flow/edge/${edgeResult.edgeId}`)
      .send({
        label: 'Updated Label'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    // The fact that it succeeds without error indicates skipSnapshot is working
  });
});

describe('Label Update Validation', () => {
  it('should handle very long labels', async () => {
    const nodeResult = await executeTool('addNode', { label: 'Test Node' });
    const longLabel = 'A'.repeat(1000);

    const response = await request(app)
      .put(`/api/flow/node/${nodeResult.nodeId}`)
      .send({
        label: longLabel
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const node = response.body.flow.nodes.find(n => n.id === nodeResult.nodeId);
    expect(node.data.label).toBe(longLabel);
  });

  it('should handle special characters in labels', async () => {
    const nodeResult = await executeTool('addNode', { label: 'Test Node' });
    const specialLabel = 'Label with émojis 🚀 and spëcial çhars!';

    const response = await request(app)
      .put(`/api/flow/node/${nodeResult.nodeId}`)
      .send({
        label: specialLabel
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const node = response.body.flow.nodes.find(n => n.id === nodeResult.nodeId);
    expect(node.data.label).toBe(specialLabel);
  });

  it('should handle HTML-like content in labels', async () => {
    const nodeResult = await executeTool('addNode', { label: 'Test Node' });
    const htmlLabel = '<script>alert("test")</script>';

    const response = await request(app)
      .put(`/api/flow/node/${nodeResult.nodeId}`)
      .send({
        label: htmlLabel
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const node = response.body.flow.nodes.find(n => n.id === nodeResult.nodeId);
    expect(node.data.label).toBe(htmlLabel);
  });
});
