// ABOUTME: Tests API contract stability to ensure frontend compatibility
// ABOUTME: Verifies response formats and status codes remain consistent

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../server/server.js';
import { closeDb } from '../server/db.js';

beforeEach(() => {
  process.env.DB_PATH = ':memory:';
});

afterEach(() => {
  closeDb();
});

describe('API Contract: GET /api/flow', () => {
  it('should return 200 and correct JSON schema', async () => {
    const response = await request(app)
      .get('/api/flow')
      .expect('Content-Type', /json/)
      .expect(200);

    // Verify schema
    expect(response.body).toHaveProperty('nodes');
    expect(response.body).toHaveProperty('edges');
    expect(Array.isArray(response.body.nodes)).toBe(true);
    expect(Array.isArray(response.body.edges)).toBe(true);
  });

  it('should return empty arrays for new flow', async () => {
    const response = await request(app).get('/api/flow');

    expect(response.body.nodes).toEqual([]);
    expect(response.body.edges).toEqual([]);
  });

  it('should return existing flow data', async () => {
    // Populate flow using saveFlow
    const { saveFlow } = await import('../server/db.js');
    const existingFlow = {
      nodes: [
        { id: '1', position: { x: 0, y: 0 }, data: { label: 'Test' } }
      ],
      edges: []
    };
    saveFlow(existingFlow);

    const response = await request(app).get('/api/flow');

    expect(response.body.nodes).toHaveLength(1);
    expect(response.body.nodes[0].data.label).toBe('Test');
  });
});

describe('API Contract: POST /api/flow', () => {
  it('should return 200 and success: true on valid flow', async () => {
    const validFlow = {
      nodes: [
        { id: '1', position: { x: 100, y: 200 }, data: { label: 'Node 1' } }
      ],
      edges: []
    };

    const response = await request(app)
      .post('/api/flow')
      .send(validFlow)
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success');
    expect(response.body.success).toBe(true);
  });

  it('should return 400 on invalid flow structure (missing nodes)', async () => {
    const invalidFlow = { edges: [] }; // Missing nodes

    const response = await request(app)
      .post('/api/flow')
      .send(invalidFlow)
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  it('should return 400 on invalid flow structure (missing edges)', async () => {
    const invalidFlow = { nodes: [] }; // Missing edges

    const response = await request(app)
      .post('/api/flow')
      .send(invalidFlow)
      .expect(400);

    expect(response.body).toHaveProperty('error');
  });

  it('should return 400 on non-array nodes', async () => {
    const invalidFlow = { nodes: 'not-an-array', edges: [] };

    const response = await request(app)
      .post('/api/flow')
      .send(invalidFlow)
      .expect(400);

    expect(response.body.error).toContain('Invalid flow data');
  });

  it('should persist flow data after POST', async () => {
    const flow = {
      nodes: [
        { id: 'persist_test', position: { x: 0, y: 0 }, data: { label: 'Persist' } }
      ],
      edges: []
    };

    await request(app).post('/api/flow').send(flow).expect(200);

    // Verify persisted by reading again
    const getResponse = await request(app).get('/api/flow');
    expect(getResponse.body.nodes[0].id).toBe('persist_test');
  });

  it('should support skipSnapshot query parameter', async () => {
    const flow = {
      nodes: [{ id: '1', position: { x: 0, y: 0 }, data: { label: 'Test' } }],
      edges: []
    };

    const response = await request(app)
      .post('/api/flow?skipSnapshot=true')
      .send(flow)
      .expect(200);

    expect(response.body.success).toBe(true);
  });
});

describe('API Contract: POST /api/conversation/message', () => {
  it('should return 400 when message is missing', async () => {
    const response = await request(app)
      .post('/api/conversation/message')
      .send({})
      .expect(400);

    expect(response.body).toHaveProperty('error');
    expect(response.body.error).toContain('Message is required');
  });

  it('should return 400 when message is not a string', async () => {
    const response = await request(app)
      .post('/api/conversation/message')
      .send({ message: 123 })
      .expect(400);

    expect(response.body.error).toContain('must be a string');
  });

  it('should return expected response structure on success', async () => {
    // Mock simple message that won't trigger LLM
    const response = await request(app)
      .post('/api/conversation/message')
      .send({ message: 'test message' })
      .expect('Content-Type', /json/)
      .expect(200);

    // Verify response has expected fields
    expect(response.body).toHaveProperty('success');
    expect(response.body).toHaveProperty('thinking');
    expect(response.body).toHaveProperty('iterations');

    // Response can have toolCalls, execution, updatedFlow depending on LLM result
    // When LLM doesn't generate tool calls, updatedFlow won't be present
    if (response.body.success && response.body.toolCalls && response.body.toolCalls.length > 0) {
      expect(response.body).toHaveProperty('updatedFlow');
      expect(response.body.updatedFlow).toHaveProperty('nodes');
      expect(response.body.updatedFlow).toHaveProperty('edges');
    }
  }, 30000); // Longer timeout for LLM call
});

describe('API Contract: Undo/Redo Endpoints', () => {
  it('POST /api/flow/undo should return correct structure', async () => {
    const response = await request(app)
      .post('/api/flow/undo')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success');

    // When nothing to undo
    if (!response.body.success) {
      expect(response.body).toHaveProperty('message');
    } else {
      expect(response.body).toHaveProperty('flow');
      expect(response.body.flow).toHaveProperty('nodes');
      expect(response.body.flow).toHaveProperty('edges');
    }
  });

  it('POST /api/flow/redo should return correct structure', async () => {
    const response = await request(app)
      .post('/api/flow/redo')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success');

    // When nothing to redo
    if (!response.body.success) {
      expect(response.body).toHaveProperty('message');
    } else {
      expect(response.body).toHaveProperty('flow');
    }
  });

  it('GET /api/flow/history-status should return status object', async () => {
    const response = await request(app)
      .get('/api/flow/history-status')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('canUndo');
    expect(response.body).toHaveProperty('canRedo');
    expect(response.body).toHaveProperty('snapshotCount');
    expect(response.body).toHaveProperty('currentIndex');

    expect(typeof response.body.canUndo).toBe('boolean');
    expect(typeof response.body.canRedo).toBe('boolean');
    expect(typeof response.body.snapshotCount).toBe('number');
    expect(typeof response.body.currentIndex).toBe('number');
  });
});

describe('API Contract: Conversation Endpoints', () => {
  it('GET /api/conversation/debug should return conversation history', async () => {
    const response = await request(app)
      .get('/api/conversation/debug')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('history');
    expect(response.body).toHaveProperty('messageCount');
    expect(Array.isArray(response.body.history)).toBe(true);
    expect(typeof response.body.messageCount).toBe('number');
  });

  it('DELETE /api/conversation/history should return success', async () => {
    const response = await request(app)
      .delete('/api/conversation/history')
      .expect('Content-Type', /json/)
      .expect(200);

    expect(response.body).toHaveProperty('success');
    expect(response.body.success).toBe(true);
  });
});

describe('API Contract: Error Handling', () => {
  it('should return 404 for unknown routes', async () => {
    await request(app)
      .get('/api/unknown-route')
      .expect(404);
  });

  it('should return 500 on server errors with error message', async () => {
    // Force an error by providing invalid DB path
    process.env.DB_PATH = '/invalid/path/that/does/not/exist/test.db';
    closeDb(); // Close current DB to force re-init with bad path

    // This should fail with 500
    const response = await request(app)
      .post('/api/flow')
      .send({ nodes: [], edges: [] });

    // Should be 500 since DB cannot be created
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');

    // Reset to memory DB
    process.env.DB_PATH = ':memory:';
    closeDb();
  });
});

describe('API Contract: CORS Headers', () => {
  it('should include CORS headers in responses', async () => {
    const response = await request(app).get('/api/flow');

    // CORS headers should be present
    expect(response.headers['access-control-allow-origin']).toBeDefined();
  });
});
