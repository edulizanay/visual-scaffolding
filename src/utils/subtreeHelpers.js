// ABOUTME: Pure helpers for subtree collapse backend routing
// ABOUTME: Testable functions for deciding between backend and legacy paths

/**
 * Determine if backend subtree collapse should be used
 * @param {boolean} featureFlagEnabled - ENABLE_BACKEND_SUBTREE flag
 * @returns {boolean} True if should call backend
 */
export function shouldUseBackendSubtree(featureFlagEnabled) {
  return featureFlagEnabled;
}

/**
 * Determine target collapse state for a node
 * @param {Object} node - Node to toggle
 * @returns {boolean} Target collapsed state (opposite of current)
 */
export function getTargetCollapseState(node) {
  const isCurrentlyCollapsed = node.data?.collapsed || false;
  return !isCurrentlyCollapsed;
}
