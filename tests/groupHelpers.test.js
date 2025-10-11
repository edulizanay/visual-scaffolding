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
      { id: 'group-a', type: 'group', isExpanded: false },
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
      { id: 'group-a', type: 'group', isExpanded: true },
      { id: 'node-1', parentGroupId: 'group-a', hidden: true },
    ];

    const { nodes: nextNodes } = applyGroupVisibility(nodes, []);
    const child = nextNodes.find((n) => n.id === 'node-1');

    expect(child.hidden).toBe(true);
    expect(child.groupHidden).toBe(false);
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
    expect(createdGroup.isExpanded).toBe(false);
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

    const expanded = toggleGroupExpansion(collapsed, 'group-1', true);
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

    const expanded = toggleGroupExpansion(collapsed, 'group-1', true);
    const ungrouped = ungroup(expanded, 'group-1');

    expect(ungrouped.nodes.find((node) => node.id === 'group-1')).toBeUndefined();
    const nodeA = ungrouped.nodes.find((node) => node.id === 'a');
    expect(nodeA.parentGroupId).toBeUndefined();

    const hasSyntheticEdges = ungrouped.edges.some(
      (edge) => edge.data?.isSyntheticGroupEdge
    );
    expect(hasSyntheticEdges).toBe(false);
  });
});
