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

  it('should preserve horizontal layout matching Kay Adams scenario', () => {
    // Regression test based on actual bug: Kay Adams (y=50.75) -> child (y=0)
    // This reproduces the exact structure from the database
    const nodes = [
      // Vito in main group
      makeNode('vito', { parentGroupId: 'main-group', position: { x: 222, y: 130.75 } }),
      // Michael in nested sub-group
      makeNode('michael', { parentGroupId: 'sub-group', position: { x: 444, y: 61.5 } }),
      // Kay in main group (connected FROM Michael in different group)
      makeNode('kay', { parentGroupId: 'main-group', position: { x: 666, y: 50.75 } }),
      // Kay's child (THIS is where diagonal happens)
      makeNode('kay-child', { parentGroupId: 'main-group', position: { x: 888, y: 50.75 } }),
      // Groups
      makeNode('sub-group', { type: 'group', parentGroupId: 'main-group', hidden: true }),
      makeNode('main-group', { type: 'group', hidden: true }),
    ];

    const edges = [
      makeEdge('vito', 'michael'),
      makeEdge('michael', 'kay'),  // Cross-group edge
      makeEdge('kay', 'kay-child'),  // This should stay horizontal!
    ];

    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, 'LR');

    const kay = layoutedNodes.find(n => n.id === 'kay');
    const kayChild = layoutedNodes.find(n => n.id === 'kay-child');

    console.log('===== KAY ADAMS SCENARIO =====');
    console.log('Kay position:', kay.position);
    console.log('Kay child position:', kayChild.position);
    console.log('Y diff:', Math.abs(kayChild.position.y - kay.position.y));

    // Kay's child should be horizontally right, NOT diagonal
    expect(kayChild.position.y).toBeCloseTo(kay.position.y, 5);
  });
});
