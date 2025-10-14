import { describe, it, expect } from 'vitest';
import { getLayoutedElements } from '../../../src/hooks/useFlowLayout.js';
import { THEME } from '../../../src/constants/theme.js';

const makeNode = (id, overrides = {}) => ({
  id,
  type: 'default',
  data: {},
  position: { x: 0, y: 0 },
  hidden: false,
  groupHidden: false,
  ...overrides,
});

const makeEdge = (source, target, overrides = {}) => ({
  id: `${source}-${target}`,
  source,
  target,
  ...overrides,
});

describe('getLayoutedElements depth-aware expectations', () => {
  it('keeps each parent and direct child aligned on y within the same group', () => {
    const nodes = [
      makeNode('vito_corleone'),
      makeNode('sonny_corleone', { parentGroupId: 'group-sonny' }),
      makeNode('francesco_corleone', { parentGroupId: 'group-sonny' }),
      makeNode('sonny_heir', { parentGroupId: 'group-sonny' }),
      makeNode('group-sonny', {
        type: 'group',
        hidden: true,
        data: { label: 'Sonny lineage' },
      }),
    ];

    const edges = [
      makeEdge('vito_corleone', 'sonny_corleone'),
      makeEdge('sonny_corleone', 'francesco_corleone'),
      makeEdge('francesco_corleone', 'sonny_heir'),
    ];

    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, 'LR');

    const yById = Object.fromEntries(
      layoutedNodes
        .filter(node => !node.hidden && node.id !== 'vito_corleone')
        .map(node => [node.id, node.position.y]),
    );

    expect(yById.sonny_corleone).toBeCloseTo(yById.francesco_corleone, 5);
    expect(yById.francesco_corleone).toBeCloseTo(yById.sonny_heir, 5);
  });

  it('continues to enforce vertical spacing between true siblings', () => {
    const nodes = [
      makeNode('vito_corleone'),
      makeNode('sonny_corleone', { parentGroupId: 'group-sonny' }),
      makeNode('francesco_corleone', { parentGroupId: 'group-sonny' }),
      makeNode('group-sonny', {
        type: 'group',
        hidden: true,
        data: { label: 'Sonny lineage' },
      }),
    ];

    const edges = [
      makeEdge('vito_corleone', 'sonny_corleone'),
      makeEdge('vito_corleone', 'francesco_corleone'),
    ];

    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, 'LR');

    const sonny = layoutedNodes.find(node => node.id === 'sonny_corleone');
    const francesco = layoutedNodes.find(node => node.id === 'francesco_corleone');

    expect(sonny).toBeDefined();
    expect(francesco).toBeDefined();
    expect(Math.abs(sonny.position.y - francesco.position.y)).toBeCloseTo(
      THEME.groupNode.layout.memberVerticalGap,
      5,
    );
  });

  it('should compress true siblings at same X position', () => {
    // TDD Test: Verify that compression STILL works for true siblings
    // (nodes at the same X position within the same group)
    const nodes = [
      makeNode('parent', { parentGroupId: 'group1' }),
      // Three siblings - all at same depth, should be compressed
      makeNode('child-a', { parentGroupId: 'group1' }),
      makeNode('child-b', { parentGroupId: 'group1' }),
      makeNode('child-c', { parentGroupId: 'group1' }),
      makeNode('group1', { type: 'group', hidden: true }),
    ];

    const edges = [
      makeEdge('parent', 'child-a'),
      makeEdge('parent', 'child-b'),
      makeEdge('parent', 'child-c'),
    ];

    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, 'LR');

    const childA = layoutedNodes.find(n => n.id === 'child-a');
    const childB = layoutedNodes.find(n => n.id === 'child-b');
    const childC = layoutedNodes.find(n => n.id === 'child-c');

    expect(childA).toBeDefined();
    expect(childB).toBeDefined();
    expect(childC).toBeDefined();

    // All three should be at same X (same depth layer)
    expect(childA.position.x).toBeCloseTo(childB.position.x, 1);
    expect(childB.position.x).toBeCloseTo(childC.position.x, 1);

    // Should be vertically spaced by ~80px (memberVerticalGap)
    const gapAB = Math.abs(childB.position.y - childA.position.y);
    const gapBC = Math.abs(childC.position.y - childB.position.y);

    expect(gapAB).toBeCloseTo(THEME.groupNode.layout.memberVerticalGap, 5);
    expect(gapBC).toBeCloseTo(THEME.groupNode.layout.memberVerticalGap, 5);
  });

  it('should preserve horizontal layout matching Kay Adams scenario', () => {
    // TDD Test: This currently FAILS (diagonal bug), but should PASS after fix
    //
    // Bug: When kay has incoming cross-group edge from michael, buildGroupDepthMap
    // treats kay as a "root" (depth 0), causing unwanted compression with vito.
    //
    // Fix: Use X positions instead of calculated depths, so nodes at different X
    // layers never get compressed together.
    const nodes = [
      // Vito in main group
      makeNode('vito', { parentGroupId: 'main-group' }),
      // Michael in nested sub-group
      makeNode('michael', { parentGroupId: 'sub-group' }),
      // Kay in main group (has incoming cross-group edge from michael)
      makeNode('kay', { parentGroupId: 'main-group' }),
      // Kay's child - should stay horizontal with kay
      makeNode('kay-child', { parentGroupId: 'main-group' }),
      // Groups
      makeNode('sub-group', { type: 'group', parentGroupId: 'main-group', hidden: true }),
      makeNode('main-group', { type: 'group', hidden: true }),
    ];

    const edges = [
      makeEdge('vito', 'michael'),      // Cross-group edge
      makeEdge('michael', 'kay'),        // Cross-group edge (causes bug)
      makeEdge('kay', 'kay-child'),      // Within main-group
    ];

    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, 'LR');

    const kay = layoutedNodes.find(n => n.id === 'kay');
    const kayChild = layoutedNodes.find(n => n.id === 'kay-child');

    expect(kay).toBeDefined();
    expect(kayChild).toBeDefined();

    // Child should be to the RIGHT of parent
    expect(kayChild.position.x).toBeGreaterThan(kay.position.x);

    // Child should be at SAME vertical level as parent (not diagonal)
    // This currently FAILS but should PASS after fix
    expect(kayChild.position.y).toBeCloseTo(kay.position.y, 5);
  });
});
