// ABOUTME: End-to-End tests for Notes Panel feature
// ABOUTME: Tests simulate complete user workflows with real data and APIs (no mocks)

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { closeDb, saveFlow } from '../../server/db.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Notes file path
const NOTES_FILE_PATH = path.join(__dirname, '../../notes-debug.json');

beforeEach(() => {
  process.env.DB_PATH = ':memory:';
  // Initialize with empty flow
  saveFlow({ nodes: [], edges: [] });
  // Clean up notes file before each test
  if (fs.existsSync(NOTES_FILE_PATH)) {
    fs.unlinkSync(NOTES_FILE_PATH);
  }
});

afterEach(() => {
  closeDb();
  // Clean up notes file after each test
  if (fs.existsSync(NOTES_FILE_PATH)) {
    fs.unlinkSync(NOTES_FILE_PATH);
  }
});

describe('Notes Panel E2E User Workflows', () => {

  // E2E1: Open panel → send message → bullets appear in panel, no nodes created
  it('E2E1: User opens panel, sends message, sees bullets, no nodes created', async () => {
    // Skip if no LLM configured
    if (!process.env.GROQ_API_KEY && !process.env.CEREBRAS_API_KEY) {
      console.log('⚠️  Skipping E2E1: No LLM API keys configured');
      return;
    }

    const { default: app } = await import('../../server/server.js');
    const { readFlow } = await import('../../server/server.js');

    // User workflow:
    // 1. User opens notes panel (simulated by loading notes)
    const openPanelResponse = await request(app)
      .get('/api/notes')
      .expect(200);

    expect(openPanelResponse.body.bullets).toEqual([]);
    expect(openPanelResponse.body.conversationHistory).toEqual([]);

    // 2. User types message and sends it (panel is open, so routes to /api/notes)
    const userMessage = 'I want to build an e-commerce platform with shopping cart';
    const sendMessageResponse = await request(app)
      .post('/api/notes')
      .send({ message: userMessage })
      .expect(200);

    // 3. User sees bullets appear in panel
    expect(sendMessageResponse.body.success).toBe(true);
    expect(sendMessageResponse.body.bullets).toBeDefined();
    expect(sendMessageResponse.body.bullets.length).toBeGreaterThan(0);
    expect(sendMessageResponse.body.newBullets.length).toBeGreaterThan(0);

    // Verify bullets contain relevant content
    const bulletsText = sendMessageResponse.body.bullets.join(' ').toLowerCase();
    expect(
      bulletsText.includes('e-commerce') ||
      bulletsText.includes('shopping') ||
      bulletsText.includes('cart') ||
      bulletsText.includes('platform')
    ).toBe(true);

    // 4. Verify no nodes were created (critical - panel mode should not create nodes)
    const flow = await readFlow();
    expect(flow.nodes).toEqual([]);
    expect(flow.edges).toEqual([]);

    // 5. User sees bullets persist when reloading panel
    const reloadPanelResponse = await request(app)
      .get('/api/notes')
      .expect(200);

    expect(reloadPanelResponse.body.bullets).toEqual(sendMessageResponse.body.bullets);
  }, 30000);

  // E2E2: Close panel → send message → nodes created normally, no bullets
  it('E2E2: User closes panel, sends message, nodes created, no bullets added', async () => {
    // Skip if no LLM configured
    if (!process.env.GROQ_API_KEY && !process.env.CEREBRAS_API_KEY) {
      console.log('⚠️  Skipping E2E2: No LLM API keys configured');
      return;
    }

    const { default: app } = await import('../../server/server.js');
    const { readFlow } = await import('../../server/server.js');

    // User workflow:
    // 1. User has panel closed (normal conversation mode)
    // 2. User sends message to create nodes (routes to /api/conversation/message)
    const userMessage = 'Create a Login node connected to a Dashboard node';
    const sendMessageResponse = await request(app)
      .post('/api/conversation/message')
      .send({ message: userMessage })
      .expect(200);

    // 3. Verify nodes were created
    const flow = await readFlow();
    expect(flow.nodes.length).toBeGreaterThan(0);

    // Should have created nodes with labels matching the request
    const nodeLabels = flow.nodes.map(n => n.data.label.toLowerCase());
    const hasLogin = nodeLabels.some(label => label.includes('login'));
    const hasDashboard = nodeLabels.some(label => label.includes('dashboard'));

    // At least one of the expected nodes should be created
    expect(hasLogin || hasDashboard).toBe(true);

    // 4. Verify notes were NOT affected (panel was closed)
    const notesResponse = await request(app)
      .get('/api/notes')
      .expect(200);

    expect(notesResponse.body.bullets).toEqual([]);
    expect(notesResponse.body.conversationHistory).toEqual([]);
  }, 30000);

  // E2E3: Edit bullet → refresh browser → changes persist
  it('E2E3: User edits bullet, refreshes browser, changes persist', async () => {
    const { default: app } = await import('../../server/server.js');

    // User workflow:
    // 1. User has some bullets in panel (simulate initial state)
    const initialBullets = [
      'Build authentication system',
      'Create user registration',
      'Add password reset'
    ];

    await request(app)
      .put('/api/notes')
      .send({ bullets: initialBullets })
      .expect(200);

    // 2. User edits a bullet (e.g., changes second bullet)
    const editedBullets = [
      'Build authentication system',
      'Create user registration with email verification', // Edited
      'Add password reset'
    ];

    const editResponse = await request(app)
      .put('/api/notes')
      .send({ bullets: editedBullets })
      .expect(200);

    expect(editResponse.body.success).toBe(true);
    expect(editResponse.body.bullets).toEqual(editedBullets);

    // 3. User refreshes browser (simulate by reloading notes)
    const reloadResponse = await request(app)
      .get('/api/notes')
      .expect(200);

    // 4. User sees edited content persisted
    expect(reloadResponse.body.bullets).toEqual(editedBullets);
    expect(reloadResponse.body.bullets[1]).toBe('Create user registration with email verification');

    // 5. Verify file was actually updated
    expect(fs.existsSync(NOTES_FILE_PATH)).toBe(true);
    const savedData = JSON.parse(fs.readFileSync(NOTES_FILE_PATH, 'utf-8'));
    expect(savedData.bullets).toEqual(editedBullets);
  });

  // E2E4: Delete notes file → open panel → app shows empty state (no crash)
  it('E2E4: User deletes notes file, opens panel, sees empty state without crash', async () => {
    const { default: app } = await import('../../server/server.js');

    // User workflow (edge case):
    // 1. User has some notes saved
    const initialBullets = ['Test bullet 1', 'Test bullet 2'];
    await request(app)
      .put('/api/notes')
      .send({ bullets: initialBullets })
      .expect(200);

    // Verify file exists
    expect(fs.existsSync(NOTES_FILE_PATH)).toBe(true);

    // 2. User manually deletes notes file (or it gets corrupted)
    fs.unlinkSync(NOTES_FILE_PATH);
    expect(fs.existsSync(NOTES_FILE_PATH)).toBe(false);

    // 3. User opens panel (app should not crash)
    const openPanelResponse = await request(app)
      .get('/api/notes')
      .expect(200);

    // 4. User sees empty state (not an error)
    expect(openPanelResponse.body.bullets).toEqual([]);
    expect(openPanelResponse.body.conversationHistory).toEqual([]);

    // 5. User can still use panel normally (send a message)
    if (process.env.GROQ_API_KEY || process.env.CEREBRAS_API_KEY) {
      const sendMessageResponse = await request(app)
        .post('/api/notes')
        .send({ message: 'I want to build a user profile page with avatar upload' })
        .expect(200);

      expect(sendMessageResponse.body.success).toBe(true);
      expect(sendMessageResponse.body.bullets.length).toBeGreaterThan(0);

      // File should be recreated
      expect(fs.existsSync(NOTES_FILE_PATH)).toBe(true);
    } else {
      // Even without LLM, user can still edit bullets
      const editResponse = await request(app)
        .put('/api/notes')
        .send({ bullets: ['New bullet after deletion'] })
        .expect(200);

      expect(editResponse.body.success).toBe(true);
      expect(fs.existsSync(NOTES_FILE_PATH)).toBe(true);
    }
  }, 30000);

  // Additional E2E test: User switches between panel and normal mode
  it('E2E5: User switches between notes panel and normal mode seamlessly', async () => {
    // Skip if no LLM configured
    if (!process.env.GROQ_API_KEY && !process.env.CEREBRAS_API_KEY) {
      console.log('⚠️  Skipping E2E5: No LLM API keys configured');
      return;
    }

    const { default: app } = await import('../../server/server.js');
    const { readFlow } = await import('../../server/server.js');

    // User workflow:
    // 1. User opens panel and adds some thoughts
    const notesMessage = await request(app)
      .post('/api/notes')
      .send({ message: 'I need to build a user profile page with settings' })
      .expect(200);

    expect(notesMessage.body.success).toBe(true);
    const bulletCount = notesMessage.body.bullets.length;
    expect(bulletCount).toBeGreaterThan(0);

    // Verify no nodes created
    let flow = await readFlow();
    expect(flow.nodes.length).toBe(0);

    // 2. User closes panel and creates actual nodes
    const createNodes = await request(app)
      .post('/api/conversation/message')
      .send({ message: 'Create a Profile node' })
      .expect(200);

    flow = await readFlow();
    expect(flow.nodes.length).toBeGreaterThan(0);

    // 3. User opens panel again and adds more thoughts
    const moreNotes = await request(app)
      .post('/api/notes')
      .send({ message: 'Also need avatar upload functionality' })
      .expect(200);

    expect(moreNotes.body.success).toBe(true);
    expect(moreNotes.body.bullets.length).toBeGreaterThan(bulletCount);

    // 4. Verify notes and nodes are independent
    const finalNotes = await request(app).get('/api/notes').expect(200);
    const finalFlow = await readFlow();

    // Notes should have bullets from both sessions
    expect(finalNotes.body.bullets.length).toBeGreaterThan(bulletCount);

    // Flow should only have nodes from conversation mode
    expect(finalFlow.nodes.length).toBeGreaterThan(0);

    // Verify they don't interfere with each other
    const notesText = finalNotes.body.bullets.join(' ');
    expect(notesText.toLowerCase()).toContain('profile');
  }, 60000);

  // Additional E2E test: Multiple edits and deletions
  it('E2E6: User performs multiple edits, additions, and deletions', async () => {
    const { default: app } = await import('../../server/server.js');

    // User workflow:
    // 1. User starts with some bullets
    let bullets = ['First item', 'Second item', 'Third item'];
    await request(app)
      .put('/api/notes')
      .send({ bullets })
      .expect(200);

    // 2. User edits multiple bullets
    bullets = ['Updated first item', 'Second item', 'Modified third item'];
    await request(app)
      .put('/api/notes')
      .send({ bullets })
      .expect(200);

    // 3. User deletes one bullet
    bullets = ['Updated first item', 'Modified third item'];
    await request(app)
      .put('/api/notes')
      .send({ bullets })
      .expect(200);

    // 4. User adds new bullets
    bullets = ['Updated first item', 'Modified third item', 'New fourth item', 'New fifth item'];
    await request(app)
      .put('/api/notes')
      .send({ bullets })
      .expect(200);

    // 5. Verify final state
    const finalResponse = await request(app).get('/api/notes').expect(200);
    expect(finalResponse.body.bullets).toEqual(bullets);

    // 6. User refreshes - all changes persist
    const reloadResponse = await request(app).get('/api/notes').expect(200);
    expect(reloadResponse.body.bullets).toEqual(bullets);

    // Verify file reflects final state
    const savedData = JSON.parse(fs.readFileSync(NOTES_FILE_PATH, 'utf-8'));
    expect(savedData.bullets).toEqual(bullets);
  });
});
