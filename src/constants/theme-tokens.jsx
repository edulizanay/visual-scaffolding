// ABOUTME: Design system tokens and theme configuration
// ABOUTME: Defines all visual styling constants for the application

// ============================================================================
// DESIGN TOKENS
// ============================================================================
// Primitive values that form the design system foundation.
// These are the "ingredients" - raw values independent of context.

// ----------------------------------------------------------------------------
// Color Palette
// ----------------------------------------------------------------------------
// Dark Purple/Indigo - Primary nodes and UI elements
const COLOR_DEEP_PURPLE = '#1a192b';
const COLOR_PURPLE_DARK = '#2b2253';
const COLOR_INDIGO_600 = '#3730a3';
const COLOR_INDIGO_400 = '#6366f1';

// Blue - Selection states and accents
const COLOR_BLUE_ALPHA_80 = 'rgba(96, 165, 250, 0.8)';
const COLOR_BLUE_ALPHA_30 = 'rgba(96, 165, 250, 0.3)';

// Indigo Alpha - Group halos and hover states
const COLOR_INDIGO_ALPHA_45 = 'rgba(99, 102, 241, 0.45)';
const COLOR_INDIGO_ALPHA_70 = 'rgba(129, 140, 248, 0.7)';

// Neutrals
const COLOR_WHITE = '#ffffff';
const COLOR_WHITE_ALPHA_40 = 'rgba(255, 255, 255, 0.4)';
const COLOR_DARK_GRAY_ALPHA_95 = 'rgba(30, 30, 30, 0.95)';

// Gradients
const GRADIENT_CANVAS = 'linear-gradient(180deg, #0f0a1a 0%, #1a0f2e 100%)';

// ----------------------------------------------------------------------------
// Border System
// ----------------------------------------------------------------------------
const BORDER_WIDTH_THIN = '1px';
const BORDER_WIDTH_MEDIUM = '2.4px';
const BORDER_WIDTH_THICK = '4px';

const BORDER_RADIUS_SM = 4;
const BORDER_RADIUS_MD = 8;
const BORDER_RADIUS_LG = 18;

// ----------------------------------------------------------------------------
// Spacing Scale
// ----------------------------------------------------------------------------
const SPACING_XS = 2;    // Shadow spread
const SPACING_SM = 10;   // Y padding increment
const SPACING_MD = 14;   // Base Y padding
const SPACING_LG = 18;   // Base X padding
const SPACING_XL = 40;   // Vertical gaps between nodes
const SPACING_XXL = 50;  // Dagre layout spacing

// ============================================================================
// SEMANTIC THEME
// ============================================================================
// How tokens are applied in context - the "recipes" that use the ingredients.
// Organized by component for easy reference when styling specific UI elements.

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
  // Visual styling for basic workflow nodes
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
        shadowSpread: SPACING_XS + 'px',
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
  // Container nodes that hold other nodes
  groupNode: {
    colors: {
      background: COLOR_INDIGO_600,
      border: COLOR_INDIGO_400,
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
          base: SPACING_LG,
        },
        y: {
          base: SPACING_MD,
          increment: SPACING_SM,
          decay: 0.7,
          minStep: 1,
        },
      },
    },

    layout: {
      memberVerticalGap: SPACING_XL,
    },
  },

  // --------------------------------------------------------------------------
  // Tooltips
  // --------------------------------------------------------------------------
  // Contextual help overlays
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
  // Auto-layout spacing configuration
  dagre: {
    spacing: {
      horizontal: SPACING_XXL,
      vertical: SPACING_XXL,
    },
  },
};
