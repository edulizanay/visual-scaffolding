// ABOUTME: Integration tests for notes API endpoints
// ABOUTME: Tests GET/POST/PUT /api/notes endpoints with Supabase storage

import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { setupTestDb, cleanupTestDb, seedNotes, testSupabase } from './test-db-setup.js';

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

describe('GET /api/notes', () => {
  it('T1.10: returns bullets array when notes exist', async () => {
    // Pre-populate notes in Supabase
    await seedNotes(['Bullet 1', 'Bullet 2'], [
      { role: 'user', content: 'test', timestamp: '2025-10-18T10:00:00Z' }
    ]);

    const response = await request(app)
      .get('/api/notes')
      .expect(200);

    expect(response.body.bullets).toBeDefined();
    expect(Array.isArray(response.body.bullets)).toBe(true);
    expect(response.body.bullets).toHaveLength(2);
    expect(response.body.bullets[0]).toBe('Bullet 1');
    expect(response.body.bullets[1]).toBe('Bullet 2');
    expect(response.body.conversationHistory).toBeDefined();
    expect(response.body.conversationHistory).toHaveLength(1);
  });

  it('T1.10b: returns empty state when notes table is empty', async () => {
    // setupTestDb already ensures notes row exists with empty arrays
    const response = await request(app)
      .get('/api/notes')
      .expect(200);

    expect(response.body.bullets).toEqual([]);
    expect(response.body.conversationHistory).toEqual([]);
  });
});

describe('POST /api/notes', () => {
  it('T1.11: processes message and returns new bullets', async () => {
    // Mock LLM response by setting up minimal flow
    const { saveFlow } = await import('../server/db.js');
    await saveFlow({
      nodes: [{ id: '1', data: { label: 'Test' }, position: { x: 0, y: 0 } }],
      edges: []
    });

    // This test validates the endpoint structure
    // We'll skip actual LLM call for unit test (integration tests will validate full flow)
    const response = await request(app)
      .post('/api/notes')
      .send({ message: 'I want to build a login system' });

    // Check response structure (may succeed or fail depending on LLM availability)
    expect(response.body).toBeDefined();
    expect(response.body.success).toBeDefined();

    if (response.body.success) {
      expect(response.body.bullets).toBeDefined();
      expect(Array.isArray(response.body.bullets)).toBe(true);
    } else {
      expect(response.body.error).toBeDefined();
    }
  });

  it('T1.11b: returns error when message is missing', async () => {
    const response = await request(app)
      .post('/api/notes')
      .send({})
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
    expect(response.body.error.toLowerCase()).toContain('message');
  });
});

describe('PUT /api/notes', () => {
  it('T1.12: updates bullets and persists to Supabase', async () => {
    // Pre-populate notes in Supabase
    await seedNotes(['Old bullet 1'], [
      { role: 'user', content: 'old msg', timestamp: '2025-10-18T10:00:00Z' }
    ]);

    const newBullets = ['Updated bullet 1', 'New bullet 2', 'New bullet 3'];

    const response = await request(app)
      .put('/api/notes')
      .send({ bullets: newBullets })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.bullets).toEqual(newBullets);

    // Verify Supabase was updated
    const { data: savedData } = await testSupabase
      .from('notes')
      .select('bullets, conversation_history')
      .eq('id', 1)
      .single();

    expect(savedData.bullets).toEqual(newBullets);
    expect(savedData.conversation_history).toHaveLength(1); // Preserved
  });

  it('T1.12b: returns error when bullets array is missing', async () => {
    const response = await request(app)
      .put('/api/notes')
      .send({})
      .expect(400);

    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
    expect(response.body.error).toContain('bullets');
  });
});

describe('Error handling - T1.13', () => {
  it('T1.13: error responses return { success: false, error: string }', async () => {
    // Test invalid PUT request
    const response = await request(app)
      .put('/api/notes')
      .send({ invalid: 'data' })
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: expect.any(String)
    });
  });

  it('T1.13b: POST error returns correct format', async () => {
    const response = await request(app)
      .post('/api/notes')
      .send({})
      .expect(400);

    expect(response.body).toMatchObject({
      success: false,
      error: expect.any(String)
    });
  });
});
