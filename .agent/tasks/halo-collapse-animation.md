# HaloOverlay Collapse Animation

## Overview

Add smooth morphing animation when collapsing an expanded group, transitioning the HaloOverlay visually into the GroupNode to create clear visual continuity and help users understand that these two representations are the same entity in different states.

## Current Behavior

When a user collapses an expanded group (via double-click on halo border or programmatically):
1. HaloOverlay disappears immediately
2. GroupNode appears immediately at its position
3. No visual connection between the two states
4. Feels jarring and disconnected

## Desired Behavior

When collapsing an expanded group:
1. HaloOverlay remains visible during transition
2. HaloOverlay's bounds morph (scale + position) to match the GroupNode's final position and size
3. Smooth interpolation over animation duration (~300-400ms)
4. GroupNode fades in as HaloOverlay completes morphing
5. Clear visual continuity showing they're the same entity

## Animation Specification

### Morph with Position Translation

**Animation Properties:**
- **Duration**: 300ms (configurable via theme)
- **Easing**: `cubic-bezier(0.4, 0.0, 0.2, 1)` (standard Material Design deceleration curve)
- **Animated Values**:
  - `x`: HaloOverlay left position → GroupNode x position
  - `y`: HaloOverlay top position → GroupNode y position
  - `width`: HaloOverlay width → GroupNode width
  - `height`: HaloOverlay height → GroupNode height
  - `opacity`: 1.0 → 0.3 (fade out HaloOverlay)

**Parallel Animations:**
- **Member nodes**: Fade out from opacity 1.0 → 0.0 over first 150ms (50% of duration)
- **GroupNode**: Fade in from opacity 0.0 → 1.0 over last 200ms, starting at 100ms offset
- **Halo border**: Remains visible during entire animation, morphing its bounds

### Animation States

```
Initial State (Expanded):
  - HaloOverlay: visible, full bounds, opacity 1.0
  - Member nodes: visible, opacity 1.0
  - GroupNode: hidden (opacity 0.0)

Transition State (t = 0ms to 300ms):
  - HaloOverlay: morphing bounds, opacity 1.0 → 0.3
  - Member nodes: opacity 1.0 → 0.0 (complete by t=150ms)
  - GroupNode: opacity 0.0 → 1.0 (start at t=100ms)

Final State (Collapsed):
  - HaloOverlay: hidden (animation complete)
  - Member nodes: hidden (groupHidden = true)
  - GroupNode: visible, opacity 1.0
```

## Technical Requirements

### Animation Timing & Behavior

**Must animate these values:**
- HaloOverlay position (x, y) from current bounds → GroupNode position
- HaloOverlay size (width, height) from current bounds → GroupNode size
- HaloOverlay opacity from 1.0 → ~0.3 during morph
- Member nodes opacity from 1.0 → 0.0 (fade out early, complete by ~50% duration)
- GroupNode opacity from 0.0 → 1.0 (fade in late, start at ~30% duration)

**Timing constraints:**
- Default duration: 300ms (must be configurable)
- Easing: smooth deceleration (suggestion: `cubic-bezier(0.4, 0.0, 0.2, 1)`)
- Member fade completes before GroupNode fully appears (for clarity)

### What Needs to Change

**HaloOverlay (`src/GroupHaloOverlay.jsx`):**
- Currently: disappears when `group.isCollapsed === true`
- Needed: continue rendering during animation with interpolated bounds/opacity
- Must know: is this group currently animating? What are start/target bounds?

**GroupNode rendering:**
- Currently: appears instantly when collapsed
- Needed: fade in from opacity 0 during animation
- Can render at final position immediately (doesn't need to move)

**Member nodes:**
- Currently: hidden instantly when parent group collapses
- Needed: fade out smoothly during animation
- Need to detect if parent group is animating and apply opacity

**Collapse trigger points:**
- Double-click on halo border
- API calls to toggle expansion
- Must capture HaloOverlay bounds before collapsing
- Must compute target GroupNode bounds
- Must coordinate animation state between components

### Configuration

Add animation config to theme system (`src/constants/theme.jsx`):
- Duration (milliseconds)
- Easing curve
- Member fade timing
- GroupNode fade timing
- Must be retrievable from theme in components

### Edge Cases to Handle

**Must gracefully handle:**
- Collapse triggered during active animation (cancel current, jump to end)
- Expand triggered during collapse animation (stop/reverse)
- Multiple groups animating simultaneously (independent animations)
- Group deleted mid-animation (cleanup without errors)
- Canvas pan/zoom during animation (animation continues correctly)

**Cleanup requirements:**
- No memory leaks from animation timers/listeners
- Animation state cleared after completion
- Temporary opacity overrides removed

### Implementation Flexibility

**You decide:**
- Animation state management approach (React state, refs, context, external state)
- Interpolation method (CSS transitions, requestAnimationFrame, animation library like Framer Motion/React Spring)
- How to pass animation state between components
- Whether to use CSS transforms or direct attribute updates
- Code organization and helper function structure

**You must preserve:**
- Current group collapse functionality (don't break existing behavior)
- Existing double-click handlers
- Backend/API interactions (this is frontend-only)
- Group visibility logic in `src/utils/groupUtils.js`

## Testing Requirements

**Critical test cases:**
- Group collapse still works if animation is disabled/fails
- Interrupting animation (collapse during animation) doesn't break state
- Multiple groups can animate simultaneously without interfering
- Animation state cleans up properly (no memory leaks)
- Nested groups handle animation correctly

**Manual verification:**
- Visual smoothness (60fps, no jank or flashing)
- Timing feels natural (easing curve is appropriate)
- Member fade → GroupNode appearance feels coordinated
- Works correctly at different zoom levels
- Works with groups of different sizes/shapes

## Success Criteria

1. **Visual Smoothness**: No visible jumps, flashes, or discontinuities
2. **Performance**: 60fps animation on typical hardware
3. **Clarity**: Users understand HaloOverlay and GroupNode are same entity
4. **Reliability**: Works correctly with nested groups, edge cases
5. **Configurability**: Animation timing/easing adjustable via theme
6. **Reversibility**: Expanding group can use reverse animation (future enhancement)

## Future Enhancements (Out of Scope)

- Reverse animation on expand (morph GroupNode → HaloOverlay)
- Spring physics instead of easing curves
- Custom animations per nesting depth
- Animation disabled preference for accessibility
- Staggered member node fade-out (cascade effect)

## Related Documentation

- [group_nodes_system.md](../system/group_nodes_system.md) - Group architecture and dual collapse systems
- [theme-and-design-tokens.md](../SOP/theme-and-design-tokens.md) - How to work with theme configuration
- `src/GroupHaloOverlay.jsx` - Current HaloOverlay implementation
- `src/utils/groupUtils.js` - Group utilities including `toggleGroupExpansion()`

## Decisions Made
 
Based on feedback from Edu:

1. **Animation Duration**: 300ms (default, must be configurable)
2. **Member Fade**: All at once (no cascading)
3. **Reverse Animation**: Collapse only (expand animation is future work)
4. **Nested Groups**: Animate the directly-collapsed group only
5. **Accessibility**: No special reduce-motion handling for now

---

**Status**: Ready for Implementation
**Created**: 2025-10-17
**Priority**: Medium (UX polish)
**Estimated Effort**: 4-6 hours
