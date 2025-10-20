// ABOUTME: Integration tests for drag-end position persistence
// ABOUTME: Tests backend position updates with origin metadata and snapshot creation

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
  await initializeHistory({ nodes: [], edges: [] });
});

afterEach(() => {
  closeDb();
});

/**
 * Get the most recent snapshot from undo_history
 */
function getLatestSnapshot() {
  const db = getDb();
  const result = db.prepare('SELECT snapshot FROM undo_history ORDER BY id DESC LIMIT 1').get();
  return result ? JSON.parse(result.snapshot) : null;
}

/**
 * Get snapshot count
 */
function getSnapshotCount() {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as count FROM undo_history').get();
  return result.count;
}

describe('Drag-end Position Persistence', () => {
  it('should create snapshot with ui.node.update origin when updating node position', async () => {
    // Create initial node (defaults to position {x: 0, y: 0})
    const createResponse = await request(app)
      .post('/api/node')
      .send({
        label: 'Draggable Node',
        description: ''
      })
      .expect(200);

    expect(createResponse.body.success).toBe(true);
    const nodeId = createResponse.body.nodeId;
    const initialCount = getSnapshotCount();

    // Update node position (simulating drag-end)
    const updateResponse = await request(app)
      .put(`/api/node/${nodeId}`)
      .send({ position: { x: 200, y: 250 } })
      .expect(200);

    expect(updateResponse.body.success).toBe(true);

    // Verify snapshot was created
    const finalCount = getSnapshotCount();
    expect(finalCount).toBe(initialCount + 1);

    // Verify snapshot has correct origin metadata
    const latestSnapshot = getLatestSnapshot();
    expect(latestSnapshot).toBeDefined();
    expect(latestSnapshot._meta).toBeDefined();
    expect(latestSnapshot._meta.origin).toBe('ui.node.update');

    // Verify position update is reflected in snapshot
    const updatedNode = latestSnapshot.nodes.find(n => n.id === nodeId);
    expect(updatedNode).toBeDefined();
    expect(updatedNode.position).toEqual({ x: 200, y: 250 });
  });

  it('should allow undo of position change', async () => {
    // Create initial node (defaults to position {x: 0, y: 0})
    const createResponse = await request(app)
      .post('/api/node')
      .send({
        label: 'Draggable Node',
        description: ''
      })
      .expect(200);

    const nodeId = createResponse.body.nodeId;

    // Update position
    await request(app)
      .put(`/api/node/${nodeId}`)
      .send({ position: { x: 200, y: 250 } })
      .expect(200);

    // Undo should restore original position (0, 0)
    const undoResponse = await request(app)
      .post('/api/flow/undo')
      .expect(200);

    expect(undoResponse.body.success).toBe(true);
    const nodeAfterUndo = undoResponse.body.flow.nodes.find(n => n.id === nodeId);
    expect(nodeAfterUndo.position).toEqual({ x: 0, y: 0 });
  });

  it('should handle multiple position updates with separate snapshots', async () => {
    // Create initial node (defaults to position {x: 0, y: 0})
    const createResponse = await request(app)
      .post('/api/node')
      .send({
        label: 'Draggable Node',
        description: ''
      })
      .expect(200);

    const nodeId = createResponse.body.nodeId;
    const initialCount = getSnapshotCount();

    // First position update
    await request(app)
      .put(`/api/node/${nodeId}`)
      .send({ position: { x: 150, y: 150 } })
      .expect(200);

    // Second position update
    await request(app)
      .put(`/api/node/${nodeId}`)
      .send({ position: { x: 200, y: 200 } })
      .expect(200);

    // Verify two new snapshots were created
    const finalCount = getSnapshotCount();
    expect(finalCount).toBe(initialCount + 2);

    // Undo twice should restore original position (0, 0)
    await request(app).post('/api/flow/undo').expect(200);
    const secondUndoResponse = await request(app).post('/api/flow/undo').expect(200);

    const nodeAfterUndo = secondUndoResponse.body.flow.nodes.find(n => n.id === nodeId);
    expect(nodeAfterUndo.position).toEqual({ x: 0, y: 0 });
  });

  it('should deduplicate identical position updates', async () => {
    // Create initial node (defaults to position {x: 0, y: 0})
    const createResponse = await request(app)
      .post('/api/node')
      .send({
        label: 'Draggable Node',
        description: ''
      })
      .expect(200);

    const nodeId = createResponse.body.nodeId;
    const initialCount = getSnapshotCount();

    // Update position
    await request(app)
      .put(`/api/node/${nodeId}`)
      .send({ position: { x: 200, y: 200 } })
      .expect(200);

    const afterFirstUpdate = getSnapshotCount();
    expect(afterFirstUpdate).toBe(initialCount + 1);

    // Update to same position again (should be deduplicated)
    await request(app)
      .put(`/api/node/${nodeId}`)
      .send({ position: { x: 200, y: 200 } })
      .expect(200);

    const afterSecondUpdate = getSnapshotCount();
    expect(afterSecondUpdate).toBe(afterFirstUpdate); // No new snapshot
  });
});
