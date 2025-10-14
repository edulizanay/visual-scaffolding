// ABOUTME: Design system tokens and theme configuration
// ABOUTME: Defines all visual styling constants and semantic theme for the application

// ============================================================================
// DESIGN TOKENS - PRIMITIVES
// ============================================================================
// Raw values that form the design system foundation

// ----------------------------------------------------------------------------
// COLOR PALETTE
// ----------------------------------------------------------------------------

// Purple/Indigo - Primary nodes and UI elements
const COLOR_DEEP_PURPLE = '#1a192b';
const COLOR_PURPLE_DARK = '#2b2253';
const COLOR_INDIGO_DARK = '#3730a3';
const COLOR_INDIGO_LIGHT = '#6366f1';

// Blue - Selection states and accents
const COLOR_BLUE_500 = '#60a5fa';
const COLOR_BLUE_ALPHA_80 = 'rgba(96, 165, 250, 0.8)';
const COLOR_BLUE_ALPHA_30 = 'rgba(96, 165, 250, 0.3)';

// Indigo Alpha - Group halos and hover states
const COLOR_INDIGO_ALPHA_45 = 'rgba(99, 102, 241, 0.45)';
const COLOR_INDIGO_ALPHA_70 = 'rgba(129, 140, 248, 0.7)';

// Neutrals - Text, borders, backgrounds
const COLOR_WHITE = '#ffffff';
const COLOR_WHITE_ALPHA_40 = 'rgba(255, 255, 255, 0.4)';
const COLOR_DARK_GRAY_ALPHA_95 = 'rgba(30, 30, 30, 0.95)';

// Neutral scale for text hierarchy and UI elements
const COLOR_NEUTRAL_50 = '#f9fafb';   // Brightest text
const COLOR_NEUTRAL_100 = '#f3f4f6';  // High-emphasis text
const COLOR_NEUTRAL_200 = '#e5e7eb';  // Medium-emphasis text
const COLOR_NEUTRAL_400 = '#9ca3af';  // Low-emphasis text
const COLOR_NEUTRAL_600 = '#4b5563';  // Disabled text
const COLOR_NEUTRAL_700 = '#374151';  // Subtle borders
const COLOR_NEUTRAL_800 = '#1f2937';  // Dividers
const COLOR_NEUTRAL_900 = '#111827';  // Deep backgrounds

// Semantic Colors - Feedback and status
const COLOR_SUCCESS = '#10b981';  // green-500
const COLOR_WARNING = '#f59e0b';  // amber-500
const COLOR_ERROR = '#ef4444';    // red-500
const COLOR_INFO = COLOR_BLUE_ALPHA_80;

// Gradients
const GRADIENT_CANVAS = 'linear-gradient(180deg, #0f0a1a 0%, #1a0f2e 100%)';

// ----------------------------------------------------------------------------
// TYPOGRAPHY
// ----------------------------------------------------------------------------

// Font Families
const FONT_FAMILY_BASE = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const FONT_FAMILY_MONO = 'Monaco, "Courier New", monospace';

// Font Sizes
const FONT_SIZE_XS = 11;   // Node metadata, tiny labels
const FONT_SIZE_SM = 13;   // Secondary text, descriptions
const FONT_SIZE_BASE = 15; // Node labels, body text
const FONT_SIZE_LG = 18;   // Group titles
const FONT_SIZE_XL = 24;   // Canvas headings

// Font Weights
const FONT_WEIGHT_NORMAL = 400;
const FONT_WEIGHT_MEDIUM = 500;
const FONT_WEIGHT_SEMIBOLD = 600;

// Line Heights
const LINE_HEIGHT_TIGHT = 1.25;   // Node labels
const LINE_HEIGHT_NORMAL = 1.5;   // Body text
const LINE_HEIGHT_RELAXED = 1.75; // Descriptions

// ----------------------------------------------------------------------------
// SPACING SCALE (4px base unit)
// ----------------------------------------------------------------------------
const SPACING_0 = 0;
const SPACING_1 = 4;    // 4px - tight relationships
const SPACING_2 = 8;    // 8px - compact spacing
const SPACING_3 = 12;   // 12px - comfortable spacing
const SPACING_4 = 16;   // 16px - standard gap
const SPACING_5 = 20;   // 20px - loose spacing
const SPACING_6 = 24;   // 24px - section spacing
const SPACING_8 = 32;   // 32px - large gaps
const SPACING_10 = 40;  // 40px - extra large gaps
const SPACING_12 = 48;  // 48px - major separations
const SPACING_16 = 64;  // 64px - dramatic spacing

// ----------------------------------------------------------------------------
// BORDER SYSTEM
// ----------------------------------------------------------------------------

// Border Widths
const BORDER_WIDTH_THIN = '1px';
const BORDER_WIDTH_MEDIUM = '2.4px';
const BORDER_WIDTH_THICK = '4px';

// Border Radius
const BORDER_RADIUS_SM = 4;
const BORDER_RADIUS_MD = 8;
const BORDER_RADIUS_LG = 18;

// ----------------------------------------------------------------------------
// SHADOWS & ELEVATION
// ----------------------------------------------------------------------------
const SHADOW_SM = '0 1px 2px rgba(0, 0, 0, 0.3)';    // Tooltips
const SHADOW_MD = '0 4px 8px rgba(0, 0, 0, 0.4)';    // Nodes
const SHADOW_LG = '0 8px 16px rgba(0, 0, 0, 0.5)';   // Groups, modals
const SHADOW_GLOW_BLUE = '0 0 12px rgba(96, 165, 250, 0.4)';    // Selection state
const SHADOW_GLOW_INDIGO = '0 0 16px rgba(99, 102, 241, 0.6)';  // Group hover

// ----------------------------------------------------------------------------
// ANIMATION & TRANSITIONS
// ----------------------------------------------------------------------------

// Timing
const TRANSITION_FAST = '150ms';    // Hover states
const TRANSITION_NORMAL = '250ms';  // Standard interactions
const TRANSITION_SLOW = '400ms';    // Layout shifts, collapses
const TRANSITION_LAYOUT = '600ms';  // Dagre auto-layout

// Easing Functions
const EASING_STANDARD = 'cubic-bezier(0.4, 0.0, 0.2, 1)';
const EASING_DECELERATE = 'cubic-bezier(0.0, 0.0, 0.2, 1)';
const EASING_ACCELERATE = 'cubic-bezier(0.4, 0.0, 1, 1)';

// ----------------------------------------------------------------------------
// Z-INDEX SCALE
// ----------------------------------------------------------------------------
const Z_INDEX_CANVAS = 0;
const Z_INDEX_EDGES = 10;
const Z_INDEX_GROUP_HALOS = 15;    // Behind nodes, above edges
const Z_INDEX_NODES = 20;
const Z_INDEX_SELECTED_NODES = 30;
const Z_INDEX_TOOLTIPS = 100;
const Z_INDEX_HOTKEYS_PANEL = 200;
const Z_INDEX_MODALS = 300;

// ----------------------------------------------------------------------------
// OPACITY SCALE
// ----------------------------------------------------------------------------
const OPACITY_DISABLED = 0.4;
const OPACITY_HOVER = 0.7;
const OPACITY_MUTED = 0.6;
const OPACITY_SUBTLE = 0.3;
const OPACITY_BARELY = 0.1;

// ============================================================================
// SEMANTIC THEME
// ============================================================================
// How tokens are applied in context - organized by component

export const THEME = {
  // --------------------------------------------------------------------------
  // Canvas Background
  // --------------------------------------------------------------------------
  canvas: {
    background: GRADIENT_CANVAS,
    fitViewPadding: 0.25,
  },

  // --------------------------------------------------------------------------
  // Text Colors (for inline use)
  // --------------------------------------------------------------------------
  text: {
    primary: COLOR_WHITE,
    secondary: COLOR_NEUTRAL_200,
    tertiary: COLOR_NEUTRAL_400,
  },

  // --------------------------------------------------------------------------
  // Common Colors (for inline use)
  // --------------------------------------------------------------------------
  colors: {
    deepPurple: COLOR_DEEP_PURPLE,
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
        shadowSpread: SPACING_1 + 'px',
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
          base: 18,
        },
        y: {
          base: SPACING_3,
          increment: SPACING_2,
          decay: 0.7,
          minStep: 1,
        },
      },
    },

    layout: {
      memberVerticalGap: 80,
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
      horizontal: 50,
      vertical: 45,
    },
  },
};
