// ABOUTME: Pure helpers for drag-end position update logic
// ABOUTME: Testable functions for determining which nodes moved during drag

/**
 * Determine which nodes have moved significantly during drag
 * @param {Array} dragEndChanges - React Flow changes with type='position' and dragging=false (contains new position in change.position)
 * @param {Object} originalPositions - Map of nodeId -> original position from drag start
 * @param {number} threshold - Minimum movement threshold (default 0.1)
 * @returns {Array} Array of {id, position, originalPosition} for nodes that moved
 */
export function getMovedNodes(dragEndChanges, originalPositions, threshold = 0.1) {
  return dragEndChanges
    .map(change => {
      const originalPos = originalPositions?.[change.id];
      // Use position from change payload (already contains the new position after drag)
      const newPosition = change.position;

      if (!originalPos || !newPosition) return null;

      // Check if position actually changed significantly
      if (
        Math.abs(newPosition.x - originalPos.x) < threshold &&
        Math.abs(newPosition.y - originalPos.y) < threshold
      ) {
        return null;
      }

      return {
        id: change.id,
        position: { ...newPosition },
        originalPosition: originalPos
      };
    })
    .filter(Boolean);
}
