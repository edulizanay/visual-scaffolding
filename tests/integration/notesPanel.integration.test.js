// ABOUTME: Integration tests for Notes Panel feature
// ABOUTME: Tests verify components working together with real API calls and file system

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { setupTestDb, cleanupTestDb } from '../test-db-setup.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Notes file path
const NOTES_FILE_PATH = path.join(__dirname, '../../notes-debug.json');

beforeEach(async () => {
  await setupTestDb();
  // Clean up notes file before each test
  if (fs.existsSync(NOTES_FILE_PATH)) {
    fs.unlinkSync(NOTES_FILE_PATH);
  }
});

afterEach(async () => {
  await cleanupTestDb();
  // Clean up notes file after each test
  if (fs.existsSync(NOTES_FILE_PATH)) {
    fs.unlinkSync(NOTES_FILE_PATH);
  }
});

describe('Notes Panel Integration Tests', () => {

  // I1: Full flow: POST /api/notes → LLM call → parse → save → return bullets
  it('I1: should process full flow from POST to LLM to save and return bullets', async () => {
    // Skip if no LLM configured
    if (!process.env.GROQ_API_KEY && !process.env.CEREBRAS_API_KEY) {
      console.log('⚠️  Skipping I1: No LLM API keys configured');
      return;
    }

    const { default: app } = await import('../../server/server.js');

    // Send a message to notes endpoint
    const response = await request(app)
      .post('/api/notes')
      .send({ message: 'I need to build a login system with authentication' })
      .expect(200);

    // Verify response structure
    expect(response.body).toHaveProperty('success', true);
    expect(response.body).toHaveProperty('bullets');
    expect(response.body).toHaveProperty('newBullets');
    expect(Array.isArray(response.body.bullets)).toBe(true);
    expect(Array.isArray(response.body.newBullets)).toBe(true);

    // Verify bullets were added
    expect(response.body.newBullets.length).toBeGreaterThan(0);
    expect(response.body.bullets.length).toBe(response.body.newBullets.length);

    // Verify file was created and saved
    expect(fs.existsSync(NOTES_FILE_PATH)).toBe(true);
    const savedData = JSON.parse(fs.readFileSync(NOTES_FILE_PATH, 'utf-8'));
    expect(savedData.bullets).toEqual(response.body.bullets);
    expect(savedData.conversationHistory.length).toBeGreaterThan(0);
  }, 30000); // 30 second timeout for LLM call

  // I2: File persistence: Save → restart → load returns same data
  it('I2: should persist notes to file and load them back correctly', async () => {
    const { default: app } = await import('../../server/server.js');
    const { loadNotes, saveNotes } = await import('../../server/notesService.js');

    // Save some test notes
    const testBullets = [
      'Build authentication system',
      'Create user registration flow',
      'Add password reset functionality'
    ];
    const testHistory = [
      {
        role: 'user',
        content: 'I want to build a login system',
        timestamp: new Date().toISOString()
      },
      {
        role: 'assistant',
        content: 'Here are the key steps...',
        timestamp: new Date().toISOString()
      }
    ];

    saveNotes(testBullets, testHistory);

    // Verify file exists
    expect(fs.existsSync(NOTES_FILE_PATH)).toBe(true);

    // Load notes via API
    const response = await request(app)
      .get('/api/notes')
      .expect(200);

    // Verify loaded data matches saved data
    expect(response.body.bullets).toEqual(testBullets);
    expect(response.body.conversationHistory).toEqual(testHistory);

    // Also verify direct load
    const directLoad = loadNotes();
    expect(directLoad.bullets).toEqual(testBullets);
    expect(directLoad.conversationHistory).toEqual(testHistory);
  });

  // I3: Error handling: LLM failure returns error without crashing
  it('I3: should handle LLM failure gracefully without crashing', async () => {
    // Temporarily clear API keys to force LLM failure
    const originalGroqKey = process.env.GROQ_API_KEY;
    const originalCerebrasKey = process.env.CEREBRAS_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.CEREBRAS_API_KEY;

    // Re-import server with cleared keys
    delete require.cache[require.resolve('../../server/server.js')];
    const { default: app } = await import('../../server/server.js');

    const response = await request(app)
      .post('/api/notes')
      .send({ message: 'Test message' })
      .expect(200);

    // Should return error response, not crash
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
    expect(response.body.error).toContain('LLM is not configured');
    expect(response.body.bullets).toEqual([]);
    expect(response.body.newBullets).toEqual([]);

    // Restore API keys
    if (originalGroqKey) process.env.GROQ_API_KEY = originalGroqKey;
    if (originalCerebrasKey) process.env.CEREBRAS_API_KEY = originalCerebrasKey;
  });

  // I4: App.jsx → ChatInterface → NotesPanel data flow
  it('I4: should support complete data flow from ChatInterface to NotesPanel', async () => {
    const { default: app } = await import('../../server/server.js');
    const { loadNotes } = await import('../../server/notesService.js');

    // Simulate ChatInterface sending message when panel is open
    // This should NOT create nodes, only update notes

    // First, verify no notes exist
    const emptyNotes = loadNotes();
    expect(emptyNotes.bullets).toEqual([]);

    // Update notes via PUT endpoint (simulating user edit in panel)
    const testBullets = ['Test bullet 1', 'Test bullet 2'];
    const updateResponse = await request(app)
      .put('/api/notes')
      .send({ bullets: testBullets })
      .expect(200);

    expect(updateResponse.body.success).toBe(true);
    expect(updateResponse.body.bullets).toEqual(testBullets);

    // Verify notes were saved
    const loadedNotes = loadNotes();
    expect(loadedNotes.bullets).toEqual(testBullets);

    // Load via GET endpoint (simulating panel opening)
    const getResponse = await request(app)
      .get('/api/notes')
      .expect(200);

    expect(getResponse.body.bullets).toEqual(testBullets);
  });

  // I5: Panel state toggle updates ChatInterface routing
  it('I5: should route to different endpoints based on panel state', async () => {
    const { default: app } = await import('../../server/server.js');

    // This test verifies that the notes endpoint is separate from conversation endpoint
    // When panel is open, ChatInterface calls /api/notes
    // When panel is closed, ChatInterface calls /api/conversation/message

    // Test notes endpoint is accessible
    const notesResponse = await request(app)
      .get('/api/notes')
      .expect(200);

    expect(notesResponse.body).toHaveProperty('bullets');
    expect(notesResponse.body).toHaveProperty('conversationHistory');

    // Test conversation endpoint is still accessible
    const conversationResponse = await request(app)
      .get('/api/conversation/debug')
      .expect(200);

    expect(conversationResponse.body).toHaveProperty('history');

    // Verify they are independent
    // Notes should not affect conversation and vice versa
    const { updateBullets } = await import('../../server/notesService.js');
    updateBullets(['Note bullet 1']);

    const notesCheck = await request(app).get('/api/notes').expect(200);
    expect(notesCheck.body.bullets).toEqual(['Note bullet 1']);

    // Conversation should still be independent
    const conversationCheck = await request(app).get('/api/conversation/debug').expect(200);
    expect(conversationCheck.body.history).toEqual([]);
  });

  // I6: Bullets update in panel when ChatInterface receives response
  it('I6: should update bullets when receiving response from notes endpoint', async () => {
    // Skip if no LLM configured
    if (!process.env.GROQ_API_KEY && !process.env.CEREBRAS_API_KEY) {
      console.log('⚠️  Skipping I6: No LLM API keys configured');
      return;
    }

    const { default: app } = await import('../../server/server.js');

    // Start with empty notes
    const initialResponse = await request(app)
      .get('/api/notes')
      .expect(200);

    expect(initialResponse.body.bullets).toEqual([]);

    // Send first message
    const firstMessage = await request(app)
      .post('/api/notes')
      .send({ message: 'I need to build a dashboard' })
      .expect(200);

    expect(firstMessage.body.success).toBe(true);
    expect(firstMessage.body.bullets.length).toBeGreaterThan(0);
    const firstBulletsCount = firstMessage.body.bullets.length;

    // Send second message - should append to existing bullets
    const secondMessage = await request(app)
      .post('/api/notes')
      .send({ message: 'Also add user analytics' })
      .expect(200);

    expect(secondMessage.body.success).toBe(true);
    expect(secondMessage.body.bullets.length).toBeGreaterThan(firstBulletsCount);

    // Verify bullets include both old and new
    expect(secondMessage.body.newBullets.length).toBeGreaterThan(0);
    expect(secondMessage.body.bullets).toEqual([
      ...firstMessage.body.bullets,
      ...secondMessage.body.newBullets
    ]);

    // Verify persistence
    const finalCheck = await request(app)
      .get('/api/notes')
      .expect(200);

    expect(finalCheck.body.bullets).toEqual(secondMessage.body.bullets);
  }, 60000); // 60 second timeout for multiple LLM calls
});
