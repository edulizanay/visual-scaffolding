// ABOUTME: Primitive design tokens - the raw "ingredients" of the design system
// ABOUTME: Single source of truth for all visual constants, independent of context

// ============================================================================
// COLOR PALETTE
// ============================================================================

// ----------------------------------------------------------------------------
// Purple/Indigo - Primary nodes and UI elements
// ----------------------------------------------------------------------------
export const COLOR_DEEP_PURPLE = '#1a192b';
export const COLOR_PURPLE_DARK = '#2b2253';
export const COLOR_INDIGO_DARK = '#3730a3';
export const COLOR_INDIGO_LIGHT = '#6366f1';

// ----------------------------------------------------------------------------
// Blue - Selection states and accents
// ----------------------------------------------------------------------------
export const COLOR_BLUE_500 = '#60a5fa';
export const COLOR_BLUE_ALPHA_80 = 'rgba(96, 165, 250, 0.8)';
export const COLOR_BLUE_ALPHA_30 = 'rgba(96, 165, 250, 0.3)';

// ----------------------------------------------------------------------------
// Indigo Alpha - Group halos and hover states
// ----------------------------------------------------------------------------
export const COLOR_INDIGO_ALPHA_45 = 'rgba(99, 102, 241, 0.45)';
export const COLOR_INDIGO_ALPHA_70 = 'rgba(129, 140, 248, 0.7)';

// ----------------------------------------------------------------------------
// Neutrals - Text, borders, backgrounds
// ----------------------------------------------------------------------------
export const COLOR_WHITE = '#ffffff';
export const COLOR_WHITE_ALPHA_40 = 'rgba(255, 255, 255, 0.4)';
export const COLOR_DARK_GRAY_ALPHA_95 = 'rgba(30, 30, 30, 0.95)';

// Neutral scale for text hierarchy and UI elements
export const COLOR_NEUTRAL_50 = '#f9fafb';   // Brightest text
export const COLOR_NEUTRAL_100 = '#f3f4f6';  // High-emphasis text
export const COLOR_NEUTRAL_200 = '#e5e7eb';  // Medium-emphasis text
export const COLOR_NEUTRAL_400 = '#9ca3af';  // Low-emphasis text
export const COLOR_NEUTRAL_600 = '#4b5563';  // Disabled text
export const COLOR_NEUTRAL_700 = '#374151';  // Subtle borders
export const COLOR_NEUTRAL_800 = '#1f2937';  // Dividers
export const COLOR_NEUTRAL_900 = '#111827';  // Deep backgrounds

// ----------------------------------------------------------------------------
// Semantic Colors - Feedback and status
// ----------------------------------------------------------------------------
export const COLOR_SUCCESS = '#10b981';  // green-500
export const COLOR_WARNING = '#f59e0b';  // amber-500
export const COLOR_ERROR = '#ef4444';    // red-500
export const COLOR_INFO = COLOR_BLUE_ALPHA_80;

// ----------------------------------------------------------------------------
// Gradients
// ----------------------------------------------------------------------------
export const GRADIENT_CANVAS = 'linear-gradient(180deg, #0f0a1a 0%, #1a0f2e 100%)';

// ============================================================================
// TYPOGRAPHY
// ============================================================================

// ----------------------------------------------------------------------------
// Font Families
// ----------------------------------------------------------------------------
export const FONT_FAMILY_BASE = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
export const FONT_FAMILY_MONO = 'Monaco, "Courier New", monospace';

// ----------------------------------------------------------------------------
// Font Sizes
// ----------------------------------------------------------------------------
export const FONT_SIZE_XS = 11;   // Node metadata, tiny labels
export const FONT_SIZE_SM = 13;   // Secondary text, descriptions
export const FONT_SIZE_BASE = 15; // Node labels, body text
export const FONT_SIZE_LG = 18;   // Group titles
export const FONT_SIZE_XL = 24;   // Canvas headings

// ----------------------------------------------------------------------------
// Font Weights
// ----------------------------------------------------------------------------
export const FONT_WEIGHT_NORMAL = 400;
export const FONT_WEIGHT_MEDIUM = 500;
export const FONT_WEIGHT_SEMIBOLD = 600;

// ----------------------------------------------------------------------------
// Line Heights
// ----------------------------------------------------------------------------
export const LINE_HEIGHT_TIGHT = 1.25;   // Node labels
export const LINE_HEIGHT_NORMAL = 1.5;   // Body text
export const LINE_HEIGHT_RELAXED = 1.75; // Descriptions

// ============================================================================
// SPACING SCALE (4px base unit)
// ============================================================================
export const SPACING_0 = 0;
export const SPACING_1 = 4;    // 4px - tight relationships
export const SPACING_2 = 8;    // 8px - compact spacing
export const SPACING_3 = 12;   // 12px - comfortable spacing
export const SPACING_4 = 16;   // 16px - standard gap
export const SPACING_5 = 20;   // 20px - loose spacing
export const SPACING_6 = 24;   // 24px - section spacing
export const SPACING_8 = 32;   // 32px - large gaps
export const SPACING_10 = 40;  // 40px - extra large gaps
export const SPACING_12 = 48;  // 48px - major separations
export const SPACING_16 = 64;  // 64px - dramatic spacing

// ============================================================================
// BORDER SYSTEM
// ============================================================================

// ----------------------------------------------------------------------------
// Border Widths
// ----------------------------------------------------------------------------
export const BORDER_WIDTH_THIN = '1px';
export const BORDER_WIDTH_MEDIUM = '2.4px';
export const BORDER_WIDTH_THICK = '4px';

// ----------------------------------------------------------------------------
// Border Radius
// ----------------------------------------------------------------------------
export const BORDER_RADIUS_SM = 4;
export const BORDER_RADIUS_MD = 8;
export const BORDER_RADIUS_LG = 18;

// ============================================================================
// SHADOWS & ELEVATION
// ============================================================================
export const SHADOW_SM = '0 1px 2px rgba(0, 0, 0, 0.3)';    // Tooltips
export const SHADOW_MD = '0 4px 8px rgba(0, 0, 0, 0.4)';    // Nodes
export const SHADOW_LG = '0 8px 16px rgba(0, 0, 0, 0.5)';   // Groups, modals
export const SHADOW_GLOW_BLUE = '0 0 12px rgba(96, 165, 250, 0.4)';    // Selection state
export const SHADOW_GLOW_INDIGO = '0 0 16px rgba(99, 102, 241, 0.6)';  // Group hover

// ============================================================================
// ANIMATION & TRANSITIONS
// ============================================================================

// ----------------------------------------------------------------------------
// Timing
// ----------------------------------------------------------------------------
export const TRANSITION_FAST = '150ms';    // Hover states
export const TRANSITION_NORMAL = '250ms';  // Standard interactions
export const TRANSITION_SLOW = '400ms';    // Layout shifts, collapses
export const TRANSITION_LAYOUT = '600ms';  // Dagre auto-layout

// ----------------------------------------------------------------------------
// Easing Functions
// ----------------------------------------------------------------------------
export const EASING_STANDARD = 'cubic-bezier(0.4, 0.0, 0.2, 1)';
export const EASING_DECELERATE = 'cubic-bezier(0.0, 0.0, 0.2, 1)';
export const EASING_ACCELERATE = 'cubic-bezier(0.4, 0.0, 1, 1)';

// ============================================================================
// Z-INDEX SCALE
// ============================================================================
export const Z_INDEX_CANVAS = 0;
export const Z_INDEX_EDGES = 10;
export const Z_INDEX_GROUP_HALOS = 15;    // Behind nodes, above edges
export const Z_INDEX_NODES = 20;
export const Z_INDEX_SELECTED_NODES = 30;
export const Z_INDEX_TOOLTIPS = 100;
export const Z_INDEX_HOTKEYS_PANEL = 200;
export const Z_INDEX_MODALS = 300;

// ============================================================================
// OPACITY SCALE
// ============================================================================
export const OPACITY_DISABLED = 0.4;
export const OPACITY_HOVER = 0.7;
export const OPACITY_MUTED = 0.6;
export const OPACITY_SUBTLE = 0.3;
export const OPACITY_BARELY = 0.1;
