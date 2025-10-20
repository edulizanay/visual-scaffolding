import { describe, it, expect } from 'vitest';
import { getLayoutedElements } from '../../../src/features/flow-canvas/hooks/useFlowLayout.js';

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
