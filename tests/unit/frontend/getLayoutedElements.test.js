import { describe, it, expect } from '@jest/globals';
import { getLayoutedElements } from '../../../src/hooks/useFlowLayout.js';
import { THEME } from '../../../src/constants/theme.jsx';

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
});
