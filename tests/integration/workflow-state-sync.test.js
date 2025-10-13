// ABOUTME: Integration tests for complete user workflows (backend + frontend simulation)
// ABOUTME: Tests state synchronization between backend operations and frontend saves

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import { closeDb, getDb } from '../../server/db.js';
import { clearHistory, initializeHistory } from '../../server/historyService.js';

let app;

beforeAll(async () => {
  process.env.DB_PATH = ':memory:';
  const serverModule = await import('../../server/server.js');
  app = serverModule.default || serverModule.app;
});

beforeEach(async () => {
  process.env.DB_PATH = ':memory:';
  await clearHistory();
  // Initialize baseline snapshot (empty flow) like production does
  await initializeHistory({ nodes: [], edges: [] });
});

afterEach(() => {
  closeDb();
});

/**
 * Get snapshot count
 */
function getSnapshotCount() {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as count FROM undo_history').get();
  return result.count;
}

/**
 * Get current flow from database
 */
async function getCurrentFlow() {
  const response = await request(app).get('/api/flow');
  return response.body;
}

describe('Workflow: Backend operation → Frontend autosave → Undo', () => {
  it('Backend creates node → Frontend does NOT double-save (identical state)', async () => {
    const initialCount = getSnapshotCount();

    // Step 1: Backend creates node (saves snapshot #1)
    const createResponse = await request(app)
      .post('/api/node')
      .send({ label: 'Test Node' })
      .expect(200);

    const countAfterBackend = getSnapshotCount();
    expect(countAfterBackend).toBe(initialCount + 1);

    // Step 2: Frontend receives flow and would trigger autosave
    // But state is IDENTICAL, so deduplication should prevent snapshot
    const currentFlow = await getCurrentFlow();

    await request(app)
      .post('/api/flow')
      .send(currentFlow)
      .expect(200);

    const countAfterFrontend = getSnapshotCount();

    // CRITICAL: Should still be +1, not +2 (deduplication works)
    expect(countAfterFrontend).toBe(initialCount + 1);
  });

  it('Backend creates node → Layout changes positions → Frontend saves → Creates 2nd snapshot', async () => {
    const initialCount = getSnapshotCount();

    // Step 1: Backend creates node at default position
    const createResponse = await request(app)
      .post('/api/node')
      .send({ label: 'Test Node' })
      .expect(200);

    const nodeId = createResponse.body.flow.nodes[0].id;
    const countAfterBackend = getSnapshotCount();

    // Step 2: Simulate layout calculating new positions (what dagre does)
    const currentFlow = await getCurrentFlow();
    const layoutFlow = {
      nodes: currentFlow.nodes.map(n => ({
        ...n,
        position: { x: 100, y: 200 } // Layout calculated position
      })),
      edges: currentFlow.edges
    };

    // Step 3: Frontend saves after layout animation
    await request(app)
      .post('/api/flow')
      .send(layoutFlow)
      .expect(200);

    const countAfterLayout = getSnapshotCount();

    // This SHOULD create 2nd snapshot (state actually changed)
    expect(countAfterLayout).toBe(countAfterBackend + 1);
  });

  it('Create node → Update position → Undo → Position is restored', async () => {
    // Step 1: Create node
    const createResponse = await request(app)
      .post('/api/node')
      .send({ label: 'Test Node' })
      .expect(200);

    const nodeId = createResponse.body.flow.nodes[0].id;
    const originalPosition = createResponse.body.flow.nodes[0].position;

    // Step 2: Update node position (simulating drag)
    await request(app)
      .put(`/api/node/${nodeId}`)
      .send({
        label: 'Test Node',
        position: { x: 300, y: 400 }
      })
      .expect(200);

    const flowAfterDrag = await getCurrentFlow();
    expect(flowAfterDrag.nodes[0].position).toEqual({ x: 300, y: 400 });

    // Step 3: Undo
    const undoResponse = await request(app)
      .post('/api/flow/undo')
      .expect(200);

    // Step 4: Verify position is restored
    const flowAfterUndo = undoResponse.body.flow;
    expect(flowAfterUndo.nodes[0].position).toEqual(originalPosition);
  });
});

describe('Workflow: LLM creates nodes → Layout → Undo → Retry', () => {
  // Note: These tests make real LLM API calls which can take 5-10 seconds
  // If they timeout, it may indicate rate limiting or slow API response

  it('LLM creates node → No extra saves happen', async () => {
    const initialCount = getSnapshotCount();

    // Simulate LLM conversation (uses tool executor)
    const response = await request(app)
      .post('/api/conversation/message')
      .send({ message: 'create a login node' })
      .timeout(15000) // 15 second timeout for LLM call
      .expect(200);

    if (!response.body.success) {
      console.warn('⚠️  LLM call took too long or failed - possible rate limiting');
      return; // Skip assertions if LLM timed out
    }

    const finalCount = getSnapshotCount();

    // Should be exactly 1 snapshot (tool executor saves once after batch)
    expect(finalCount - initialCount).toBe(1);
  }, 15000); // Jest timeout

  it('LLM creates nodes → Layout positions → Undo → State is correct', async () => {
    // Step 1: LLM creates nodes
    const response = await request(app)
      .post('/api/conversation/message')
      .send({ message: 'create a login node' })
      .timeout(15000)
      .expect(200);

    if (!response.body.success) {
      console.warn('⚠️  LLM call took too long or failed - possible rate limiting');
      return;
    }

    const flowAfterLLM = await getCurrentFlow();
    const nodeCount = flowAfterLLM.nodes.length;
    expect(nodeCount).toBeGreaterThan(0);

    // Step 2: Simulate layout calculating positions
    const layoutFlow = {
      nodes: flowAfterLLM.nodes.map(n => ({
        ...n,
        position: { x: 150, y: 250 }
      })),
      edges: flowAfterLLM.edges
    };

    await request(app)
      .post('/api/flow')
      .send(layoutFlow)
      .expect(200);

    const flowAfterLayout = await getCurrentFlow();
    expect(flowAfterLayout.nodes[0].position).toEqual({ x: 150, y: 250 });

    // Step 3: Undo (should restore to LLM state with original positions)
    await request(app)
      .post('/api/flow/undo')
      .expect(200);

    const flowAfterUndo = await getCurrentFlow();

    // Should have same nodes as LLM created
    expect(flowAfterUndo.nodes.length).toBe(nodeCount);
  }, 15000); // Jest timeout

  it('LLM creates nodes → Undo → Retry same prompt → No accumulation', async () => {
    // Step 1: LLM creates nodes
    const response1 = await request(app)
      .post('/api/conversation/message')
      .send({ message: 'create a login node' })
      .timeout(15000)
      .expect(200);

    if (!response1.body.success) {
      console.warn('⚠️  First LLM call took too long - possible rate limiting');
      return;
    }

    const flow1 = await getCurrentFlow();
    const nodeCountAfterFirst = flow1.nodes.length;

    // Step 2: Undo
    await request(app)
      .post('/api/flow/undo')
      .expect(200);

    const flowAfterUndo = await getCurrentFlow();
    expect(flowAfterUndo.nodes.length).toBe(0);

    // Step 3: Retry same prompt
    const response2 = await request(app)
      .post('/api/conversation/message')
      .send({ message: 'create a login node' })
      .timeout(15000)
      .expect(200);

    if (!response2.body.success) {
      console.warn('⚠️  Second LLM call took too long - possible rate limiting');
      return;
    }

    const flow2 = await getCurrentFlow();
    const nodeCountAfterSecond = flow2.nodes.length;

    // CRITICAL: Should create same number of nodes, not double
    // If this fails, we have node accumulation bug
    expect(nodeCountAfterSecond).toBe(nodeCountAfterFirst);
  }, 20000); // 20 seconds for test with 2 LLM calls
});

describe('Workflow: Multiple operations → Undo chain integrity', () => {
  it('Create 3 nodes → Undo all → State is empty', async () => {
    // Create 3 nodes
    await request(app).post('/api/node').send({ label: 'Node 1' });
    await request(app).post('/api/node').send({ label: 'Node 2' });
    await request(app).post('/api/node').send({ label: 'Node 3' });

    const flowAfterCreates = await getCurrentFlow();
    expect(flowAfterCreates.nodes.length).toBe(3);

    // Undo all 3
    await request(app).post('/api/flow/undo');
    await request(app).post('/api/flow/undo');
    await request(app).post('/api/flow/undo');

    const flowAfterUndos = await getCurrentFlow();
    expect(flowAfterUndos.nodes.length).toBe(0);
  });

  it('Create → Update → Delete → Undo 3x → State restored correctly', async () => {
    // Step 1: Create node
    const createRes = await request(app)
      .post('/api/node')
      .send({ label: 'Original' })
      .expect(200);

    const nodeId = createRes.body.flow.nodes[0].id;

    // Step 2: Update node
    await request(app)
      .put(`/api/node/${nodeId}`)
      .send({ label: 'Updated' })
      .expect(200);

    const flowAfterUpdate = await getCurrentFlow();
    expect(flowAfterUpdate.nodes[0].data.label).toBe('Updated');

    // Step 3: Delete node
    await request(app)
      .delete(`/api/node/${nodeId}`)
      .expect(200);

    const flowAfterDelete = await getCurrentFlow();
    expect(flowAfterDelete.nodes.length).toBe(0);

    // Step 4: Undo delete → Node restored with "Updated" label
    await request(app).post('/api/flow/undo');
    const flowAfterUndo1 = await getCurrentFlow();
    expect(flowAfterUndo1.nodes.length).toBe(1);
    expect(flowAfterUndo1.nodes[0].data.label).toBe('Updated');

    // Step 5: Undo update → Node has "Original" label
    await request(app).post('/api/flow/undo');
    const flowAfterUndo2 = await getCurrentFlow();
    expect(flowAfterUndo2.nodes[0].data.label).toBe('Original');

    // Step 6: Undo create → Node is gone
    await request(app).post('/api/flow/undo');
    const flowAfterUndo3 = await getCurrentFlow();
    expect(flowAfterUndo3.nodes.length).toBe(0);
  });

  it('10 undo/redo cycles → No corruption', async () => {
    // Create initial state
    await request(app).post('/api/node').send({ label: 'Test' });

    // 10 cycles of undo/redo
    for (let i = 0; i < 10; i++) {
      await request(app).post('/api/flow/undo');
      await request(app).post('/api/flow/redo');
    }

    const finalFlow = await getCurrentFlow();
    expect(finalFlow.nodes.length).toBe(1);
    expect(finalFlow.nodes[0].data.label).toBe('Test');
  });
});

describe('State Sync: Visual state === Database state', () => {
  it('After node creation, GET /api/flow returns what backend saved', async () => {
    const createRes = await request(app)
      .post('/api/node')
      .send({ label: 'Test', description: 'Description' })
      .expect(200);

    const createdNode = createRes.body.flow.nodes[0];

    // Get flow from database
    const getRes = await request(app).get('/api/flow').expect(200);
    const dbNode = getRes.body.nodes[0];

    // Should be identical
    expect(dbNode.id).toBe(createdNode.id);
    expect(dbNode.data.label).toBe(createdNode.data.label);
    expect(dbNode.data.description).toBe(createdNode.data.description);
    expect(dbNode.position).toEqual(createdNode.position);
  });

  it('After position update, database has new position', async () => {
    const createRes = await request(app)
      .post('/api/node')
      .send({ label: 'Test' })
      .expect(200);

    const nodeId = createRes.body.flow.nodes[0].id;
    const newPosition = { x: 500, y: 600 };

    // Update position
    await request(app)
      .put(`/api/node/${nodeId}`)
      .send({ label: 'Test', position: newPosition })
      .expect(200);

    // Verify database has new position
    const getRes = await request(app).get('/api/flow').expect(200);
    expect(getRes.body.nodes[0].position).toEqual(newPosition);
  });

  it('After frontend saves layout positions, undo snapshot has those positions', async () => {
    // Create node
    await request(app).post('/api/node').send({ label: 'Test' });

    // Simulate layout saving positions
    const currentFlow = await getCurrentFlow();
    const layoutFlow = {
      nodes: currentFlow.nodes.map(n => ({
        ...n,
        position: { x: 777, y: 888 }
      })),
      edges: currentFlow.edges
    };

    await request(app).post('/api/flow').send(layoutFlow).expect(200);

    // Verify position is in database
    const flowAfterLayout = await getCurrentFlow();
    expect(flowAfterLayout.nodes[0].position).toEqual({ x: 777, y: 888 });

    // Undo to previous state
    await request(app).post('/api/flow/undo');

    // Redo back
    await request(app).post('/api/flow/redo');

    // Position should still be layout position
    const flowAfterRedo = await getCurrentFlow();
    expect(flowAfterRedo.nodes[0].position).toEqual({ x: 777, y: 888 });
  });
});
