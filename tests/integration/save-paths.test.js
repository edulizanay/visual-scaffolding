// ABOUTME: Tests verifying that each save path creates snapshots correctly
// ABOUTME: Ensures backend operations, LLM tools, and frontend saves all work

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import { getFlow as dbGetFlow } from '../../server/db.js';
import { executeToolCalls } from '../../server/tools/executor.js';
import { clearHistory, getHistoryStatus } from '../../server/historyService.js';
import { setupTestDb, cleanupTestDb, testSupabase } from '../test-db-setup.js';

let app;

beforeAll(async () => {
  const serverModule = await import('../../server/server.js');
  app = serverModule.default || serverModule.app;
});

beforeEach(async () => {
  await setupTestDb();
  await clearHistory();
});

afterEach(async () => {
  await cleanupTestDb();
});

/**
 * Helper: Get all snapshots from undo_history
 */
async function getAllSnapshots() {
  const { data: snapshots } = await testSupabase
    .from('undo_history')
    .select('id, snapshot')
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });

  return snapshots.map(row => ({
    id: row.id,
    data: row.snapshot
  }));
}

/**
 * Helper: Compare two flow states (ignoring positions for simplicity)
 */
function flowsAreDifferent(flow1, flow2) {
  if (flow1.nodes.length !== flow2.nodes.length) return true;
  if (flow1.edges.length !== flow2.edges.length) return true;

  // Check node labels differ
  const labels1 = flow1.nodes.map(n => n.data?.label).sort();
  const labels2 = flow2.nodes.map(n => n.data?.label).sort();

  return JSON.stringify(labels1) !== JSON.stringify(labels2);
}

describe('Save path verification', () => {
  describe('Backend operations create snapshots', () => {
    it('should create snapshot when adding node', async () => {
      const statusBefore = await getHistoryStatus();

      await executeToolCalls([
        { name: 'addNode', params: { label: 'Test Node' } }
      ]);

      const statusAfter = await getHistoryStatus();
      expect(statusAfter.snapshotCount).toBe(statusBefore.snapshotCount + 1);
    });

    it('should create snapshot when updating node', async () => {
      const createResult = await executeToolCalls([
        { name: 'addNode', params: { label: 'Original' } }
      ]);
      const nodeId = createResult[0].nodeId;

      const statusBefore = await getHistoryStatus();

      await executeToolCalls([
        { name: 'updateNode', params: { nodeId, label: 'Updated' } }
      ]);

      const statusAfter = await getHistoryStatus();
      expect(statusAfter.snapshotCount).toBe(statusBefore.snapshotCount + 1);
    });

    it('should create snapshot when deleting node', async () => {
      const createResult = await executeToolCalls([
        { name: 'addNode', params: { label: 'To Delete' } }
      ]);
      const nodeId = createResult[0].nodeId;

      const statusBefore = await getHistoryStatus();

      await executeToolCalls([
        { name: 'deleteNode', params: { nodeId } }
      ]);

      const statusAfter = await getHistoryStatus();
      expect(statusAfter.snapshotCount).toBe(statusBefore.snapshotCount + 1);
    });

    it('should create snapshot when adding edge', async () => {
      const node1 = await executeToolCalls([
        { name: 'addNode', params: { label: 'Node 1' } }
      ]);
      const node2 = await executeToolCalls([
        { name: 'addNode', params: { label: 'Node 2' } }
      ]);

      const statusBefore = await getHistoryStatus();

      await executeToolCalls([
        {
          name: 'addEdge',
          params: {
            sourceNodeId: node1[0].nodeId,
            targetNodeId: node2[0].nodeId
          }
        }
      ]);

      const statusAfter = await getHistoryStatus();
      expect(statusAfter.snapshotCount).toBe(statusBefore.snapshotCount + 1);
    });

    it('should create snapshot when creating group', async () => {
      const node1 = await executeToolCalls([
        { name: 'addNode', params: { label: 'Node 1' } }
      ]);
      const node2 = await executeToolCalls([
        { name: 'addNode', params: { label: 'Node 2' } }
      ]);

      const statusBefore = await getHistoryStatus();

      await executeToolCalls([
        {
          name: 'createGroup',
          params: {
            memberIds: [node1[0].nodeId, node2[0].nodeId],
            label: 'Group'
          }
        }
      ]);

      const statusAfter = await getHistoryStatus();
      expect(statusAfter.snapshotCount).toBe(statusBefore.snapshotCount + 1);
    });
  });

  describe('API operations create snapshots', () => {
    it('should create snapshot when POST /api/node', async () => {
      const statusBefore = await getHistoryStatus();

      await request(app)
        .post('/api/node')
        .send({ label: 'API Node' })
        .expect(200);

      const statusAfter = await getHistoryStatus();
      expect(statusAfter.snapshotCount).toBe(statusBefore.snapshotCount + 1);
    });

    it('should create snapshot when POST /api/edge', async () => {
      const node1 = await executeToolCalls([
        { name: 'addNode', params: { label: 'Node 1' } }
      ]);
      const node2 = await executeToolCalls([
        { name: 'addNode', params: { label: 'Node 2' } }
      ]);

      const statusBefore = await getHistoryStatus();

      await request(app)
        .post('/api/edge')
        .send({
          sourceNodeId: node1[0].nodeId,
          targetNodeId: node2[0].nodeId
        })
        .expect(200);

      const statusAfter = await getHistoryStatus();
      expect(statusAfter.snapshotCount).toBe(statusBefore.snapshotCount + 1);
    });

    it('should create snapshot when POST /api/group', async () => {
      const node1 = await executeToolCalls([
        { name: 'addNode', params: { label: 'Node 1' } }
      ]);
      const node2 = await executeToolCalls([
        { name: 'addNode', params: { label: 'Node 2' } }
      ]);

      const statusBefore = await getHistoryStatus();

      await request(app)
        .post('/api/group')
        .send({
          memberIds: [node1[0].nodeId, node2[0].nodeId]
        })
        .expect(200);

      const statusAfter = await getHistoryStatus();
      expect(statusAfter.snapshotCount).toBe(statusBefore.snapshotCount + 1);
    });
  });

  describe('LLM tool execution creates snapshots', () => {
    it('should create snapshot for single tool execution', async () => {
      const statusBefore = await getHistoryStatus();

      await executeToolCalls([
        { name: 'addNode', params: { label: 'LLM Node' } }
      ]);

      const statusAfter = await getHistoryStatus();
      expect(statusAfter.snapshotCount).toBe(statusBefore.snapshotCount + 1);
    });

    it('should create single snapshot for batched tools', async () => {
      const statusBefore = await getHistoryStatus();

      // Multiple tools in one LLM response = one batch = one snapshot
      await executeToolCalls([
        { name: 'addNode', params: { label: 'Node 1' } },
        { name: 'addNode', params: { label: 'Node 2' } },
        { name: 'addNode', params: { label: 'Node 3' } }
      ]);

      const statusAfter = await getHistoryStatus();
      expect(statusAfter.snapshotCount).toBe(statusBefore.snapshotCount + 1);
    });
  });

  describe('Snapshot content verification', () => {
    it('should store complete flow state in snapshot', async () => {
      // Create a node
      await executeToolCalls([
        { name: 'addNode', params: { label: 'Test Node', description: 'Test Description' } }
      ]);

      const snapshots = await getAllSnapshots();
      expect(snapshots.length).toBeGreaterThan(0);

      const latestSnapshot = snapshots[snapshots.length - 1];
      expect(latestSnapshot.data.nodes).toBeDefined();
      expect(latestSnapshot.data.edges).toBeDefined();
      expect(latestSnapshot.data.nodes.length).toBe(1);
      expect(latestSnapshot.data.nodes[0].data.label).toBe('Test Node');
    });

    it('should create distinct snapshots for different states', async () => {
      // Create 3 different states
      await executeToolCalls([{ name: 'addNode', params: { label: 'Node 1' } }]);
      await executeToolCalls([{ name: 'addNode', params: { label: 'Node 2' } }]);
      await executeToolCalls([{ name: 'addNode', params: { label: 'Node 3' } }]);

      const snapshots = await getAllSnapshots();
      expect(snapshots.length).toBe(3);

      // Each snapshot should be different
      expect(flowsAreDifferent(snapshots[0].data, snapshots[1].data)).toBe(true);
      expect(flowsAreDifferent(snapshots[1].data, snapshots[2].data)).toBe(true);
    });
  });

  describe('Snapshot deduplication', () => {
    it('should not create duplicate snapshots for identical states', async () => {
      // Create node
      await executeToolCalls([
        { name: 'addNode', params: { label: 'Test Node' } }
      ]);

      const statusBefore = await getHistoryStatus();
      const flowBefore = dbGetFlow();

      // Try to save identical state again (simulating autosave)
      const { pushSnapshot } = await import('../../server/historyService.js');
      await pushSnapshot(flowBefore);

      const statusAfter = await getHistoryStatus();

      // Should not create duplicate
      expect(statusAfter.snapshotCount).toBe(statusBefore.snapshotCount);
    });
  });

  describe('Manual save via POST /api/flow', () => {
    it('should create snapshot when manually saving flow', async () => {
      // Create initial state
      await executeToolCalls([
        { name: 'addNode', params: { label: 'Test Node' } }
      ]);

      const statusBefore = await getHistoryStatus();
      const flow = dbGetFlow();

      // Update position (simulate drag)
      flow.nodes[0].position = { x: 100, y: 200 };

      // Manual save
      await request(app)
        .post('/api/flow')
        .send(flow)
        .expect(200);

      const statusAfter = await getHistoryStatus();
      expect(statusAfter.snapshotCount).toBe(statusBefore.snapshotCount + 1);
    });

    it('should not create snapshot when skipSnapshot=true', async () => {
      // Create initial state
      await executeToolCalls([
        { name: 'addNode', params: { label: 'Test Node' } }
      ]);

      const statusBefore = await getHistoryStatus();
      const flow = dbGetFlow();

      // Manual save with skipSnapshot
      await request(app)
        .post('/api/flow?skipSnapshot=true')
        .send(flow)
        .expect(200);

      const statusAfter = await getHistoryStatus();
      expect(statusAfter.snapshotCount).toBe(statusBefore.snapshotCount);
    });
  });
});
