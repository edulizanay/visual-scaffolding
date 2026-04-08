// ABOUTME: Tests for race conditions between multiple save paths
// ABOUTME: Verifies concurrent operations don't corrupt state or undo/redo

import { describe, it, expect, beforeEach, afterEach, beforeAll } from 'vitest';
import request from 'supertest';
import { getFlow as dbGetFlow } from '../../server/db.js';
import { executeToolCalls } from '../../server/tools/executor.js';
import { clearHistory, getHistoryStatus, undo, redo } from '../../server/historyService.js';
import { setupTestDb, cleanupTestDb } from '../test-db-setup.js';

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
 * Helper: Verify flow integrity (no corruption)
 */
function verifyFlowIntegrity(flow) {
  expect(flow).toBeDefined();
  expect(flow.nodes).toBeDefined();
  expect(flow.edges).toBeDefined();
  expect(Array.isArray(flow.nodes)).toBe(true);
  expect(Array.isArray(flow.edges)).toBe(true);

  // Each node should have required fields
  flow.nodes.forEach(node => {
    expect(node.id).toBeDefined();
    expect(node.data).toBeDefined();
    expect(node.position).toBeDefined();
    expect(node.position.x).toBeDefined();
    expect(node.position.y).toBeDefined();
  });

  // Each edge should have required fields
  flow.edges.forEach(edge => {
    expect(edge.id).toBeDefined();
    expect(edge.source).toBeDefined();
    expect(edge.target).toBeDefined();

    // Source and target should exist in nodes
    const sourceExists = flow.nodes.some(n => n.id === edge.source);
    const targetExists = flow.nodes.some(n => n.id === edge.target);
    expect(sourceExists).toBe(true);
    expect(targetExists).toBe(true);
  });
}

describe('Save race conditions', () => {
  describe('Concurrent API operations', () => {
    it('should handle multiple simultaneous node creations', async () => {
      // Create 5 nodes simultaneously
      const promises = [
        request(app).post('/api/flow/node').send({ label: 'Node 1' }),
        request(app).post('/api/flow/node').send({ label: 'Node 2' }),
        request(app).post('/api/flow/node').send({ label: 'Node 3' }),
        request(app).post('/api/flow/node').send({ label: 'Node 4' }),
        request(app).post('/api/flow/node').send({ label: 'Node 5' })
      ];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(res => {
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      // Verify final state
      const finalFlow = dbGetFlow();
      expect(finalFlow.nodes.length).toBe(5);
      verifyFlowIntegrity(finalFlow);

      // Should have 5 snapshots (one per operation)
      const status = await getHistoryStatus();
      expect(status.snapshotCount).toBe(5);
    });

    it('should handle rapid updates to same node', async () => {
      // Create a node first
      const createResult = await executeToolCalls([
        { name: 'addNode', params: { label: 'Original' } }
      ]);
      const nodeId = createResult[0].nodeId;

      // Update it 3 times rapidly
      const promises = [
        request(app).put(`/api/flow/node/${nodeId}`).send({ label: 'Update 1' }),
        request(app).put(`/api/flow/node/${nodeId}`).send({ label: 'Update 2' }),
        request(app).put(`/api/flow/node/${nodeId}`).send({ label: 'Update 3' })
      ];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(res => {
        expect(res.status).toBe(200);
      });

      // Final state should be valid (one of the updates)
      const finalFlow = dbGetFlow();
      verifyFlowIntegrity(finalFlow);
      const node = finalFlow.nodes.find(n => n.id === nodeId);
      expect(node).toBeDefined();
      expect(['Update 1', 'Update 2', 'Update 3']).toContain(node.data.label);
    });

    it('should handle mixed operations simultaneously', async () => {
      // Create some initial nodes
      const node1 = await executeToolCalls([
        { name: 'addNode', params: { label: 'Node 1' } }
      ]);
      const node2 = await executeToolCalls([
        { name: 'addNode', params: { label: 'Node 2' } }
      ]);

      // Mix of different operations
      const promises = [
        request(app).post('/api/flow/node').send({ label: 'New Node' }),
        request(app).put(`/api/flow/node/${node1[0].nodeId}`).send({ label: 'Updated Node 1' }),
        request(app).post('/api/flow/edge').send({
          sourceNodeId: node1[0].nodeId,
          targetNodeId: node2[0].nodeId
        })
      ];

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(res => {
        expect(res.status).toBe(200);
      });

      // Verify final state is valid
      const finalFlow = dbGetFlow();
      verifyFlowIntegrity(finalFlow);
    });
  });

  describe('Operations during undo/redo', () => {
    it('should not corrupt undo chain when operation happens during undo', async () => {
      // Create 3 snapshots
      await executeToolCalls([{ name: 'addNode', params: { label: 'Node 1' } }]);
      await executeToolCalls([{ name: 'addNode', params: { label: 'Node 2' } }]);
      await executeToolCalls([{ name: 'addNode', params: { label: 'Node 3' } }]);

      // Undo once
      await undo();

      // Verify we can redo
      const statusAfterUndo = await getHistoryStatus();
      expect(statusAfterUndo.canRedo).toBe(true);

      // Now create a new node (should truncate redo chain)
      await executeToolCalls([{ name: 'addNode', params: { label: 'Node 4' } }]);

      // Redo should no longer be available
      const statusAfterNew = await getHistoryStatus();
      expect(statusAfterNew.canRedo).toBe(false);

      // Verify flow is valid
      const finalFlow = dbGetFlow();
      verifyFlowIntegrity(finalFlow);
    });

    it('should handle undo/redo being called rapidly', async () => {
      // Create 5 snapshots
      for (let i = 1; i <= 5; i++) {
        await executeToolCalls([{ name: 'addNode', params: { label: `Node ${i}` } }]);
      }

      // Rapid undo/redo sequence
      await undo();
      await undo();
      await redo();
      await undo();
      await redo();
      await redo();

      // Verify we're at a valid state
      const flow = dbGetFlow();
      verifyFlowIntegrity(flow);

      // Verify undo/redo state is consistent
      const status = await getHistoryStatus();
      expect(status.currentIndex).toBeGreaterThan(0);
      expect(status.currentIndex).toBeLessThanOrEqual(status.snapshotCount);
    });
  });

  describe('Position updates and saves', () => {
    it('should handle position updates without corrupting node data', async () => {
      // Create node
      const createResult = await executeToolCalls([
        { name: 'addNode', params: { label: 'Test Node', description: 'Test Description' } }
      ]);
      const nodeId = createResult[0].nodeId;

      // Update position multiple times
      for (let i = 0; i < 5; i++) {
        await executeToolCalls([
          {
            name: 'updateNode',
            params: {
              nodeId,
              position: { x: i * 100, y: i * 100 }
            }
          }
        ]);
      }

      // Verify node still has correct data
      const finalFlow = dbGetFlow();
      const node = finalFlow.nodes.find(n => n.id === nodeId);
      expect(node.data.label).toBe('Test Node');
      expect(node.data.description).toBe('Test Description');
      expect(node.position.x).toBe(400);
      expect(node.position.y).toBe(400);
    });

    it('should maintain position integrity through undo/redo', async () => {
      // Create node at (0, 0)
      const createResult = await executeToolCalls([
        { name: 'addNode', params: { label: 'Test Node' } }
      ]);
      const nodeId = createResult[0].nodeId;

      // Move to (100, 100)
      await executeToolCalls([
        {
          name: 'updateNode',
          params: {
            nodeId,
            position: { x: 100, y: 100 }
          }
        }
      ]);

      // Move to (200, 200)
      await executeToolCalls([
        {
          name: 'updateNode',
          params: {
            nodeId,
            position: { x: 200, y: 200 }
          }
        }
      ]);

      // Undo back to (100, 100)
      const undoResult = await undo();
      const nodeAfterUndo = undoResult.nodes.find(n => n.id === nodeId);
      expect(nodeAfterUndo.position.x).toBe(100);
      expect(nodeAfterUndo.position.y).toBe(100);

      // Redo back to (200, 200)
      const redoResult = await redo();
      const nodeAfterRedo = redoResult.nodes.find(n => n.id === nodeId);
      expect(nodeAfterRedo.position.x).toBe(200);
      expect(nodeAfterRedo.position.y).toBe(200);
    });
  });

  describe('Group operations race conditions', () => {
    it('should handle group creation and member modification', async () => {
      // Create nodes
      const node1 = await executeToolCalls([
        { name: 'addNode', params: { label: 'Node 1' } }
      ]);
      const node2 = await executeToolCalls([
        { name: 'addNode', params: { label: 'Node 2' } }
      ]);

      // Create group
      const groupResult = await executeToolCalls([
        {
          name: 'createGroup',
          params: {
            memberIds: [node1[0].nodeId, node2[0].nodeId],
            label: 'Group'
          }
        }
      ]);

      // Immediately try to update a member node
      await executeToolCalls([
        {
          name: 'updateNode',
          params: {
            nodeId: node1[0].nodeId,
            label: 'Updated Node 1'
          }
        }
      ]);

      // Verify group and member are both valid
      const finalFlow = dbGetFlow();
      verifyFlowIntegrity(finalFlow);

      const groupNode = finalFlow.nodes.find(n => n.id === groupResult[0].groupId);
      const memberNode = finalFlow.nodes.find(n => n.id === node1[0].nodeId);

      expect(groupNode).toBeDefined();
      expect(memberNode).toBeDefined();
      expect(memberNode.parentGroupId).toBe(groupResult[0].groupId);
      expect(memberNode.data.label).toBe('Updated Node 1');
    });

    it('should handle rapid group expand/collapse', async () => {
      // Create group
      const node1 = await executeToolCalls([
        { name: 'addNode', params: { label: 'Node 1' } }
      ]);
      const node2 = await executeToolCalls([
        { name: 'addNode', params: { label: 'Node 2' } }
      ]);
      const groupResult = await executeToolCalls([
        {
          name: 'createGroup',
          params: {
            memberIds: [node1[0].nodeId, node2[0].nodeId]
          }
        }
      ]);

      // Rapid toggle
      await executeToolCalls([
        { name: 'toggleGroupExpansion', params: { groupId: groupResult[0].groupId, expand: true } }
      ]);
      await executeToolCalls([
        { name: 'toggleGroupExpansion', params: { groupId: groupResult[0].groupId, expand: false } }
      ]);
      await executeToolCalls([
        { name: 'toggleGroupExpansion', params: { groupId: groupResult[0].groupId, expand: true } }
      ]);

      // Verify final state
      const finalFlow = dbGetFlow();
      verifyFlowIntegrity(finalFlow);

      const groupNode = finalFlow.nodes.find(n => n.id === groupResult[0].groupId);
      expect(groupNode.isCollapsed).toBe(false); // Should be expanded
    });
  });

  describe('Snapshot limit enforcement', () => {
    it('should not corrupt state when reaching 50 snapshot limit', async () => {
      // Create 52 snapshots (exceeds limit of 50)
      for (let i = 1; i <= 52; i++) {
        await executeToolCalls([
          { name: 'addNode', params: { label: `Node ${i}` } }
        ]);
      }

      // Verify only 50 snapshots remain
      const status = await getHistoryStatus();
      expect(status.snapshotCount).toBe(50);

      // Verify current flow is valid
      const flow = dbGetFlow();
      verifyFlowIntegrity(flow);
      expect(flow.nodes.length).toBe(52);

      // Verify undo still works
      const undoResult = await undo();
      expect(undoResult).not.toBeNull();
      verifyFlowIntegrity(undoResult);
    });
  });
});
