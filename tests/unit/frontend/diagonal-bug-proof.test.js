import { describe, it, expect } from 'vitest';
import { getLayoutedElements } from '../../../src/hooks/useFlowLayout.js';

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

// Manually implement buildGroupDepthMap logic to prove the diagnosis
const buildGroupDepthMapForTest = (nodes, edges) => {
  const depthById = new Map();
  const nodeById = new Map();
  nodes.forEach(node => nodeById.set(node.id, node));

  const visibleGroupMembers = new Map();
  nodes.forEach(node => {
    if (!node || node.hidden || node.groupHidden) return;
    if (!node.parentGroupId) return;
    const members = visibleGroupMembers.get(node.parentGroupId) ?? new Set();
    members.add(node.id);
    visibleGroupMembers.set(node.parentGroupId, members);
  });

  const incomingByGroup = new Map();
  const outgoingByGroup = new Map();

  // Process edges - ONLY edges where BOTH nodes have SAME parentGroupId
  edges.forEach(edge => {
    if (!edge) return;
    const sourceNode = nodeById.get(edge.source);
    const targetNode = nodeById.get(edge.target);
    if (!sourceNode || !targetNode) return;
    if (sourceNode.hidden || sourceNode.groupHidden) return;
    if (targetNode.hidden || targetNode.groupHidden) return;

    const groupId = sourceNode.parentGroupId;
    // THIS IS THE KEY LINE - filters out cross-group edges
    if (!groupId || groupId !== targetNode.parentGroupId) return;

    let outgoing = outgoingByGroup.get(groupId);
    if (!outgoing) {
      outgoing = new Map();
      outgoingByGroup.set(groupId, outgoing);
    }
    let children = outgoing.get(edge.source);
    if (!children) {
      children = new Set();
      outgoing.set(edge.source, children);
    }
    children.add(edge.target);

    let incoming = incomingByGroup.get(groupId);
    if (!incoming) {
      incoming = new Map();
      incomingByGroup.set(groupId, incoming);
    }
    let parents = incoming.get(edge.target);
    if (!parents) {
      parents = new Set();
      incoming.set(edge.target, parents);
    }
    parents.add(edge.source);
  });

  // Calculate depths
  visibleGroupMembers.forEach((memberSet, groupId) => {
    const members = Array.from(memberSet);
    const incoming = incomingByGroup.get(groupId) ?? new Map();
    const outgoing = outgoingByGroup.get(groupId) ?? new Map();

    // Find roots (nodes with no incoming edges within the group)
    const roots = members.filter(memberId => {
      const parents = incoming.get(memberId);
      return !parents || parents.size === 0;
    });

    console.log(`\n[PROOF] Group ${groupId}:`);
    console.log(`  Members: ${members.join(', ')}`);
    console.log(`  Roots (depth 0): ${roots.join(', ')}`);

    const queue = roots.length > 0
      ? roots.map(memberId => ({ id: memberId, depth: 0 }))
      : members.map(memberId => ({ id: memberId, depth: 0 }));

    const visited = new Set();
    const memberLookup = new Set(members);

    while (queue.length > 0) {
      const current = queue.shift();
      if (!current || visited.has(current.id)) continue;
      visited.add(current.id);
      depthById.set(current.id, current.depth);

      const children = outgoing.get(current.id);
      if (children && children.size > 0) {
        children.forEach(childId => {
          if (memberLookup.has(childId)) {
            queue.push({ id: childId, depth: current.depth + 1 });
          }
        });
      }
    }

    members.forEach(memberId => {
      if (!depthById.has(memberId)) {
        depthById.set(memberId, 0);
      }
    });

    // Show final depths
    console.log('  Final depths:');
    members.forEach(m => {
      console.log(`    ${m}: depth ${depthById.get(m)}`);
    });
  });

  return depthById;
};

describe('PROOF: Diagonal bug root cause', () => {
  it('proves that cross-group edges cause kay to be treated as root (depth 0)', () => {
    console.log('\n========================================');
    console.log('PROVING THE ROOT CAUSE OF DIAGONAL BUG');
    console.log('========================================');

    const nodes = [
      makeNode('vito', { parentGroupId: 'main-group' }),
      makeNode('michael', { parentGroupId: 'sub-group' }),
      makeNode('kay', { parentGroupId: 'main-group' }),
      makeNode('kay-child', { parentGroupId: 'main-group' }),
      makeNode('sub-group', { type: 'group', parentGroupId: 'main-group', hidden: true }),
      makeNode('main-group', { type: 'group', hidden: true }),
    ];

    const edges = [
      makeEdge('vito', 'michael'),    // Cross-group: main → sub
      makeEdge('michael', 'kay'),      // Cross-group: sub → main (THIS IS THE PROBLEM!)
      makeEdge('kay', 'kay-child'),    // Within main-group
    ];

    console.log('\nEdge analysis:');
    console.log('  vito → michael: cross-group (vito in main-group, michael in sub-group) → FILTERED OUT');
    console.log('  michael → kay: cross-group (michael in sub-group, kay in main-group) → FILTERED OUT');
    console.log('  kay → kay-child: same group (both in main-group) → PROCESSED');

    const depthMap = buildGroupDepthMapForTest(nodes, edges);

    console.log('\n========================================');
    console.log('ANALYSIS:');
    console.log('========================================');
    console.log('Because michael→kay edge is FILTERED OUT (cross-group),');
    console.log('kay has NO incoming edges within main-group,');
    console.log('so kay is treated as a ROOT (depth 0).');
    console.log('');
    console.log('This means:');
    console.log('  - vito: depth 0');
    console.log('  - kay: depth 0  ← WRONG! Should be depth 2 in global graph');
    console.log('  - kay-child: depth 1');
    console.log('');
    console.log('When compressGroupMembers runs:');
    console.log('  - Depth 0 has 2 nodes (vito, kay) → applies 80px vertical spacing');
    console.log('  - Depth 1 has 1 node (kay-child) → no compression (< 2 nodes)');
    console.log('');
    console.log('Result: kay gets pushed down by 40px, kay-child stays at Dagre position');
    console.log('→ DIAGONAL BUG: kay-child appears 40px ABOVE kay');
    console.log('========================================\n');

    // Verify the depths match our diagnosis
    expect(depthMap.get('vito')).toBe(0);
    expect(depthMap.get('kay')).toBe(0);  // ← This is the problem!
    expect(depthMap.get('kay-child')).toBe(1);

    // Now run the actual layout and prove the diagonal happens
    const { nodes: layoutedNodes } = getLayoutedElements(nodes, edges, 'LR');
    const kay = layoutedNodes.find(n => n.id === 'kay');
    const kayChild = layoutedNodes.find(n => n.id === 'kay-child');

    console.log('Actual layout result:');
    console.log(`  kay.y = ${kay.position.y}`);
    console.log(`  kay-child.y = ${kayChild.position.y}`);
    console.log(`  Difference: ${Math.abs(kayChild.position.y - kay.position.y)}px\n`);

    // This WILL fail, proving the bug exists
    expect(kayChild.position.y).not.toBeCloseTo(kay.position.y, 5);
    expect(Math.abs(kayChild.position.y - kay.position.y)).toBeGreaterThan(30);
  });
});
