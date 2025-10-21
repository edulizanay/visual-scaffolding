// ABOUTME: Integration tests for POST /api/flow/edge endpoint
// ABOUTME: Tests manual edge creation via API with validation

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

describe('POST /api/flow/edge', () => {
  it('should create edge between two nodes', async () => {
    // Create two nodes first
    const sourceResult = await executeTool('addNode', { label: 'Source' });
    const targetResult = await executeTool('addNode', { label: 'Target' });

    // Call API to create edge
    const response = await request(app)
      .post('/api/flow/edge')
      .send({
        sourceNodeId: sourceResult.nodeId,
        targetNodeId: targetResult.nodeId,
        label: 'Connection'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.flow).toBeDefined();
    expect(response.body.flow.edges).toHaveLength(1);
    expect(response.body.edgeId).toBeDefined();

    // Verify edge properties
    const edge = response.body.flow.edges[0];
    expect(edge.source).toBe(sourceResult.nodeId);
    expect(edge.target).toBe(targetResult.nodeId);
    expect(edge.data.label).toBe('Connection');
  });

  it('should create edge without label', async () => {
    const sourceResult = await executeTool('addNode', { label: 'Source' });
    const targetResult = await executeTool('addNode', { label: 'Target' });

    const response = await request(app)
      .post('/api/flow/edge')
      .send({
        sourceNodeId: sourceResult.nodeId,
        targetNodeId: targetResult.nodeId
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const edge = response.body.flow.edges[0];
    expect(edge.data).toBeUndefined();
  });

  it('should fail when sourceNodeId is missing', async () => {
    const targetResult = await executeTool('addNode', { label: 'Target' });

    const response = await request(app)
      .post('/api/flow/edge')
      .send({
        targetNodeId: targetResult.nodeId
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('sourceNodeId');
  });

  it('should fail when targetNodeId is missing', async () => {
    const sourceResult = await executeTool('addNode', { label: 'Source' });

    const response = await request(app)
      .post('/api/flow/edge')
      .send({
        sourceNodeId: sourceResult.nodeId
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('targetNodeId');
  });

  it('should fail when sourceNodeId does not exist', async () => {
    const targetResult = await executeTool('addNode', { label: 'Target' });

    const response = await request(app)
      .post('/api/flow/edge')
      .send({
        sourceNodeId: 'nonexistent-source',
        targetNodeId: targetResult.nodeId
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('not found');
  });

  it('should fail when targetNodeId does not exist', async () => {
    const sourceResult = await executeTool('addNode', { label: 'Source' });

    const response = await request(app)
      .post('/api/flow/edge')
      .send({
        sourceNodeId: sourceResult.nodeId,
        targetNodeId: 'nonexistent-target'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('not found');
  });
});

describe('PUT /api/edge/:id', () => {
  it('should update edge label', async () => {
    // Create edge first
    const sourceResult = await executeTool('addNode', { label: 'Source' });
    const targetResult = await executeTool('addNode', { label: 'Target' });
    const edgeResult = await executeTool('addEdge', {
      sourceNodeId: sourceResult.nodeId,
      targetNodeId: targetResult.nodeId,
      label: 'Original'
    });

    // Update edge label
    const response = await request(app)
      .put(`/api/edge/${edgeResult.edgeId}`)
      .send({
        label: 'Updated'
      })
      .expect(200);

    expect(response.body.success).toBe(true);
    const edge = response.body.flow.edges[0];
    expect(edge.data.label).toBe('Updated');
  });

  it('should fail when edge does not exist', async () => {
    const response = await request(app)
      .put('/api/flow/edge/nonexistent-edge')
      .send({
        label: 'Updated'
      })
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('not found');
  });
});

describe('DELETE /api/edge/:id', () => {
  it('should delete edge', async () => {
    // Create edge first
    const sourceResult = await executeTool('addNode', { label: 'Source' });
    const targetResult = await executeTool('addNode', { label: 'Target' });
    const edgeResult = await executeTool('addEdge', {
      sourceNodeId: sourceResult.nodeId,
      targetNodeId: targetResult.nodeId
    });

    // Delete edge
    const response = await request(app)
      .delete(`/api/edge/${edgeResult.edgeId}`)
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.flow.edges).toHaveLength(0);
  });

  it('should fail when edge does not exist', async () => {
    const response = await request(app)
      .delete('/api/flow/edge/nonexistent-edge')
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('not found');
  });
});
