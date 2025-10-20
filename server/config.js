// ABOUTME: Server configuration and feature flags
// ABOUTME: Environment-based toggles for backend save funnel rollout

/**
 * Feature flags for backend save funnel migration
 *
 * Default: false (legacy autosave behavior)
 * Override via environment variables:
 * - ENABLE_BACKEND_DRAG_SAVE=true
 * - ENABLE_BACKEND_SUBTREE=true
 */

export const config = {
  // Enable backend persistence for drag-end position updates
  // When false: frontend autosave handles all position changes
  // When true: drag-end calls updateNode API for each moved node
  ENABLE_BACKEND_DRAG_SAVE: process.env.ENABLE_BACKEND_DRAG_SAVE === 'true',

  // Enable backend persistence for subtree collapse/expand
  // When false: frontend handles collapse locally, autosave persists
  // When true: Alt+Click calls backend toggleSubtreeCollapse API
  ENABLE_BACKEND_SUBTREE: process.env.ENABLE_BACKEND_SUBTREE === 'true',
};

/**
 * Rollback strategy:
 * Set flags to false via environment variables and redeploy.
 * Frontend will revert to autosave-based persistence.
 */
