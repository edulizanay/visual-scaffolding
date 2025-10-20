// ABOUTME: Unit tests for autoLayout tool executor
// ABOUTME: Validates position change detection, write behavior, and response metadata

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { executeTool, executeToolCalls } from '../server/tools/executor.js';
import { getFlow as dbGetFlow, closeDb } from '../server/db.js';
import { getHistoryStatus } from '../server/historyService.js';

async function getFlow() {
  return dbGetFlow();
}

beforeEach(() => {
  process.env.DB_PATH = ':memory:';
});

afterEach(() => {
  closeDb();
});

describe('executeAutoLayout', () => {

  describe('position change detection', () => {
    it('should write flow when positions change', async () => {
      // Create nodes first, then call autoLayout via executeToolCalls
      const results = await executeToolCalls([
        { name: 'addNode', params: { label: 'A' } },
        { name: 'addNode', params: { label: 'B', parentNodeId: 'a' } },
        { name: 'autoLayout', params: {} },
      ]);

      const autoLayoutResult = results[2];

      expect(autoLayoutResult.success).toBe(true);
      expect(autoLayoutResult.tool).toBe('autoLayout');
      expect(autoLayoutResult.updatedFlow).toBeDefined();

      // Verify positions are set (Dagre positions nodes, even if centered at x=0)
      const nodeA = autoLayoutResult.updatedFlow.nodes.find(n => n.id === 'a');
      const nodeB = autoLayoutResult.updatedFlow.nodes.find(n => n.id === 'b');

      expect(nodeA.position).toBeDefined();
      expect(nodeB.position).toBeDefined();
      expect(typeof nodeA.position.x).toBe('number');
      expect(typeof nodeB.position.x).toBe('number');

      // Verify flow was written to database (by executeToolCalls)
      const savedFlow = await getFlow();
      const savedA = savedFlow.nodes.find(n => n.id === 'a');
      expect(savedA).toBeDefined();
      expect(savedA.position.x).toBe(nodeA.position.x);

      // didChange should not be present (only set when no change)
      expect(autoLayoutResult.didChange).toBeUndefined();
    });

    it('should skip write when positions unchanged', async () => {
      // Create a flow with positions
      const initialFlow = {
        nodes: [
          { id: 'a', position: { x: 100, y: 50 }, data: { label: 'A' } },
          { id: 'b', position: { x: 300, y: 50 }, data: { label: 'B' } },
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b' },
        ],
      };

      // Run layout once to get deterministic positions
      const firstResult = await executeTool('autoLayout', {}, initialFlow);

      // Get history status before second layout
      const historyBefore = await getHistoryStatus();

      // Run layout again - positions should be the same
      const secondResult = await executeTool('autoLayout', {}, firstResult.updatedFlow);

      expect(secondResult.success).toBe(true);
      expect(secondResult.tool).toBe('autoLayout');
      expect(secondResult.didChange).toBe(false);

      // Verify no new snapshot was created
      const historyAfter = await getHistoryStatus();
      expect(historyAfter.canUndo).toBe(historyBefore.canUndo);
    });
  });

  describe('tool metadata', () => {
    it('should include tool field in response', async () => {
      const flow = {
        nodes: [
          { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } },
        ],
        edges: [],
      };

      const result = await executeTool('autoLayout', {}, flow);

      expect(result.tool).toBe('autoLayout');
    });

    it('should include didChange flag when no changes made', async () => {
      const flow = {
        nodes: [
          { id: 'a', position: { x: 100, y: 50 }, data: { label: 'A' } },
        ],
        edges: [],
      };

      // Run layout to get positioned flow
      const firstResult = await executeTool('autoLayout', {}, flow);

      // Run again - should detect no change
      const secondResult = await executeTool('autoLayout', {}, firstResult.updatedFlow);

      expect(secondResult.didChange).toBe(false);
    });
  });

  describe('empty flows', () => {
    it('should handle empty flow gracefully', async () => {
      const emptyFlow = {
        nodes: [],
        edges: [],
      };

      const result = await executeTool('autoLayout', {}, emptyFlow);

      expect(result.success).toBe(true);
      expect(result.tool).toBe('autoLayout');
      expect(result.updatedFlow.nodes).toEqual([]);
      expect(result.updatedFlow.edges).toEqual([]);
    });

    it('should handle single node flow', async () => {
      const flow = {
        nodes: [
          { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } },
        ],
        edges: [],
      };

      const result = await executeTool('autoLayout', {}, flow);

      expect(result.success).toBe(true);
      expect(result.updatedFlow.nodes).toHaveLength(1);
    });
  });

  describe('hidden nodes', () => {
    it('should preserve hidden node positions', async () => {
      const flow = {
        nodes: [
          { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } },
          { id: 'b', position: { x: 999, y: 999 }, data: { label: 'B' }, hidden: true },
          { id: 'c', position: { x: 0, y: 0 }, data: { label: 'C' } },
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'c' },
        ],
      };

      const result = await executeTool('autoLayout', {}, flow);

      expect(result.success).toBe(true);

      const hiddenNode = result.updatedFlow.nodes.find(n => n.id === 'b');
      expect(hiddenNode.position.x).toBe(999);
      expect(hiddenNode.position.y).toBe(999);
    });
  });

  describe('integration with other tools', () => {
    it('should work after addNode operations', async () => {
      let flow = {
        nodes: [],
        edges: [],
      };

      // Add some nodes
      const addResult1 = await executeTool('addNode', { label: 'First' }, flow);
      expect(addResult1.success).toBe(true);
      flow = addResult1.updatedFlow;

      const addResult2 = await executeTool('addNode', {
        label: 'Second',
        parentNodeId: addResult1.nodeId,
      }, flow);
      expect(addResult2.success).toBe(true);
      flow = addResult2.updatedFlow;

      // Apply layout
      const layoutResult = await executeTool('autoLayout', {}, flow);

      expect(layoutResult.success).toBe(true);
      expect(layoutResult.tool).toBe('autoLayout');

      // Nodes should be positioned in LR layout (left-to-right)
      const first = layoutResult.updatedFlow.nodes.find(n => n.id === addResult1.nodeId);
      const second = layoutResult.updatedFlow.nodes.find(n => n.id === addResult2.nodeId);

      expect(first.position).toBeDefined();
      expect(second.position).toBeDefined();
      // In LR layout, child should be to the right of parent
      expect(second.position.x).toBeGreaterThan(first.position.x);
    });
  });

  describe('idempotence', () => {
    it('should produce identical positions on repeated calls', async () => {
      const flow = {
        nodes: [
          { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } },
          { id: 'b', position: { x: 0, y: 0 }, data: { label: 'B' } },
          { id: 'c', position: { x: 0, y: 0 }, data: { label: 'C' } },
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'b', target: 'c' },
        ],
      };

      const result1 = await executeTool('autoLayout', {}, flow);
      const result2 = await executeTool('autoLayout', {}, result1.updatedFlow);
      const result3 = await executeTool('autoLayout', {}, result2.updatedFlow);

      // Second and third results should indicate no change
      expect(result2.didChange).toBe(false);
      expect(result3.didChange).toBe(false);

      // Positions should be identical
      result1.updatedFlow.nodes.forEach(node => {
        const node2 = result2.updatedFlow.nodes.find(n => n.id === node.id);
        const node3 = result3.updatedFlow.nodes.find(n => n.id === node.id);

        expect(node2.position.x).toBe(node.position.x);
        expect(node2.position.y).toBe(node.position.y);
        expect(node3.position.x).toBe(node.position.x);
        expect(node3.position.y).toBe(node.position.y);
      });
    });
  });
});
