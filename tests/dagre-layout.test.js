// ABOUTME: Isolated test for Dagre layout algorithm
// ABOUTME: Verifies LR layout works without touching production files

import fs from 'fs';
import path from 'path';
import dagre from '@dagrejs/dagre';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const nodeWidth = 172;
const nodeHeight = 36;

function getLayoutedElements(nodes, edges, direction = 'TB') {
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  const isHorizontal = direction === 'LR';

  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
}

describe('Dagre Layout', () => {
  test('should layout grandfather->father->son in LR hierarchy', () => {
    // Read current production flow.json
    const flowPath = path.join(__dirname, '../server/data/flow.json');
    const flowData = JSON.parse(fs.readFileSync(flowPath, 'utf-8'));

    // Create copy (don't modify original)
    const nodesCopy = JSON.parse(JSON.stringify(flowData.nodes));
    const edgesCopy = JSON.parse(JSON.stringify(flowData.edges));

    console.log('\n=== BEFORE LAYOUT ===');
    nodesCopy.forEach(node => {
      console.log(`${node.data.label}: x=${node.position.x.toFixed(2)}, y=${node.position.y.toFixed(2)}`);
    });

    // Run layout
    const { nodes: layoutedNodes, edges: layoutedEdges } = getLayoutedElements(
      nodesCopy,
      edgesCopy,
      'LR'
    );

    console.log('\n=== AFTER LAYOUT ===');
    layoutedNodes.forEach(node => {
      console.log(`${node.data.label}: x=${node.position.x.toFixed(2)}, y=${node.position.y.toFixed(2)}`);
    });

    // Verify results
    const grandfather = layoutedNodes.find(n => n.data.label === 'grandfather');
    const father = layoutedNodes.find(n => n.data.label === 'father');
    const son = layoutedNodes.find(n => n.data.label === 'son');

    // Assertions
    expect(grandfather).toBeDefined();
    expect(father).toBeDefined();
    expect(son).toBeDefined();

    // Verify LR hierarchy (x positions increase)
    expect(father.position.x).toBeGreaterThan(grandfather.position.x);
    expect(son.position.x).toBeGreaterThan(father.position.x);

    // Verify no overlap (nodes spread out)
    const xPositions = layoutedNodes.map(n => n.position.x);
    const uniqueXPositions = new Set(xPositions);
    expect(uniqueXPositions.size).toBe(layoutedNodes.length);

    // Verify source/target positions set correctly for LR
    layoutedNodes.forEach(node => {
      expect(node.sourcePosition).toBe('right');
      expect(node.targetPosition).toBe('left');
    });

    // Verify edges preserved
    expect(layoutedEdges.length).toBe(edgesCopy.length);
    expect(layoutedEdges).toEqual(edgesCopy);

    console.log('\n✅ Layout verified: Nodes spread left-to-right with no overlap');
  });

  test('should handle empty graph gracefully', () => {
    const { nodes, edges } = getLayoutedElements([], [], 'LR');
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
  });

  test('should handle single node', () => {
    const singleNode = [{
      id: 'test',
      position: { x: 0, y: 0 },
      data: { label: 'Solo' }
    }];

    const { nodes } = getLayoutedElements(singleNode, [], 'LR');
    expect(nodes.length).toBe(1);
    expect(nodes[0].sourcePosition).toBe('right');
    expect(nodes[0].targetPosition).toBe('left');
  });
});
