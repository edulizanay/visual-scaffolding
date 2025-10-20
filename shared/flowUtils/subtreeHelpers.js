// ABOUTME: Shared utilities for subtree traversal and collapse operations
// ABOUTME: Used by both frontend (Alt+Click) and backend (toggleSubtreeCollapse tool)

/**
 * Traverse descendants by edges (edge-based hierarchy traversal).
 * Used for Alt+Click subtree collapse which follows edge connections.
 *
 * @param {string} nodeId - ID of the root node to traverse from
 * @param {Array} nodes - Array of all nodes in the flow
 * @param {Array} edges - Array of all edges in the flow
 * @returns {Array} Array of descendant node objects
 */
export function getAllDescendants(nodeId, nodes, edges) {
  const node = nodes.find(n => n.id === nodeId);
  if (!node) return [];

  // Find direct children via edges
  const children = edges
    .filter(edge => edge.source === nodeId)
    .map(edge => nodes.find(n => n.id === edge.target))
    .filter(Boolean);

  const descendants = [...children];

  // Recursively traverse children
  children.forEach(child => {
    descendants.push(...getAllDescendants(child.id, nodes, edges));
  });

  return descendants;
}

/**
 * Collapse or expand a subtree by hiding/showing all descendants.
 *
 * Sets `data.collapsed` on the parent node and toggles `hidden`/`subtreeHidden`
 * flags on all descendants, plus hides affected edges.
 *
 * NOTE: This is a pure function that does NOT apply group visibility rules.
 * Frontend callers should wrap the result with applyGroupVisibility() if needed.
 *
 * @param {Object} flow - Current flow state {nodes, edges}
 * @param {string} nodeId - ID of node to collapse/expand
 * @param {boolean} collapsed - true to collapse, false to expand
 * @param {Function} getDescendantsFn - Optional custom descendant getter (defaults to getAllDescendants)
 * @returns {Object} Updated flow state {nodes, edges}
 */
export function collapseSubtreeByHandles(flow, nodeId, collapsed, getDescendantsFn = null) {
  const { nodes, edges } = flow;
  const target = nodes.find((node) => node.id === nodeId);
  if (!target) return flow;

  const descendants = getDescendantsFn
    ? getDescendantsFn(nodeId, nodes, edges).map((entry) => (typeof entry === 'string' ? entry : entry.id))
    : getAllDescendants(nodeId, nodes, edges).map(node => node.id);
  const descendantSet = new Set(descendants);

  const updatedNodes = nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, data: { ...node.data, collapsed } };
    }
    if (descendantSet.has(node.id)) {
      const next = { ...node, hidden: collapsed };
      if (collapsed) {
        next.subtreeHidden = true;
      } else if ('subtreeHidden' in next) {
        delete next.subtreeHidden;
      }
      return next;
    }
    return node;
  });

  const updatedEdges = edges.map((edge) =>
    descendantSet.has(edge.source) || descendantSet.has(edge.target)
      ? { ...edge, hidden: collapsed }
      : edge
  );

  return { nodes: updatedNodes, edges: updatedEdges };
}
