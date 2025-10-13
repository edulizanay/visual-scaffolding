# SOP: Working with Design Tokens and Theme

## Overview

The design token system is a two-tier architecture that separates primitive design values from their semantic application. This enables consistent styling while maintaining flexibility for design system updates.

**Location**: [src/constants/theme.js](../../src/constants/theme.js)

## Architecture

### Tier 1: Design Tokens (Primitives)
Raw values that form the design system foundation. These are internal constants not directly exported.

**Categories:**
- **Color Palette** - Named color constants (e.g., `COLOR_DEEP_PURPLE`, `COLOR_INDIGO_ALPHA_45`)
- **Typography** - Font families, sizes, weights, line heights
- **Spacing Scale** - Based on 4px increments (`SPACING_1` = 4px, `SPACING_2` = 8px, etc.)
- **Border System** - Widths, radii
- **Shadows & Elevation** - Drop shadows and glow effects
- **Animation & Transitions** - Timing and easing functions
- **Z-Index Scale** - Layering hierarchy
- **Opacity Scale** - Transparency levels

### Tier 2: Semantic Theme
Component-specific application of tokens. This is what components actually import.

**Export**: `THEME` object with sections:
- `canvas` - Background and viewport settings
- `node` - Standard node styling and interactive states
- `groupNode` - Group-specific styling, halo effects, layout
- `tooltip` - Tooltip appearance
- `dagre` - Layout spacing configuration

## When to Modify Theme

### Adding New Token Values
If you need a new primitive value (color, spacing, shadow, etc.):

1. Add the token constant in the appropriate section of **Design Tokens**
2. Use ALL_CAPS naming with category prefix (e.g., `COLOR_*`, `SPACING_*`, `SHADOW_*`)
3. Document the token's purpose in a comment if not obvious

**Example:**
```javascript
// ----------------------------------------------------------------------------
// COLOR PALETTE
// ----------------------------------------------------------------------------

// Purple/Indigo - Primary nodes and UI elements
const COLOR_DEEP_PURPLE = '#1a192b';
const COLOR_NEW_ACCENT = '#ff5733';  // New accent color for alerts
```

### Applying Tokens to Components
If you need to change how a component looks:

1. Locate the component's section in **Semantic Theme** (`THEME` object)
2. Update the relevant property to use the appropriate token
3. Keep the structure organized by grouping related properties

**Example:**
```javascript
export const THEME = {
  node: {
    colors: {
      background: COLOR_DEEP_PURPLE,  // Using existing token
      border: COLOR_PURPLE_DARK,
      accent: COLOR_NEW_ACCENT,       // Using new token
    },
    // ...
  },
};
```

### Adding New Component Themes
If you add a new component type that needs styling:

1. Add a new section to the `THEME` export
2. Follow the existing pattern: organize by `colors`, `dimensions`, `states`, etc.
3. Use tokens, not hardcoded values

**Example:**
```javascript
export const THEME = {
  // ... existing sections ...

  // New component theme
  alertBanner: {
    colors: {
      background: COLOR_NEW_ACCENT,
      text: COLOR_WHITE,
    },
    dimensions: {
      height: 48,
      borderRadius: BORDER_RADIUS_MD,
    },
  },
};
```

## Component Usage

### Importing Theme
Always import from the theme file:

```javascript
import { THEME } from '../constants/theme.js';
```

### Accessing Values
Use dot notation to access theme values:

```javascript
const nodeStyle = {
  backgroundColor: THEME.node.colors.background,
  border: `${THEME.node.states.selection.borderWidth} solid ${THEME.node.states.selection.colors.border}`,
  width: THEME.node.dimensions.width,
};
```

### Never Hardcode Styles
❌ **Bad:**
```javascript
const style = {
  color: '#1a192b',
  padding: 12,
};
```

✅ **Good:**
```javascript
const style = {
  color: THEME.node.colors.background,
  padding: THEME.groupNode.halo.padding.y.base,
};
```

## Design Token Naming Conventions

### Tokens (Internal Constants)
- Use ALL_CAPS with underscores
- Prefix with category: `COLOR_*`, `SPACING_*`, `FONT_*`, `SHADOW_*`, etc.
- Be descriptive: `COLOR_INDIGO_ALPHA_45` not `COLOR_1`
- For alpha variants: `COLOR_NAME_ALPHA_XX` where XX is the percentage

### Theme Properties (Exported Object)
- Use camelCase for object keys
- Group related properties in nested objects
- Use semantic names: `background`, `border`, `text`, not `color1`, `color2`

## Best Practices

1. **Don't Skip the Tokens**: Never put raw values directly in the `THEME` object. Create a token constant first.

2. **Maintain the Separation**: Tokens are primitives, theme is application. Keep them conceptually separate.

3. **Update Tests**: When adding new tokens, ensure any tests that mock the theme include them.

4. **Document Complex Values**: If a token has a specific purpose or calculation, add a comment.

5. **Be Consistent**: Follow existing patterns. If colors have alpha variants, use the `_ALPHA_XX` suffix consistently.

6. **Organize by Component**: Keep the semantic theme organized by component/feature, not by property type.

## Common Tasks

### Changing a Node's Border Color
1. Find the relevant token: `COLOR_PURPLE_DARK`
2. Update it or create a new one
3. Reference in `THEME.node.colors.border`

### Adding a New Spacing Value
1. Add token: `const SPACING_7 = 28;`
2. Use in theme: `padding: SPACING_7`

### Adjusting Group Halo Padding
1. Navigate to `THEME.groupNode.halo.padding`
2. Adjust `base`, `increment`, `decay`, or `minStep` values
3. See [group_nodes_system.md](../system/group_nodes_system.md) for padding algorithm details

### Changing Animation Speed
1. Find animation token: `TRANSITION_NORMAL`
2. Update the timing value
3. Or create new timing constant if needed

## Testing

After making theme changes:

1. **Visual Check**: Run dev server and verify changes on canvas
   ```bash
   npm run dev
   ```

2. **Run Tests**: Ensure all tests still pass
   ```bash
   npm test
   ```

3. **Check Mock**: If tests fail, update test mock at `tests/unit/frontend/__mocks__/theme.js` (if it exists)

## Migration Notes

The current system consolidates what were previously two files (`theme-tokens.jsx` and `theme.jsx`) into a single `theme.js` file. This change:
- Improved organization with clear primitive/semantic separation
- Reduced import complexity
- Made the design system easier to understand and maintain
- Maintained all existing functionality

If you see references to old file paths in comments or docs, update them to point to `theme.js`.
