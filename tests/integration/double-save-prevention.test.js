// ABOUTME: Tests for double-save prevention in save/snapshot system
// ABOUTME: Verifies that operations save exactly once, not multiple times

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import { closeDb, getDb } from '../../server/db.js';
import { executeToolCalls } from '../../server/tools/executor.js';
import { clearHistory } from '../../server/historyService.js';

let app;

beforeAll(async () => {
  process.env.DB_PATH = ':memory:';
  const serverModule = await import('../../server/server.js');
  app = serverModule.default || serverModule.app;
});

beforeEach(async () => {
  process.env.DB_PATH = ':memory:';
  await clearHistory();
});

afterEach(() => {
  closeDb();
});

/**
 * Helper: Get snapshot count from undo_history table
 */
async function getSnapshotCount() {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as count FROM undo_history').get();
  return result.count;
}

/**
 * Helper: Get current snapshot index
 */
async function getCurrentSnapshotIndex() {
  const db = getDb();
  const result = db.prepare('SELECT current_index FROM undo_state WHERE id = 1').get();
  return result?.current_index ?? -1;
}

describe('Double-save prevention', () => {
  it('should save exactly once when creating node via API', async () => {
    const initialCount = await getSnapshotCount();

    // Create node via API
    await request(app)
      .post('/api/node')
      .send({ label: 'Test Node' })
      .expect(200);

    const finalCount = await getSnapshotCount();
    const snapshotsCreated = finalCount - initialCount;

    // CRITICAL: Should be exactly 1, not 2 or more
    expect(snapshotsCreated).toBe(1);
  });

  it('should save exactly once when updating node via API', async () => {
    // Create node first
    const createResult = await executeToolCalls([
      { name: 'addNode', params: { label: 'Original' } }
    ]);
    const nodeId = createResult[0].nodeId;

    const initialCount = await getSnapshotCount();

    // Update node via API (skipSnapshot: true means no snapshot created)
    await request(app)
      .put(`/api/node/${nodeId}`)
      .send({ label: 'Updated' })
      .expect(200);

    const finalCount = await getSnapshotCount();
    const snapshotsCreated = finalCount - initialCount;

    // updateNode has skipSnapshot: true, so no snapshot should be created
    expect(snapshotsCreated).toBe(0);
  });

  it('should save exactly once when creating edge via API', async () => {
    // Create two nodes first
    const node1Result = await executeToolCalls([
      { name: 'addNode', params: { label: 'Node 1' } }
    ]);
    const node2Result = await executeToolCalls([
      { name: 'addNode', params: { label: 'Node 2' } }
    ]);

    const initialCount = await getSnapshotCount();

    // Create edge via API
    await request(app)
      .post('/api/edge')
      .send({
        sourceNodeId: node1Result[0].nodeId,
        targetNodeId: node2Result[0].nodeId,
        label: 'connects'
      })
      .expect(200);

    const finalCount = await getSnapshotCount();
    const snapshotsCreated = finalCount - initialCount;

    expect(snapshotsCreated).toBe(1);
  });

  it('should save exactly once when creating group via API', async () => {
    // Create two nodes first
    const node1Result = await executeToolCalls([
      { name: 'addNode', params: { label: 'Node 1' } }
    ]);
    const node2Result = await executeToolCalls([
      { name: 'addNode', params: { label: 'Node 2' } }
    ]);

    const initialCount = await getSnapshotCount();

    // Create group via API
    await request(app)
      .post('/api/group')
      .send({
        memberIds: [node1Result[0].nodeId, node2Result[0].nodeId],
        label: 'Test Group'
      })
      .expect(200);

    const finalCount = await getSnapshotCount();
    const snapshotsCreated = finalCount - initialCount;

    expect(snapshotsCreated).toBe(1);
  });

  it('should save exactly once when toggling group expansion via API', async () => {
    // Create group first
    const node1Result = await executeToolCalls([
      { name: 'addNode', params: { label: 'Node 1' } }
    ]);
    const node2Result = await executeToolCalls([
      { name: 'addNode', params: { label: 'Node 2' } }
    ]);
    const groupResult = await executeToolCalls([
      {
        name: 'createGroup',
        params: {
          memberIds: [node1Result[0].nodeId, node2Result[0].nodeId],
          label: 'Test Group'
        }
      }
    ]);

    const initialCount = await getSnapshotCount();

    // Toggle expansion via API
    await request(app)
      .put(`/api/group/${groupResult[0].groupId}/expand`)
      .send({ expand: true })
      .expect(200);

    const finalCount = await getSnapshotCount();
    const snapshotsCreated = finalCount - initialCount;

    expect(snapshotsCreated).toBe(1);
  });

  it('should save exactly once when LLM executes single tool', async () => {
    const initialCount = await getSnapshotCount();

    // Simulate LLM tool execution (what conversation endpoint does)
    await executeToolCalls([
      { name: 'addNode', params: { label: 'LLM Node' } }
    ]);

    const finalCount = await getSnapshotCount();
    const snapshotsCreated = finalCount - initialCount;

    expect(snapshotsCreated).toBe(1);
  });

  it('should save exactly once when LLM executes multiple tools', async () => {
    const initialCount = await getSnapshotCount();

    // Simulate LLM tool execution with multiple tools
    await executeToolCalls([
      { name: 'addNode', params: { label: 'Node 1' } },
      { name: 'addNode', params: { label: 'Node 2' } },
      { name: 'addNode', params: { label: 'Node 3' } }
    ]);

    const finalCount = await getSnapshotCount();
    const snapshotsCreated = finalCount - initialCount;

    // All tools in one batch = one save
    expect(snapshotsCreated).toBe(1);
  });

  it('should not create multiple snapshots for rapid API calls', async () => {
    const initialCount = await getSnapshotCount();

    // Make 3 rapid API calls
    await Promise.all([
      request(app).post('/api/node').send({ label: 'Node 1' }),
      request(app).post('/api/node').send({ label: 'Node 2' }),
      request(app).post('/api/node').send({ label: 'Node 3' })
    ]);

    const finalCount = await getSnapshotCount();
    const snapshotsCreated = finalCount - initialCount;

    // 3 separate operations = 3 snapshots (not 6!)
    expect(snapshotsCreated).toBe(3);
  });

  it('should maintain correct snapshot index after operations', async () => {
    const initialIndex = await getCurrentSnapshotIndex();

    // Create node
    await request(app)
      .post('/api/node')
      .send({ label: 'Test Node' })
      .expect(200);

    const currentIndex = await getCurrentSnapshotIndex();

    // Current index should have incremented by 1
    expect(currentIndex).toBeGreaterThan(initialIndex);
  });

  it('should not corrupt undo/redo chain with double-saves', async () => {
    // Create 3 snapshots
    await executeToolCalls([{ name: 'addNode', params: { label: 'Node 1' } }]);
    await executeToolCalls([{ name: 'addNode', params: { label: 'Node 2' } }]);
    await executeToolCalls([{ name: 'addNode', params: { label: 'Node 3' } }]);

    const totalSnapshots = await getSnapshotCount();
    expect(totalSnapshots).toBe(3);

    // Verify undo/redo works
    const { undo, redo, canUndo, canRedo } = await import('../../server/historyService.js');

    expect(await canUndo()).toBe(true);
    expect(await canRedo()).toBe(false);

    await undo();
    expect(await canUndo()).toBe(true);
    expect(await canRedo()).toBe(true);

    await redo();
    expect(await canUndo()).toBe(true);
    expect(await canRedo()).toBe(false);
  });
});
