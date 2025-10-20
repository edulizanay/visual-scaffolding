// ABOUTME: Unit tests for shared subtree helper functions
// ABOUTME: Tests getAllDescendants and collapseSubtreeByHandles pure functions
import { describe, it, expect } from 'vitest';
import { getAllDescendants, collapseSubtreeByHandles } from '../../../../shared/flowUtils/subtreeHelpers.js';

describe('getAllDescendants', () => {
  it('should return empty array when node not found', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }];
    const edges = [];
    const result = getAllDescendants('nonexistent', nodes, edges);
    expect(result).toEqual([]);
  });

  it('should return empty array when node has no children', () => {
    const nodes = [{ id: 'a' }, { id: 'b' }];
    const edges = [];
    const result = getAllDescendants('a', nodes, edges);
    expect(result).toEqual([]);
  });

  it('should return direct children', () => {
    const nodes = [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
    ];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'a', target: 'c' },
    ];
    const result = getAllDescendants('a', nodes, edges);
    expect(result).toHaveLength(2);
    expect(result.map(n => n.id)).toEqual(expect.arrayContaining(['b', 'c']));
  });

  it('should return all descendants recursively', () => {
    const nodes = [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
      { id: 'd' },
    ];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
      { source: 'c', target: 'd' },
    ];
    const result = getAllDescendants('a', nodes, edges);
    expect(result).toHaveLength(3);
    expect(result.map(n => n.id)).toEqual(['b', 'c', 'd']);
  });

  it('should handle branching hierarchies', () => {
    const nodes = [
      { id: 'root' },
      { id: 'child1' },
      { id: 'child2' },
      { id: 'grandchild1' },
      { id: 'grandchild2' },
    ];
    const edges = [
      { source: 'root', target: 'child1' },
      { source: 'root', target: 'child2' },
      { source: 'child1', target: 'grandchild1' },
      { source: 'child2', target: 'grandchild2' },
    ];
    const result = getAllDescendants('root', nodes, edges);
    expect(result).toHaveLength(4);
    expect(result.map(n => n.id)).toEqual(
      expect.arrayContaining(['child1', 'child2', 'grandchild1', 'grandchild2'])
    );
  });

  it('should not follow edges from other nodes', () => {
    const nodes = [
      { id: 'a' },
      { id: 'b' },
      { id: 'c' },
      { id: 'd' },
    ];
    const edges = [
      { source: 'a', target: 'b' },
      { source: 'c', target: 'd' }, // separate tree
    ];
    const result = getAllDescendants('a', nodes, edges);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('b');
  });
});

describe('collapseSubtreeByHandles', () => {
  it('should return unchanged flow when node not found', () => {
    const flow = {
      nodes: [{ id: 'a' }],
      edges: [],
    };
    const result = collapseSubtreeByHandles(flow, 'nonexistent', true);
    expect(result).toEqual(flow);
  });

  it('should set data.collapsed on parent node', () => {
    const flow = {
      nodes: [
        { id: 'a', data: {} },
        { id: 'b', data: {} },
      ],
      edges: [{ source: 'a', target: 'b' }],
    };
    const result = collapseSubtreeByHandles(flow, 'a', true);
    const parent = result.nodes.find(n => n.id === 'a');
    expect(parent.data.collapsed).toBe(true);
  });

  it('should hide descendants when collapsed', () => {
    const flow = {
      nodes: [
        { id: 'a', data: {} },
        { id: 'b', data: {} },
        { id: 'c', data: {} },
      ],
      edges: [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ],
    };
    const result = collapseSubtreeByHandles(flow, 'a', true);

    const nodeB = result.nodes.find(n => n.id === 'b');
    const nodeC = result.nodes.find(n => n.id === 'c');

    expect(nodeB.hidden).toBe(true);
    expect(nodeB.subtreeHidden).toBe(true);
    expect(nodeC.hidden).toBe(true);
    expect(nodeC.subtreeHidden).toBe(true);
  });

  it('should show descendants when expanded', () => {
    const flow = {
      nodes: [
        { id: 'a', data: { collapsed: true } },
        { id: 'b', data: {}, hidden: true, subtreeHidden: true },
        { id: 'c', data: {}, hidden: true, subtreeHidden: true },
      ],
      edges: [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ],
    };
    const result = collapseSubtreeByHandles(flow, 'a', false);

    const parent = result.nodes.find(n => n.id === 'a');
    const nodeB = result.nodes.find(n => n.id === 'b');
    const nodeC = result.nodes.find(n => n.id === 'c');

    expect(parent.data.collapsed).toBe(false);
    expect(nodeB.hidden).toBe(false);
    expect(nodeB.subtreeHidden).toBeUndefined();
    expect(nodeC.hidden).toBe(false);
    expect(nodeC.subtreeHidden).toBeUndefined();
  });

  it('should hide edges connected to hidden descendants', () => {
    const flow = {
      nodes: [
        { id: 'a', data: {} },
        { id: 'b', data: {} },
        { id: 'c', data: {} },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'c' },
      ],
    };
    const result = collapseSubtreeByHandles(flow, 'a', true);

    const edge1 = result.edges.find(e => e.id === 'e1');
    const edge2 = result.edges.find(e => e.id === 'e2');

    expect(edge1.hidden).toBe(true);
    expect(edge2.hidden).toBe(true);
  });

  it('should accept custom getDescendantsFn', () => {
    const flow = {
      nodes: [
        { id: 'a', data: {} },
        { id: 'b', data: {} },
        { id: 'c', data: {} },
      ],
      edges: [
        { source: 'a', target: 'b' },
        { source: 'b', target: 'c' },
      ],
    };

    // Custom function that only returns direct children (as IDs)
    const customGetDescendants = (nodeId, nodes, edges) => {
      return edges
        .filter(e => e.source === nodeId)
        .map(e => e.target);
    };

    const result = collapseSubtreeByHandles(flow, 'a', true, customGetDescendants);

    const nodeB = result.nodes.find(n => n.id === 'b');
    const nodeC = result.nodes.find(n => n.id === 'c');

    // Only B should be hidden (direct child), C should remain unaffected
    expect(nodeB.hidden).toBe(true);
    expect(nodeC.hidden).toBeUndefined();
  });

  it('should not affect unrelated nodes', () => {
    const flow = {
      nodes: [
        { id: 'a', data: {} },
        { id: 'b', data: {} },
        { id: 'unrelated', data: {} },
      ],
      edges: [
        { source: 'a', target: 'b' },
      ],
    };
    const result = collapseSubtreeByHandles(flow, 'a', true);

    const unrelated = result.nodes.find(n => n.id === 'unrelated');
    expect(unrelated.hidden).toBeUndefined();
    expect(unrelated.data).toEqual({});
  });

  it('should handle collapsing already collapsed subtree', () => {
    const flow = {
      nodes: [
        { id: 'a', data: { collapsed: true } },
        { id: 'b', data: {}, hidden: true, subtreeHidden: true },
      ],
      edges: [{ source: 'a', target: 'b' }],
    };
    const result = collapseSubtreeByHandles(flow, 'a', true);

    const parent = result.nodes.find(n => n.id === 'a');
    const child = result.nodes.find(n => n.id === 'b');

    expect(parent.data.collapsed).toBe(true);
    expect(child.hidden).toBe(true);
    expect(child.subtreeHidden).toBe(true);
  });
});
