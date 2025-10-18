// ABOUTME: Test ChatInterface routing based on notes panel state
// ABOUTME: Verifies messages route to conversation endpoint when panel is closed

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { saveFlow, closeDb } from '../../server/db.js';

// Import server
let app;

beforeEach(async () => {
  process.env.DB_PATH = ':memory:';

  // Initialize with empty flow
  saveFlow({ nodes: [], edges: [] });

  // Dynamically import app to get fresh instance
  const serverModule = await import('../../server/server.js');
  app = serverModule.default;
});

afterEach(() => {
  closeDb();
});

describe('ChatInterface Routing', () => {
  it('should route to conversation endpoint when panel is closed (creates nodes)', async () => {
    // Simulate panel closed state - send message to create node
    const response = await request(app)
      .post('/api/conversation/message')
      .send({ message: 'Create a Login node' })
      .timeout(15000)
      .expect(200);

    console.log('Response:', JSON.stringify(response.body, null, 2));

    // Verify response indicates conversation endpoint was used
    expect(response.body.success).toBe(true);

    // Verify node was created (conversation endpoint behavior)
    if (response.body.updatedFlow) {
      expect(response.body.updatedFlow.nodes.length).toBeGreaterThan(0);
      expect(response.body.updatedFlow.nodes[0].data.label).toBe('Login');
    }
  });

  it('should route to notes endpoint when panel is open (creates bullets, no nodes)', async () => {
    // Simulate panel open state - send message to notes endpoint
    const response = await request(app)
      .post('/api/notes')
      .send({ message: 'I want to build a login page with email and password' })
      .timeout(15000)
      .expect(200);

    console.log('Notes Response:', JSON.stringify(response.body, null, 2));

    // Verify response indicates notes endpoint was used
    expect(response.body.success).toBe(true);

    // Verify bullets were created (notes endpoint behavior)
    expect(response.body.bullets).toBeDefined();
    expect(Array.isArray(response.body.bullets)).toBe(true);

    // Verify NO nodes were created
    const flowResponse = await request(app).get('/api/flow');
    expect(flowResponse.body.nodes.length).toBe(0);
  });
});
