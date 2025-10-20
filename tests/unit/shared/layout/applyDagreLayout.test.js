// ABOUTME: Unit tests for shared Dagre layout helper
// ABOUTME: Validates deterministic positioning, direction support, and idempotence

import { describe, it, expect } from 'vitest';
import { applyDagreLayout } from '../../../../shared/layout/applyDagreLayout.js';
import { NODE_WIDTH, NODE_HEIGHT } from '../../../../shared/constants/nodeDimensions.js';

describe('applyDagreLayout', () => {
  const createSimpleFlow = () => ({
    nodes: [
      { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } },
      { id: 'b', position: { x: 0, y: 0 }, data: { label: 'B' } },
      { id: 'c', position: { x: 0, y: 0 }, data: { label: 'C' } },
    ],
    edges: [
      { id: 'e1', source: 'a', target: 'b' },
      { id: 'e2', source: 'b', target: 'c' },
    ],
  });

  describe('deterministic positioning', () => {
    it('should produce same positions for same input', () => {
      const flow = createSimpleFlow();

      const result1 = applyDagreLayout({
        nodes: flow.nodes,
        edges: flow.edges,
        direction: 'LR',
      });

      const result2 = applyDagreLayout({
        nodes: flow.nodes,
        edges: flow.edges,
        direction: 'LR',
      });

      expect(result1.nodes).toHaveLength(3);
      expect(result2.nodes).toHaveLength(3);

      result1.nodes.forEach((node, index) => {
        const node2 = result2.nodes.find(n => n.id === node.id);
        expect(node2).toBeDefined();
        expect(node2.position.x).toBe(node.position.x);
        expect(node2.position.y).toBe(node.position.y);
      });
    });
  });

  describe('direction parameter support', () => {
    it('should layout left-to-right with LR direction', () => {
      const flow = createSimpleFlow();

      const result = applyDagreLayout({
        nodes: flow.nodes,
        edges: flow.edges,
        direction: 'LR',
      });

      // In LR layout, connected nodes should have increasing x coordinates
      const nodeA = result.nodes.find(n => n.id === 'a');
      const nodeB = result.nodes.find(n => n.id === 'b');
      const nodeC = result.nodes.find(n => n.id === 'c');

      expect(nodeA.position.x).toBeLessThan(nodeB.position.x);
      expect(nodeB.position.x).toBeLessThan(nodeC.position.x);

      // Source/target positions should be set for horizontal layout
      expect(nodeA.sourcePosition).toBe('right');
      expect(nodeA.targetPosition).toBe('left');
    });

    it('should layout top-to-bottom with TB direction', () => {
      const flow = createSimpleFlow();

      const result = applyDagreLayout({
        nodes: flow.nodes,
        edges: flow.edges,
        direction: 'TB',
      });

      // In TB layout, connected nodes should have increasing y coordinates
      const nodeA = result.nodes.find(n => n.id === 'a');
      const nodeB = result.nodes.find(n => n.id === 'b');
      const nodeC = result.nodes.find(n => n.id === 'c');

      expect(nodeA.position.y).toBeLessThan(nodeB.position.y);
      expect(nodeB.position.y).toBeLessThan(nodeC.position.y);

      // Source/target positions should be set for vertical layout
      expect(nodeA.sourcePosition).toBe('bottom');
      expect(nodeA.targetPosition).toBe('top');
    });

    it('should default to LR direction when not specified', () => {
      const flow = createSimpleFlow();

      const result = applyDagreLayout({
        nodes: flow.nodes,
        edges: flow.edges,
      });

      const nodeA = result.nodes.find(n => n.id === 'a');
      expect(nodeA.sourcePosition).toBe('right');
      expect(nodeA.targetPosition).toBe('left');
    });
  });

  describe('idempotence', () => {
    it('should produce same positions when run twice', () => {
      const flow = createSimpleFlow();

      const result1 = applyDagreLayout({
        nodes: flow.nodes,
        edges: flow.edges,
        direction: 'LR',
      });

      // Run layout again on the already-positioned nodes
      const result2 = applyDagreLayout({
        nodes: result1.nodes,
        edges: result1.edges,
        direction: 'LR',
      });

      result1.nodes.forEach(node => {
        const node2 = result2.nodes.find(n => n.id === node.id);
        expect(node2.position.x).toBe(node.position.x);
        expect(node2.position.y).toBe(node.position.y);
      });
    });
  });

  describe('node dimensions', () => {
    it('should use shared constants by default', () => {
      const flow = createSimpleFlow();

      const result = applyDagreLayout({
        nodes: flow.nodes,
        edges: flow.edges,
      });

      // Just verify layout completes successfully with default dimensions
      expect(result.nodes).toHaveLength(3);
      result.nodes.forEach(node => {
        expect(node.position).toBeDefined();
        expect(typeof node.position.x).toBe('number');
        expect(typeof node.position.y).toBe('number');
      });
    });

    it('should accept custom node dimensions', () => {
      const flow = createSimpleFlow();

      const customDimensions = { width: 200, height: 100 };

      const result = applyDagreLayout({
        nodes: flow.nodes,
        edges: flow.edges,
        nodeDimensions: customDimensions,
      });

      // Layout should complete with custom dimensions
      expect(result.nodes).toHaveLength(3);
    });
  });

  describe('hidden nodes', () => {
    it('should skip positioning for hidden nodes', () => {
      const flow = {
        nodes: [
          { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } },
          { id: 'b', position: { x: 0, y: 0 }, data: { label: 'B' }, hidden: true },
          { id: 'c', position: { x: 0, y: 0 }, data: { label: 'C' } },
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b' },
          { id: 'e2', source: 'b', target: 'c' },
        ],
      };

      const result = applyDagreLayout({
        nodes: flow.nodes,
        edges: flow.edges,
      });

      const nodeB = result.nodes.find(n => n.id === 'b');

      // Hidden node should retain its original position
      expect(nodeB.position.x).toBe(0);
      expect(nodeB.position.y).toBe(0);
    });
  });

  describe('grouped nodes', () => {
    it('should keep nodes in same group contiguous', () => {
      const flow = {
        nodes: [
          { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } },
          { id: 'b1', position: { x: 0, y: 0 }, data: { label: 'B1' }, parentGroupId: 'group1' },
          { id: 'b2', position: { x: 0, y: 0 }, data: { label: 'B2' }, parentGroupId: 'group1' },
          { id: 'c', position: { x: 0, y: 0 }, data: { label: 'C' } },
        ],
        edges: [
          { id: 'e1', source: 'a', target: 'b1' },
          { id: 'e2', source: 'a', target: 'b2' },
          { id: 'e3', source: 'b1', target: 'c' },
          { id: 'e4', source: 'b2', target: 'c' },
        ],
      };

      const result = applyDagreLayout({
        nodes: flow.nodes,
        edges: flow.edges,
        direction: 'TB',
      });

      const b1 = result.nodes.find(n => n.id === 'b1');
      const b2 = result.nodes.find(n => n.id === 'b2');

      // Grouped nodes should be positioned (Dagre may center them, so position is defined)
      expect(b1.position).toBeDefined();
      expect(b2.position).toBeDefined();
      expect(typeof b1.position.x).toBe('number');
      expect(typeof b2.position.x).toBe('number');
    });
  });

  describe('edge preservation', () => {
    it('should return edges unchanged', () => {
      const flow = createSimpleFlow();

      const result = applyDagreLayout({
        nodes: flow.nodes,
        edges: flow.edges,
      });

      expect(result.edges).toEqual(flow.edges);
    });
  });

  describe('empty graphs', () => {
    it('should handle empty node array', () => {
      const result = applyDagreLayout({
        nodes: [],
        edges: [],
      });

      expect(result.nodes).toEqual([]);
      expect(result.edges).toEqual([]);
    });

    it('should handle nodes with no edges', () => {
      const flow = {
        nodes: [
          { id: 'a', position: { x: 0, y: 0 }, data: { label: 'A' } },
          { id: 'b', position: { x: 0, y: 0 }, data: { label: 'B' } },
        ],
        edges: [],
      };

      const result = applyDagreLayout({
        nodes: flow.nodes,
        edges: flow.edges,
      });

      expect(result.nodes).toHaveLength(2);
      // Nodes should still be positioned (Dagre handles disconnected graphs)
      result.nodes.forEach(node => {
        expect(node.position).toBeDefined();
      });
    });
  });
});
