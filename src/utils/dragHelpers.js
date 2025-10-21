// ABOUTME: Pure helpers for drag-end position update logic
// ABOUTME: Testable functions for determining which nodes moved during drag

/**
 * Determine which nodes have moved significantly during drag
 * @param {Array} dragEndChanges - React Flow changes with type='position' and dragging=false
 * @param {Object} originalPositions - Map of nodeId -> original position from drag start
 * @param {Array} currentNodes - Current node state
 * @param {number} threshold - Minimum movement threshold (default 0.1)
 * @returns {Array} Array of {id, position, originalPosition} for nodes that moved
 */
export function getMovedNodes(dragEndChanges, originalPositions, currentNodes, threshold = 0.1) {
  return dragEndChanges
    .map(change => {
      const node = currentNodes.find(n => n.id === change.id);
      const originalPos = originalPositions?.[change.id];

      if (!node || !originalPos) return null;

      // Check if position actually changed significantly
      if (
        Math.abs(node.position.x - originalPos.x) < threshold &&
        Math.abs(node.position.y - originalPos.y) < threshold
      ) {
        return null;
      }

      return {
        id: node.id,
        position: { ...node.position },
        originalPosition: originalPos
      };
    })
    .filter(Boolean);
}
