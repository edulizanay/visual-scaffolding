// ABOUTME: Single source of truth for node dimensions used across frontend and backend
// ABOUTME: These values are consumed by both React components and server-side layout computation

/**
 * Standard node dimensions for the flow diagram
 * Used by both frontend rendering and backend Dagre layout calculations
 */
export const NODE_WIDTH = 172;
export const NODE_HEIGHT = 70;
export const NODE_BORDER_RADIUS = 4;

/**
 * Dagre layout spacing configuration
 * Controls the gaps between nodes during auto-layout
 */
export const DAGRE_SPACING = {
  horizontal: 50,
  vertical: 40,
};
