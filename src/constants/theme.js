// ABOUTME: Semantic theme layer - how primitive tokens are applied in context
// ABOUTME: The "recipes" that combine token "ingredients" for specific UI components

import {
  // Colors
  COLOR_DEEP_PURPLE,
  COLOR_PURPLE_DARK,
  COLOR_INDIGO_DARK,
  COLOR_INDIGO_LIGHT,
  COLOR_BLUE_ALPHA_80,
  COLOR_BLUE_ALPHA_30,
  COLOR_INDIGO_ALPHA_45,
  COLOR_INDIGO_ALPHA_70,
  COLOR_WHITE,
  COLOR_WHITE_ALPHA_40,
  COLOR_DARK_GRAY_ALPHA_95,
  GRADIENT_CANVAS,

  // Spacing
  SPACING_1,
  SPACING_2,
  SPACING_3,
  SPACING_10,

  // Borders
  BORDER_WIDTH_THIN,
  BORDER_WIDTH_MEDIUM,
  BORDER_WIDTH_THICK,
  BORDER_RADIUS_SM,
  BORDER_RADIUS_MD,
  BORDER_RADIUS_LG,
} from './tokens.js';

// ============================================================================
// SEMANTIC THEME
// ============================================================================
// Organized by component for easy reference when styling specific UI elements

export const THEME = {
  // --------------------------------------------------------------------------
  // Canvas Background
  // --------------------------------------------------------------------------
  canvas: {
    background: GRADIENT_CANVAS,
    fitViewPadding: 0.25,
  },

  // --------------------------------------------------------------------------
  // Standard Nodes
  // --------------------------------------------------------------------------
  node: {
    colors: {
      background: COLOR_DEEP_PURPLE,
      border: COLOR_PURPLE_DARK,
      text: COLOR_WHITE,
    },
    dimensions: {
      width: 172,
      height: 76,
      borderRadius: BORDER_RADIUS_SM,
    },

    // Interactive states
    states: {
      selection: {
        colors: {
          border: COLOR_BLUE_ALPHA_80,
          shadow: COLOR_BLUE_ALPHA_30,
        },
        borderWidth: BORDER_WIDTH_MEDIUM,
        shadowSpread: SPACING_1 + 'px',  // Was 2px, now 4px
      },
      collapsedSubtree: {
        colors: {
          border: COLOR_WHITE_ALPHA_40,
        },
        borderWidth: BORDER_WIDTH_THICK,
      },
    },
  },

  // --------------------------------------------------------------------------
  // Group Nodes
  // --------------------------------------------------------------------------
  groupNode: {
    colors: {
      background: COLOR_INDIGO_DARK,
      border: COLOR_INDIGO_LIGHT,
      text: COLOR_WHITE,
    },

    // Halo effect around group boundaries
    halo: {
      colors: {
        normal: COLOR_INDIGO_ALPHA_45,
        hovered: COLOR_INDIGO_ALPHA_70,
      },
      strokeWidth: {
        normal: 1.5,
        hovered: 2,
      },
      borderRadius: BORDER_RADIUS_LG,

      // Padding algorithm for nested groups - increases with depth
      padding: {
        x: {
          base: 18,  // Keep existing value (between SPACING_4=16 and SPACING_5=20)
        },
        y: {
          base: SPACING_3,      // Was 14px, now 12px
          increment: SPACING_2, // Was 10px, now 8px
          decay: 0.7,
          minStep: 1,
        },
      },
    },

    layout: {
      memberVerticalGap: 80,  // Keep existing value (between SPACING_16=64 and next step)
    },
  },

  // --------------------------------------------------------------------------
  // Tooltips
  // --------------------------------------------------------------------------
  tooltip: {
    colors: {
      background: COLOR_DARK_GRAY_ALPHA_95,
      border: COLOR_BLUE_ALPHA_30,
    },
    borderWidth: BORDER_WIDTH_THIN,
    borderRadius: BORDER_RADIUS_MD + 'px',
    padding: '12px 16px',
  },

  // --------------------------------------------------------------------------
  // Dagre Layout
  // --------------------------------------------------------------------------
  dagre: {
    spacing: {
      horizontal: 50,  // Keep existing value (between SPACING_12=48 and SPACING_16=64)
      vertical: 45,    // Keep existing value
    },
  },
};
