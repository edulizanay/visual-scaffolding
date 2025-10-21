// ABOUTME: Pure helpers for subtree collapse logic
// ABOUTME: Testable functions for subtree collapse operations

/**
 * Determine target collapse state for a node
 * @param {Object} node - Node to toggle
 * @returns {boolean} Target collapsed state (opposite of current)
 */
export function getTargetCollapseState(node) {
  const isCurrentlyCollapsed = node.data?.collapsed || false;
  return !isCurrentlyCollapsed;
}
