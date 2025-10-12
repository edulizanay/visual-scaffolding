// ABOUTME: Tests for group utility functions controlling grouping behavior
// ABOUTME: Validates descendants, validation, visibility, and group state transitions

import { describe, test, expect } from '@jest/globals';
import {
  getGroupDescendants,
  detectCircularReference,
  validateGroupMembership,
  applyGroupVisibility,
  createGroup,
  toggleGroupExpansion,
  ungroup,
  getExpandedGroupHalos,
  collapseSubtreeByHandles,
} from '../src/utils/groupUtils.js';

describe('getGroupDescendants', () => {
  test('finds direct children by parentGroupId', () => {
    const nodes = [
      { id: 'group-1', type: 'group' },
      { id: 'node-1', parentGroupId: 'group-1' },
      { id: 'node-2', parentGroupId: 'group-1' },
      { id: 'node-3' },
    ];

    const descendants = getGroupDescendants('group-1', nodes);
    expect(descendants).toHaveLength(2);
    expect(descendants).toEqual(expect.arrayContaining(['node-1', 'node-2']));
  });

  test('finds nested descendants recursively', () => {
    const nodes = [
      { id: 'group-outer', type: 'group' },
      { id: 'group-inner', type: 'group', parentGroupId: 'group-outer' },
      { id: 'node-1', parentGroupId: 'group-outer' },
      { id: 'node-2', parentGroupId: 'group-inner' },
    ];

    const descendants = getGroupDescendants('group-outer', nodes);
    expect(descendants).toEqual(expect.arrayContaining(['group-inner', 'node-1', 'node-2']));
  });

  test('returns empty array when group is missing', () => {
    const nodes = [{ id: 'group-1', type: 'group' }];
    expect(getGroupDescendants('missing', nodes)).toEqual([]);
  });

  test('guards against circular references', () => {
    const nodes = [
      { id: 'group-a', type: 'group', parentGroupId: 'group-b' },
      { id: 'group-b', type: 'group', parentGroupId: 'group-a' },
    ];

    const descendants = getGroupDescendants('group-a', nodes);
    expect(Array.isArray(descendants)).toBe(true);
  });
});

describe('getExpandedGroupHalos', () => {
  const dimensions = (node) => ({
    width: node.width ?? 200,
    height: node.height ?? 120,
  });

  test('returns empty array when no groups are expanded', () => {
    const nodes = [
      { id: 'group-1', type: 'group', isCollapsed: true },
      { id: 'a', parentGroupId: 'group-1', position: { x: 0, y: 0 }, width: 100, height: 60 },
    ];

    const halos = getExpandedGroupHalos(nodes, dimensions, 16);
    expect(halos).toEqual([]);
  });

  test('computes padded bounding box for expanded group', () => {
    const nodes = [
      { id: 'group-1', type: 'group', isCollapsed: false, data: { label: 'Checkout' } },
      { id: 'a', parentGroupId: 'group-1', position: { x: 100, y: 100 }, width: 120, height: 80 },
      { id: 'b', parentGroupId: 'group-1', position: { x: 300, y: 220 }, width: 140, height: 100 },
    ];

    const halos = getExpandedGroupHalos(nodes, dimensions, 20);
    expect(halos).toHaveLength(1);
    expect(halos[0].groupId).toBe('group-1');
    expect(halos[0].label).toBe('Checkout');
    // Bounding box should include padding on all sides
    expect(halos[0].bounds).toEqual({
      x: 80,
      y: 80,
      width: 380,
      height: 260,
    });
  });

  test('includes nested descendants in bounding box', () => {
    const nodes = [
      { id: 'group-outer', type: 'group', isCollapsed: false },
      { id: 'group-inner', type: 'group', parentGroupId: 'group-outer', isCollapsed: true, position: { x: 400, y: 200 }, width: 150, height: 120 },
      { id: 'node-1', parentGroupId: 'group-inner', position: { x: 450, y: 260 }, width: 80, height: 50 },
    ];

    const halos = getExpandedGroupHalos(nodes, dimensions, 10);
    expect(halos).toHaveLength(1);
    const bounds = halos[0].bounds;
    expect(bounds.x).toBe(390);
    expect(bounds.y).toBe(190);
    expect(bounds.width).toBe(170);
    expect(bounds.height).toBe(140);
  });
});

describe('detectCircularReference', () => {
  test('detects direct circular reference', () => {
    const nodes = [
      { id: 'group-a', type: 'group', parentGroupId: 'group-b' },
      { id: 'group-b', type: 'group' },
    ];

    expect(detectCircularReference('group-b', 'group-a', nodes)).toBe(true);
  });

  test('detects indirect circular reference', () => {
    const nodes = [
      { id: 'group-a', type: 'group' },
      { id: 'group-b', type: 'group', parentGroupId: 'group-a' },
      { id: 'group-c', type: 'group', parentGroupId: 'group-b' },
    ];

    expect(detectCircularReference('group-a', 'group-c', nodes)).toBe(true);
  });

  test('allows valid parent-child relationship', () => {
    const nodes = [
      { id: 'group-a', type: 'group' },
      { id: 'group-b', type: 'group' },
    ];

    expect(detectCircularReference('group-b', 'group-a', nodes)).toBe(false);
  });
});

describe('validateGroupMembership', () => {
  test('allows valid grouping', () => {
    const nodes = [
      { id: 'node-1' },
      { id: 'node-2' },
    ];

    const result = validateGroupMembership(['node-1', 'node-2'], nodes);
    expect(result.valid).toBe(true);
  });

  test('prevents duplicate node grouping', () => {
    const nodes = [{ id: 'node-1' }];
    const result = validateGroupMembership(['node-1', 'node-1'], nodes);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('duplicate');
  });

  test('prevents grouping ancestor with descendant', () => {
    const nodes = [
      { id: 'group-a', type: 'group' },
      { id: 'node-1', parentGroupId: 'group-a' },
    ];

    const result = validateGroupMembership(['group-a', 'node-1'], nodes);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('descendant');
  });
});

describe('applyGroupVisibility', () => {
  test('hides descendants of collapsed group', () => {
    const nodes = [
      { id: 'group-a', type: 'group', isCollapsed: true },
      { id: 'node-1', parentGroupId: 'group-a', hidden: false },
    ];

    const edges = [];
    const { nodes: nextNodes } = applyGroupVisibility(nodes, edges);

    const child = nextNodes.find((n) => n.id === 'node-1');
    expect(child.hidden).toBe(true);
    expect(child.groupHidden).toBe(true);
  });

  test('preserves hidden state from other features', () => {
    const nodes = [
      { id: 'group-a', type: 'group', isCollapsed: false },
      { id: 'node-1', parentGroupId: 'group-a', hidden: true },
    ];

    const { nodes: nextNodes } = applyGroupVisibility(nodes, []);
    const child = nextNodes.find((n) => n.id === 'node-1');

    expect(child.hidden).toBe(true);
    expect(child.groupHidden).toBe(false);
  });

  test('collapsing parent group hides nested group wrapper', () => {
    const nodes = [
      { id: 'outer', type: 'group', isCollapsed: true },
      { id: 'inner', type: 'group', parentGroupId: 'outer', isCollapsed: false },
      { id: 'leaf', parentGroupId: 'inner' },
    ];

    const { nodes: nextNodes } = applyGroupVisibility(nodes, []);
    const innerGroup = nextNodes.find((n) => n.id === 'inner');

    expect(innerGroup.hidden).toBe(true);
    expect(innerGroup.groupHidden).toBe(true);
  });
});

describe('createGroup / toggleGroupExpansion / ungroup', () => {
  const baseFlow = {
    nodes: [
      { id: 'a', position: { x: 0, y: 0 }, data: {} },
      { id: 'b', position: { x: 100, y: 0 }, data: {} },
      { id: 'c', position: { x: 200, y: 0 }, data: {} },
    ],
    edges: [
      { id: 'e-a-b', source: 'a', target: 'b', data: {} },
      { id: 'e-b-c', source: 'b', target: 'c', data: {} },
    ],
  };

  const edgeFactory = ({ id, source, target }) => ({
    id,
    source,
    target,
    type: 'smoothstep',
    data: { isCustom: true },
  });

  test('createGroup assigns parentGroupId, hides members, and adds synthetic edges', () => {
    const groupNode = {
      id: 'group-1',
      type: 'group',
      position: { x: 50, y: -100 },
      data: { label: 'Group 1' },
    };

    const result = createGroup(baseFlow, {
      groupNode,
      memberIds: ['a', 'b'],
      collapse: true,
      edgeFactory,
    });

    const createdGroup = result.nodes.find((node) => node.id === 'group-1');
    const nodeA = result.nodes.find((node) => node.id === 'a');

    expect(createdGroup).toBeDefined();
    expect(createdGroup.isCollapsed).toBe(true);
    expect(createdGroup.hidden).toBe(false);
    expect(nodeA.parentGroupId).toBe('group-1');
    expect(nodeA.hidden).toBe(true);

    const syntheticEdges = result.edges.filter(
      (edge) => edge.data?.isSyntheticGroupEdge === true
    );
    expect(syntheticEdges).not.toHaveLength(0);
  });

  test('toggleGroupExpansion shows members when expanding', () => {
    const groupNode = {
      id: 'group-1',
      type: 'group',
      position: { x: 50, y: -100 },
      data: { label: 'Group 1' },
    };

    const collapsed = createGroup(baseFlow, {
      groupNode,
      memberIds: ['a', 'b'],
      collapse: true,
      edgeFactory,
    });

    const expanded = toggleGroupExpansion(collapsed, 'group-1', false);
    const nodeA = expanded.nodes.find((node) => node.id === 'a');
    const groupNodeAfterExpand = expanded.nodes.find((node) => node.id === 'group-1');

    expect(nodeA.hidden).toBe(false);
    expect(nodeA.groupHidden).toBe(false);
    expect(groupNodeAfterExpand.hidden).toBe(true);
    expect(groupNodeAfterExpand.groupHidden).toBe(false);
  });

  test('ungroup removes group node, restores parentGroupId, and removes synthetic edges', () => {
    const groupNode = {
      id: 'group-1',
      type: 'group',
      position: { x: 50, y: -100 },
      data: { label: 'Group 1' },
    };

    const collapsed = createGroup(baseFlow, {
      groupNode,
      memberIds: ['a', 'b'],
      collapse: true,
      edgeFactory,
    });

    const expanded = toggleGroupExpansion(collapsed, 'group-1', false);
    const ungrouped = ungroup(expanded, 'group-1');

    expect(ungrouped.nodes.find((node) => node.id === 'group-1')).toBeUndefined();
    const nodeA = ungrouped.nodes.find((node) => node.id === 'a');
    expect(nodeA.parentGroupId).toBeUndefined();

    const hasSyntheticEdges = ungrouped.edges.some(
      (edge) => edge.data?.isSyntheticGroupEdge
    );
    expect(hasSyntheticEdges).toBe(false);
  });

  test('collapsing nested groups removes halos for hidden children', () => {
    const initial = createGroup(baseFlow, {
      groupNode: { id: 'group-1', type: 'group', position: { x: 50, y: -100 }, data: { label: 'Outer' } },
      memberIds: ['a', 'b'],
      collapse: false,
      edgeFactory,
    });

    const withInner = createGroup(initial, {
      groupNode: { id: 'group-2', type: 'group', position: { x: 60, y: -50 }, data: { label: 'Inner' } },
      memberIds: ['a'],
      collapse: false,
      edgeFactory,
    });

    // Nest inner group under outer manually to simulate UI grouping inside parent
    withInner.nodes = withInner.nodes.map((node) =>
      node.id === 'group-2' ? { ...node, parentGroupId: 'group-1' } : node
    );

    const collapsedOuter = toggleGroupExpansion(withInner, 'group-1', true);
    const halos = getExpandedGroupHalos(collapsedOuter.nodes, (node) => ({ width: 180, height: 100 }), 16);

    expect(halos.find((halo) => halo.groupId === 'group-2')).toBeUndefined();
  });
});

describe('collapseSubtreeByHandles', () => {
  test('hides descendant nodes and edges when collapsing', () => {
    const flow = {
      nodes: [
        { id: 'root', data: { collapsed: false } },
        { id: 'child', data: {}, parentGroupId: null },
      ],
      edges: [
        { id: 'e1', source: 'root', target: 'child' },
      ],
    };

    const result = collapseSubtreeByHandles(
      flow,
      'root',
      true,
      () => ['child']
    );
    const child = result.nodes.find((n) => n.id === 'child');
    const edge = result.edges.find((e) => e.id === 'e1');

    expect(child.hidden).toBe(true);
    expect(edge.hidden).toBe(true);
  });
});
