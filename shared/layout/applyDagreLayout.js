// ABOUTME: Pure layout helper for Dagre positioning without React dependencies
// ABOUTME: Shared between frontend animation and backend tool execution

import dagre from '@dagrejs/dagre';
import {
  NODE_WIDTH,
  NODE_HEIGHT,
  DAGRE_SPACING,
} from '../constants/nodeDimensions.js';

/**
 * Applies Dagre layout algorithm to a graph
 *
 * @param {Object} params - Layout parameters
 * @param {Array} params.nodes - Array of node objects with id, hidden, parentGroupId
 * @param {Array} params.edges - Array of edge objects with source, target
 * @param {string} params.direction - Layout direction: 'LR' (left-right) or 'TB' (top-bottom)
 * @param {Object} params.nodeDimensions - Optional override for node dimensions
 * @param {number} params.nodeDimensions.width - Node width
 * @param {number} params.nodeDimensions.height - Node height
 * @returns {Object} - { nodes, edges } with updated positions
 */
export function applyDagreLayout({
  nodes,
  edges,
  direction = 'LR',
  nodeDimensions = { width: NODE_WIDTH, height: NODE_HEIGHT },
}) {
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  const isHorizontal = direction === 'LR';

  dagreGraph.setGraph({
    rankdir: direction,
    ranksep: DAGRE_SPACING.horizontal,
    nodesep: DAGRE_SPACING.vertical,
  });

  // Filter visible nodes and sort by group for consistent layout
  const visibleNodes = nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => !node.hidden)
    .sort((a, b) => {
      const groupA = a.node.parentGroupId ?? '';
      const groupB = b.node.parentGroupId ?? '';
      return groupA.localeCompare(groupB) || a.index - b.index;
    })
    .map(({ node }) => node);

  const visibleNodeMap = new Map(visibleNodes.map(node => [node.id, node]));

  // Register nodes with Dagre
  visibleNodes.forEach((node) => {
    dagreGraph.setNode(node.id, {
      width: nodeDimensions.width,
      height: nodeDimensions.height
    });
  });

  const visibleNodeIds = new Set(visibleNodes.map((node) => node.id));

  // Group edges by source for sorted insertion
  const edgesBySource = new Map();
  edges.forEach((edge, index) => {
    if (!visibleNodeIds.has(edge.source) || !visibleNodeIds.has(edge.target)) {
      return;
    }

    const bucket = edgesBySource.get(edge.source);
    const entry = { edge, index };
    if (bucket) {
      bucket.push(entry);
    } else {
      edgesBySource.set(edge.source, [entry]);
    }
  });

  // Sort edges to keep grouped children contiguous
  const compareTargets = (left, right) => {
    const nodeA = visibleNodeMap.get(left.edge.target);
    const nodeB = visibleNodeMap.get(right.edge.target);
    const groupA = nodeA?.parentGroupId ?? '';
    const groupB = nodeB?.parentGroupId ?? '';
    const groupedA = groupA ? 0 : 1;
    const groupedB = groupB ? 0 : 1;

    return groupedA - groupedB
      || groupA.localeCompare(groupB)
      || left.index - right.index;
  };

  edgesBySource.forEach((bucket) => {
    bucket.sort(compareTargets).forEach(({ edge }) => {
      dagreGraph.setEdge(edge.source, edge.target);
    });
  });

  // Run Dagre layout algorithm
  dagre.layout(dagreGraph);

  // Apply computed positions to nodes
  const newNodes = nodes.map((node) => {
    const nodeWithPosition = !node.hidden && dagreGraph.node(node.id);
    if (!nodeWithPosition) return node;

    return {
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      position: {
        x: nodeWithPosition.x - nodeDimensions.width / 2,
        y: nodeWithPosition.y - nodeDimensions.height / 2,
      },
    };
  });

  return { nodes: newNodes, edges };
}
