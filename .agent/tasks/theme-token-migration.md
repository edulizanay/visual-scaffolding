# Theme Token Migration Plan

## Context

We are migrating from a nested JSON-like theme structure ([src/constants/theme.jsx](../../src/constants/theme.jsx)) to a flat token-based system ([src/constants/theme-tokens.jsx](../../src/constants/theme-tokens.jsx)).

**Current approach**: Deeply nested structure optimized for component lookup but hard to maintain
**New approach**: Flat design tokens at the top, semantic theme below - easier to scan, compare, and modify related values

## Migration Strategy

This is a **1:1 replacement** - same values, better organization. No visual changes expected.

### Phase 1: Update Import Statements

All files currently import from `'../constants/theme.jsx'`. No changes needed here - we'll replace the content of `theme.jsx` with the new structure.

**Files using THEME:**
- ✅ [src/hooks/useFlowLayout.js](../../src/hooks/useFlowLayout.js)
- ✅ [src/App.jsx](../../src/App.jsx)
- ✅ [src/utils/groupUtils.js](../../src/utils/groupUtils.js)
- ✅ [src/HotkeysPanel.jsx](../../src/HotkeysPanel.jsx)
- ✅ [tests/groupHelpers.test.js](../../tests/groupHelpers.test.js)

### Phase 2: Value Mapping

Map every THEME access path from old to new structure:

#### Canvas
| Old Path | New Path | Notes |
|----------|----------|-------|
| `THEME.canvas.background` | `THEME.canvas.background` | ✅ Same |
| `THEME.canvas.fitViewPadding` | `THEME.canvas.fitViewPadding` | ✅ Same |

#### Node Dimensions
| Old Path | New Path | Notes |
|----------|----------|-------|
| `THEME.node.dimensions.width` | `THEME.node.dimensions.width` | ✅ Same |
| `THEME.node.dimensions.height` | `THEME.node.dimensions.height` | ✅ Same |
| `THEME.node.dimensions.borderRadius` | `THEME.node.dimensions.borderRadius` | ✅ Same |

#### Node Colors
| Old Path | New Path | Notes |
|----------|----------|-------|
| `THEME.node.colors.background` | `THEME.node.colors.background` | ✅ Same |
| `THEME.node.colors.border` | `THEME.node.colors.border` | ✅ Same |
| `THEME.node.colors.text` | `THEME.node.colors.text` | ✅ Same |

#### Node States
| Old Path | New Path | Notes |
|----------|----------|-------|
| `THEME.node.states.selection.colors.border` | `THEME.node.states.selection.colors.border` | ✅ Same |
| `THEME.node.states.selection.colors.shadow` | `THEME.node.states.selection.colors.shadow` | ✅ Same |
| `THEME.node.states.selection.borderWidth` | `THEME.node.states.selection.borderWidth` | ✅ Same |
| `THEME.node.states.selection.shadowSpread` | `THEME.node.states.selection.shadowSpread` | ✅ Same |
| `THEME.node.states.collapsedSubtree.colors.border` | `THEME.node.states.collapsedSubtree.colors.border` | ✅ Same |
| `THEME.node.states.collapsedSubtree.borderWidth` | `THEME.node.states.collapsedSubtree.borderWidth` | ✅ Same |

#### Group Node
| Old Path | New Path | Notes |
|----------|----------|-------|
| `THEME.groupNode.colors.background` | `THEME.groupNode.colors.background` | ✅ Same |
| `THEME.groupNode.colors.border` | `THEME.groupNode.colors.border` | ✅ Same |
| `THEME.groupNode.colors.text` | `THEME.groupNode.colors.text` | ✅ Same |

#### Group Halo
| Old Path | New Path | Notes |
|----------|----------|-------|
| `THEME.groupNode.halo.colors.normal` | `THEME.groupNode.halo.colors.normal` | ✅ Same |
| `THEME.groupNode.halo.colors.hovered` | `THEME.groupNode.halo.colors.hovered` | ✅ Same |
| `THEME.groupNode.halo.strokeWidth.normal` | `THEME.groupNode.halo.strokeWidth.normal` | ✅ Same |
| `THEME.groupNode.halo.strokeWidth.hovered` | `THEME.groupNode.halo.strokeWidth.hovered` | ✅ Same |
| `THEME.groupNode.halo.borderRadius` | `THEME.groupNode.halo.borderRadius` | ✅ Same |
| `THEME.groupNode.halo.padding` | `THEME.groupNode.halo.padding` | ✅ Same |
| `THEME.groupNode.halo.padding.x.base` | `THEME.groupNode.halo.padding.x.base` | ✅ Same |
| `THEME.groupNode.halo.padding.y.base` | `THEME.groupNode.halo.padding.y.base` | ✅ Same |
| `THEME.groupNode.halo.padding.y.increment` | `THEME.groupNode.halo.padding.y.increment` | ✅ Same |
| `THEME.groupNode.halo.padding.y.decay` | `THEME.groupNode.halo.padding.y.decay` | ✅ Same |
| `THEME.groupNode.halo.padding.y.minStep` | `THEME.groupNode.halo.padding.y.minStep` | ✅ Same |

#### Group Layout
| Old Path | New Path | Notes |
|----------|----------|-------|
| `THEME.groupNode.layout.memberVerticalGap` | `THEME.groupNode.layout.memberVerticalGap` | ✅ Same |

#### Tooltip
| Old Path | New Path | Notes |
|----------|----------|-------|
| `THEME.tooltip.colors.background` | `THEME.tooltip.colors.background` | ✅ Same |
| `THEME.tooltip.colors.border` | `THEME.tooltip.colors.border` | ✅ Same |
| `THEME.tooltip.borderWidth` | `THEME.tooltip.borderWidth` | ✅ Same |
| `THEME.tooltip.borderRadius` | `THEME.tooltip.borderRadius` | ✅ Same |
| `THEME.tooltip.padding` | `THEME.tooltip.padding` | ✅ Same |

#### Dagre Layout
| Old Path | New Path | Notes |
|----------|----------|-------|
| `THEME.dagre.spacing.horizontal` | `THEME.dagre.spacing.horizontal` | ✅ Same |
| `THEME.dagre.spacing.vertical` | `THEME.dagre.spacing.vertical` | ✅ Same |

### Phase 3: File-by-File Changes Required

#### ✅ NO CHANGES NEEDED

All files will continue to work with the new structure because:
1. **All THEME paths remain identical** - we preserved the nested structure in the semantic theme section
2. **Only internal organization changed** - we added design tokens at the top, but the exported `THEME` object has the exact same shape
3. **Import statements unchanged** - still importing from `'../constants/theme.jsx'`

### Phase 4: Validation Steps

#### Before Migration
1. ✅ Document all current THEME usage locations (see Phase 1)
2. ✅ Run full test suite: `npm test`
3. ✅ Verify dev server runs: `npm run dev`
4. ✅ Take screenshots of:
   - Standard nodes
   - Group nodes (collapsed and expanded)
   - Group halos at different nesting depths
   - Selection states
   - Tooltips
   - Canvas background

#### During Migration
1. Replace content of `src/constants/theme.jsx` with `src/constants/theme-tokens.jsx`
2. Delete `src/constants/theme-tokens.jsx` (no longer needed)
3. No code changes in any consuming files

#### After Migration
1. ✅ Run full test suite: `npm test` - all 317+ tests must pass
2. ✅ Start dev server: `npm run dev`
3. ✅ Visual regression testing:
   - Compare screenshots from "Before" step
   - Verify colors, sizing, spacing are identical
   - Test interactions: hover, selection, collapse/expand
   - Test nested groups with multiple depth levels
4. ✅ Check browser console for errors
5. ✅ Verify tooltip displays correctly on group/ungroup actions
6. ✅ Test keyboard shortcuts panel styling

#### Rollback Plan
If anything breaks:
1. Restore original `src/constants/theme.jsx` from git
2. Delete `src/constants/theme-tokens.jsx`
3. Commit: `git checkout src/constants/theme.jsx`

### Phase 5: Post-Migration Benefits

Once migrated, we gain:

**Maintainability Wins:**
- Easy to see full color palette at a glance
- Quick to find "what purples do we use?"
- Confident changes: modify a token, see exactly where it's used
- Self-documenting: token names explain intent

**Future Flexibility:**
- Adding themes becomes trivial (just swap token values)
- Rebranding: change palette at the top
- Design system audit: scan tokens section
- Easy to add dark/light mode variants

### Phase 6: Documentation Updates

After successful migration:

1. Update [.agent/system/project_architecture.md](../system/project_architecture.md):
   - Change "Hardcoded Theme System" section to describe token-based approach
   - Add note about design token philosophy

2. Update [.agent/README.md](../README.md):
   - Update "Hardcoded theme system" link description

3. Consider creating [.agent/sop/theme-modifications.md](../sop/theme-modifications.md):
   - How to add new colors
   - How to modify existing values
   - How to ensure consistency

## Risk Assessment

**Risk Level: LOW** ⚠️

**Why Low Risk:**
- ✅ No API structure changes - all paths identical
- ✅ No value changes - exact 1:1 mapping
- ✅ Comprehensive test suite will catch any mistakes
- ✅ Easy rollback via git

**Potential Issues:**
- ⚠️ If we missed a THEME usage location (use grep to double-check)
- ⚠️ If tests have hardcoded assumptions about theme structure (unlikely - they use THEME.* paths)

## Execution Checklist

Before running migration:
- [ ] Read this plan completely
- [ ] Run `npm test` to establish baseline
- [ ] Run `npm run dev` and visually verify current state
- [ ] Take screenshots of key UI elements
- [ ] Create feature branch: `git checkout -b refactor/theme-token-migration`

During migration:
- [ ] Copy content from `theme-tokens.jsx` to `theme.jsx`
- [ ] Delete `theme-tokens.jsx`
- [ ] Run `npm test` - all tests must pass
- [ ] Run `npm run dev` and verify visually
- [ ] Compare with "before" screenshots

After migration:
- [ ] Commit changes: `git add src/constants/theme.jsx && git commit -m "refactor: migrate to token-based theme structure"`
- [ ] Delete this task file: `rm .agent/tasks/theme-token-migration.md`
- [ ] Update project architecture docs (Phase 6)
- [ ] Celebrate! 🎉

## Notes

- Original theme file will be completely replaced, not modified
- No intermediate state - it's an atomic swap
- The token file (`theme-tokens.jsx`) is just a preview - once we copy it over, we delete it
- This refactor is purely internal - no external behavior changes
