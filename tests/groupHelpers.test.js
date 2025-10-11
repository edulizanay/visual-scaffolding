// ABOUTME: Tests for group helper functions in useFlowLayout.js
// ABOUTME: Covers descendant traversal, validation, and collapse/expand logic

import { describe, test, expect } from '@jest/globals';
import {
  getAllDescendantsByGroup,
  detectCircularReference,
  validateGroupMembership,
  getAffectedNodesForCollapse,
  getAffectedEdgesForCollapse,
} from '../src/hooks/useFlowLayout.js';

describe('getAllDescendantsByGroup', () => {
  test('finds direct children by parentGroupId', () => {
    const nodes = [
      { id: 'group-1', type: 'group' },
      { id: 'node-1', parentGroupId: 'group-1' },
      { id: 'node-2', parentGroupId: 'group-1' },
      { id: 'node-3' }, // not in group
    ];

    const descendants = getAllDescendantsByGroup('group-1', nodes);
    expect(descendants).toHaveLength(2);
    expect(descendants).toContain('node-1');
    expect(descendants).toContain('node-2');
  });

  test('finds nested descendants recursively', () => {
    const nodes = [
      { id: 'group-outer', type: 'group' },
      { id: 'group-inner', type: 'group', parentGroupId: 'group-outer' },
      { id: 'node-1', parentGroupId: 'group-outer' },
      { id: 'node-2', parentGroupId: 'group-inner' },
      { id: 'node-3', parentGroupId: 'group-inner' },
      { id: 'node-4' }, // not in any group
    ];

    const descendants = getAllDescendantsByGroup('group-outer', nodes);
    expect(descendants).toHaveLength(4); // group-inner, node-1, node-2, node-3
    expect(descendants).toContain('group-inner');
    expect(descendants).toContain('node-1');
    expect(descendants).toContain('node-2');
    expect(descendants).toContain('node-3');
  });

  test('returns empty array for non-existent nodeId', () => {
    const nodes = [
      { id: 'group-1', type: 'group' },
      { id: 'node-1', parentGroupId: 'group-1' },
    ];

    const descendants = getAllDescendantsByGroup('non-existent', nodes);
    expect(descendants).toEqual([]);
  });

  test('returns empty array for node with no children', () => {
    const nodes = [
      { id: 'group-1', type: 'group' },
      { id: 'node-1', parentGroupId: 'group-1' },
      { id: 'group-empty', type: 'group' }, // no children
    ];

    const descendants = getAllDescendantsByGroup('group-empty', nodes);
    expect(descendants).toEqual([]);
  });

  test('handles circular references gracefully (A->B, B->A)', () => {
    // This shouldn't happen if validation works, but test defensive code
    const nodes = [
      { id: 'group-a', type: 'group', parentGroupId: 'group-b' },
      { id: 'group-b', type: 'group', parentGroupId: 'group-a' },
      { id: 'node-1', parentGroupId: 'group-a' },
    ];

    // Should not infinite loop - must handle circular refs
    const descendants = getAllDescendantsByGroup('group-a', nodes);
    expect(descendants).toBeDefined();
    expect(Array.isArray(descendants)).toBe(true);
  });

  test('handles three-way circular reference (A->B->C->A)', () => {
    const nodes = [
      { id: 'group-a', type: 'group', parentGroupId: 'group-c' },
      { id: 'group-b', type: 'group', parentGroupId: 'group-a' },
      { id: 'group-c', type: 'group', parentGroupId: 'group-b' },
    ];

    const descendants = getAllDescendantsByGroup('group-a', nodes);
    expect(descendants).toBeDefined();
    expect(Array.isArray(descendants)).toBe(true);
  });

  test('handles deeply nested groups (5 levels)', () => {
    const nodes = [
      { id: 'level-1', type: 'group' },
      { id: 'level-2', type: 'group', parentGroupId: 'level-1' },
      { id: 'level-3', type: 'group', parentGroupId: 'level-2' },
      { id: 'level-4', type: 'group', parentGroupId: 'level-3' },
      { id: 'level-5', type: 'group', parentGroupId: 'level-4' },
      { id: 'leaf-node', parentGroupId: 'level-5' },
    ];

    const descendants = getAllDescendantsByGroup('level-1', nodes);
    expect(descendants).toHaveLength(5);
    expect(descendants).toContain('level-2');
    expect(descendants).toContain('level-3');
    expect(descendants).toContain('level-4');
    expect(descendants).toContain('level-5');
    expect(descendants).toContain('leaf-node');
  });
});

describe('detectCircularReference', () => {
  test('detects direct circular reference (A contains B, B contains A)', () => {
    const nodes = [
      { id: 'group-a', type: 'group', parentGroupId: 'group-b' },
      { id: 'group-b', type: 'group' },
    ];

    // Trying to make group-b a member of group-a creates circular ref
    const hasCircular = detectCircularReference('group-b', 'group-a', nodes);
    expect(hasCircular).toBe(true);
  });

  test('detects indirect circular reference (A->B->C->A)', () => {
    const nodes = [
      { id: 'group-a', type: 'group' },
      { id: 'group-b', type: 'group', parentGroupId: 'group-a' },
      { id: 'group-c', type: 'group', parentGroupId: 'group-b' },
    ];

    // Trying to make group-a a member of group-c creates A->B->C->A
    const hasCircular = detectCircularReference('group-a', 'group-c', nodes);
    expect(hasCircular).toBe(true);
  });

  test('allows valid parent-child relationship', () => {
    const nodes = [
      { id: 'group-a', type: 'group' },
      { id: 'group-b', type: 'group' },
      { id: 'node-1', parentGroupId: 'group-a' },
    ];

    // group-b can be a member of group-a (no circular ref)
    const hasCircular = detectCircularReference('group-b', 'group-a', nodes);
    expect(hasCircular).toBe(false);
  });

  test('prevents grouping node with its own descendant', () => {
    const nodes = [
      { id: 'group-a', type: 'group' },
      { id: 'group-b', type: 'group', parentGroupId: 'group-a' },
      { id: 'node-1', parentGroupId: 'group-b' },
    ];

    // Trying to make group-a a member of node-1 (descendant) is circular
    const hasCircular = detectCircularReference('group-a', 'node-1', nodes);
    expect(hasCircular).toBe(true);
  });

  test('returns false when potential parent is not in nodes array', () => {
    const nodes = [
      { id: 'group-a', type: 'group' },
    ];

    const hasCircular = detectCircularReference('group-a', 'non-existent', nodes);
    expect(hasCircular).toBe(false);
  });

  test('returns false when node itself is not in nodes array', () => {
    const nodes = [
      { id: 'group-a', type: 'group' },
    ];

    const hasCircular = detectCircularReference('non-existent', 'group-a', nodes);
    expect(hasCircular).toBe(false);
  });
});

describe('validateGroupMembership', () => {
  test('allows valid group with multiple unrelated nodes', () => {
    const nodes = [
      { id: 'node-1' },
      { id: 'node-2' },
      { id: 'node-3' },
    ];

    const result = validateGroupMembership(['node-1', 'node-2'], nodes);
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
  });

  test('prevents grouping a node with itself', () => {
    const nodes = [
      { id: 'node-1' },
    ];

    const result = validateGroupMembership(['node-1', 'node-1'], nodes);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('duplicate');
  });

  test('prevents grouping parent with its child', () => {
    const nodes = [
      { id: 'group-a', type: 'group' },
      { id: 'node-1', parentGroupId: 'group-a' },
    ];

    const result = validateGroupMembership(['group-a', 'node-1'], nodes);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('descendant');
  });

  test('prevents grouping grandparent with grandchild', () => {
    const nodes = [
      { id: 'group-a', type: 'group' },
      { id: 'group-b', type: 'group', parentGroupId: 'group-a' },
      { id: 'node-1', parentGroupId: 'group-b' },
    ];

    const result = validateGroupMembership(['group-a', 'node-1'], nodes);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('descendant');
  });

  test('prevents grouping with non-existent node', () => {
    const nodes = [
      { id: 'node-1' },
    ];

    const result = validateGroupMembership(['node-1', 'non-existent'], nodes);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('not found');
  });

  test('requires at least 2 nodes', () => {
    const nodes = [
      { id: 'node-1' },
    ];

    const result = validateGroupMembership(['node-1'], nodes);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least 2');
  });

  test('allows grouping sibling nodes from same parent group', () => {
    const nodes = [
      { id: 'group-a', type: 'group' },
      { id: 'node-1', parentGroupId: 'group-a' },
      { id: 'node-2', parentGroupId: 'group-a' },
    ];

    const result = validateGroupMembership(['node-1', 'node-2'], nodes);
    expect(result.valid).toBe(true);
  });
});

describe('getAffectedNodesForCollapse', () => {
  test('finds all nodes affected by collapse (direct children)', () => {
    const nodes = [
      { id: 'group-1', type: 'group' },
      { id: 'node-1', parentGroupId: 'group-1' },
      { id: 'node-2', parentGroupId: 'group-1' },
      { id: 'node-3' }, // not in group
    ];

    const affected = getAffectedNodesForCollapse('group-1', nodes);
    expect(affected).toHaveLength(2);
    expect(affected).toContain('node-1');
    expect(affected).toContain('node-2');
  });

  test('finds all nodes affected including nested groups', () => {
    const nodes = [
      { id: 'group-outer', type: 'group' },
      { id: 'group-inner', type: 'group', parentGroupId: 'group-outer' },
      { id: 'node-1', parentGroupId: 'group-outer' },
      { id: 'node-2', parentGroupId: 'group-inner' },
      { id: 'node-3', parentGroupId: 'group-inner' },
    ];

    const affected = getAffectedNodesForCollapse('group-outer', nodes);
    expect(affected).toHaveLength(4);
    expect(affected).toContain('group-inner');
    expect(affected).toContain('node-1');
    expect(affected).toContain('node-2');
    expect(affected).toContain('node-3');
  });

  test('returns empty array for group with no members', () => {
    const nodes = [
      { id: 'group-empty', type: 'group' },
      { id: 'node-1' },
    ];

    const affected = getAffectedNodesForCollapse('group-empty', nodes);
    expect(affected).toEqual([]);
  });

  test('returns empty array for non-existent group', () => {
    const nodes = [
      { id: 'node-1' },
    ];

    const affected = getAffectedNodesForCollapse('non-existent', nodes);
    expect(affected).toEqual([]);
  });
});

describe('getAffectedEdgesForCollapse', () => {
  test('finds edges connected to hidden nodes', () => {
    const hiddenNodeIds = ['node-1', 'node-2'];
    const edges = [
      { id: 'e1', source: 'node-1', target: 'node-3' },
      { id: 'e2', source: 'node-3', target: 'node-1' },
      { id: 'e3', source: 'node-2', target: 'node-4' },
      { id: 'e4', source: 'node-3', target: 'node-4' }, // not connected to hidden nodes
    ];

    const affected = getAffectedEdgesForCollapse(hiddenNodeIds, edges);
    expect(affected).toHaveLength(3);
    expect(affected).toContain('e1');
    expect(affected).toContain('e2');
    expect(affected).toContain('e3');
    expect(affected).not.toContain('e4');
  });

  test('returns empty array when no edges connected to hidden nodes', () => {
    const hiddenNodeIds = ['node-1', 'node-2'];
    const edges = [
      { id: 'e1', source: 'node-3', target: 'node-4' },
      { id: 'e2', source: 'node-5', target: 'node-6' },
    ];

    const affected = getAffectedEdgesForCollapse(hiddenNodeIds, edges);
    expect(affected).toEqual([]);
  });

  test('returns empty array for empty hiddenNodeIds', () => {
    const edges = [
      { id: 'e1', source: 'node-1', target: 'node-2' },
    ];

    const affected = getAffectedEdgesForCollapse([], edges);
    expect(affected).toEqual([]);
  });

  test('handles edges where both source and target are hidden', () => {
    const hiddenNodeIds = ['node-1', 'node-2'];
    const edges = [
      { id: 'e1', source: 'node-1', target: 'node-2' },
    ];

    const affected = getAffectedEdgesForCollapse(hiddenNodeIds, edges);
    expect(affected).toHaveLength(1);
    expect(affected).toContain('e1');
  });
});
