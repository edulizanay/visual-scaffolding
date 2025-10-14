# Refactoring Plan: #3 and #4 for groupUtils.js

**Target File:** `src/utils/groupUtils.js`
**Test File:** `tests/groupHelpers.test.js`
**Objective:** Eliminate duplication and improve readability through two independent refactorings
**Risk Level:** Low (zero behavior change, all tests must pass)

---

## Refactoring #3: Extract Visibility Flag Management

### Problem
The `subtreeHidden` flag management pattern is duplicated 4 times in the codebase:
- Lines 156-160 (in `applyGroupVisibility` - group node branch)
- Lines 169-173 (in `applyGroupVisibility` - regular node branch)
- Lines 342-344 (in `ungroup`)
- Lines 370-374 (in `collapseSubtreeByHandles`)

**Current pattern:**
```javascript
if (subtreeHidden) {
  result.subtreeHidden = true;
} else if ('subtreeHidden' in result) {
  delete result.subtreeHidden;
}
```

**Why this matters:**
- Maintenance burden: Change in 4 places if logic needs updating
- Inconsistency risk: Easy to update 3 places and miss the 4th
- Intent unclear: Pattern doesn't explain WHY we delete vs set to false

### Solution
Extract a helper function that handles the flag consistently.

**Add this helper after imports, before `buildNodeMap` (around line 27):**

```javascript
/**
 * Applies or removes the subtreeHidden flag from a node.
 * When hidden=true, adds the flag. When hidden=false, removes it entirely.
 * This ensures the property is absent when not needed (cleaner state).
 */
const setSubtreeHidden = (node, hidden) => {
  if (hidden) {
    return { ...node, subtreeHidden: true };
  }
  // Remove the property entirely when not hidden
  const { subtreeHidden, ...rest } = node;
  return rest;
};
```

### Implementation Steps

#### Step 3.1: Update `applyGroupVisibility` - Group node branch (lines 147-162)

**Before:**
```javascript
if (node.type === 'group') {
  const isCollapsed = node.isCollapsed === true;
  const result = {
    ...node,
    groupHidden: hiddenByAncestor,
    hidden: hiddenByAncestor || subtreeHidden || !isCollapsed,
  };
  if (subtreeHidden) {
    result.subtreeHidden = true;
  } else if ('subtreeHidden' in result) {
    delete result.subtreeHidden;
  }
  return result;
}
```

**After:**
```javascript
if (node.type === 'group') {
  const isCollapsed = node.isCollapsed === true;
  const result = {
    ...node,
    groupHidden: hiddenByAncestor,
    hidden: hiddenByAncestor || subtreeHidden || !isCollapsed,
  };
  return setSubtreeHidden(result, subtreeHidden);
}
```

#### Step 3.2: Update `applyGroupVisibility` - Regular node branch (lines 164-175)

**Before:**
```javascript
const result = {
  ...node,
  groupHidden: hiddenByAncestor,
  hidden: hiddenByAncestor || subtreeHidden || (previouslyHidden && !previousGroupHidden),
};
if (subtreeHidden) {
  result.subtreeHidden = true;
} else if ('subtreeHidden' in result) {
  delete result.subtreeHidden;
}
return result;
```

**After:**
```javascript
const result = {
  ...node,
  groupHidden: hiddenByAncestor,
  hidden: hiddenByAncestor || subtreeHidden || (previouslyHidden && !previousGroupHidden),
};
return setSubtreeHidden(result, subtreeHidden);
```

#### Step 3.3: Update `ungroup` (lines 330-346)

**Before:**
```javascript
const next = {
  ...node,
  hidden: false,
  groupHidden: false,
};

if (parentGroupId) {
  next.parentGroupId = parentGroupId;
} else if ('parentGroupId' in next) {
  delete next.parentGroupId;
}

if ('subtreeHidden' in next) {
  delete next.subtreeHidden;
}

return next;
```

**After:**
```javascript
let next = {
  ...node,
  hidden: false,
  groupHidden: false,
};

if (parentGroupId) {
  next.parentGroupId = parentGroupId;
} else if ('parentGroupId' in next) {
  delete next.parentGroupId;
}

next = setSubtreeHidden(next, false);
return next;
```

#### Step 3.4: Update `collapseSubtreeByHandles` (lines 364-378)

**Before:**
```javascript
const updatedNodes = nodes.map((node) => {
  if (node.id === nodeId) {
    return { ...node, data: { ...node.data, collapsed } };
  }
  if (descendantSet.has(node.id)) {
    const next = { ...node, hidden: collapsed };
    if (collapsed) {
      next.subtreeHidden = true;
    } else if ('subtreeHidden' in next) {
      delete next.subtreeHidden;
    }
    return next;
  }
  return node;
});
```

**After:**
```javascript
const updatedNodes = nodes.map((node) => {
  if (node.id === nodeId) {
    return { ...node, data: { ...node.data, collapsed } };
  }
  if (descendantSet.has(node.id)) {
    const next = { ...node, hidden: collapsed };
    return setSubtreeHidden(next, collapsed);
  }
  return node;
});
```

### Expected Impact (Refactoring #3)
- Lines reduced: ~15 lines (4 occurrences × 5 lines → 4 calls × 1 line + 8-line helper)
- Duplication: 4 copies → 1 function
- Readability: Function name makes intent explicit
- Maintenance: Single place to update flag logic

---

## Refactoring #4: Simplify `computeHaloPaddingForDepth` Loop

### Problem
The `computeHaloPaddingForDepth` function (lines 524-552, 28 lines) uses imperative style with mutable variables to compute a mathematical formula.

**Current issues:**
- 3 mutable variables (`padding`, `currentStep`, `appliedStep`)
- Imperative loop obscures the mathematical formula
- Hard to follow: must mentally trace state across iterations
- Formula is: `base + Σ(max(minStep, round(increment × decay^i)))` for i=0 to depth-1

**Example calculation (depth=3, base=18, increment=12, decay=0.7, minStep=1):**
```
level 0: 12 × 0.7^0 = 12 → max(1, 12) = 12
level 1: 12 × 0.7^1 = 8.4 → max(1, 8) = 8
level 2: 12 × 0.7^2 = 5.88 → max(1, 6) = 6
result: 18 + 12 + 8 + 6 = 44
```

### Solution
Replace imperative loop with functional `reduce` that makes the mathematical formula explicit.

### Implementation Steps

#### Step 4.1: Replace entire function (lines 524-552)

**Before (28 lines):**
```javascript
const computeHaloPaddingForDepth = (depth, config) => {
  const base = typeof config.base === 'number' ? config.base : 0;
  const minStep = typeof config.minStep === 'number' && config.minStep > 0 ? config.minStep : 0;
  const decay = typeof config.decay === 'number' ? config.decay : 1;
  const initialIncrement = typeof config.increment === 'number' ? config.increment : 0;

  if (!Number.isFinite(depth) || depth <= 0) {
    return base;
  }

  let padding = base;
  let currentStep = initialIncrement;

  for (let i = 0; i < depth; i += 1) {
    let appliedStep = 0;

    if (Number.isFinite(currentStep)) {
      const rounded = Math.round(currentStep);
      appliedStep = rounded <= 0 ? minStep : Math.max(minStep, rounded);
    } else {
      appliedStep = minStep;
    }

    padding += appliedStep;
    currentStep = Number.isFinite(currentStep) ? currentStep * decay : 0;
  }

  return padding;
};
```

**After (14 lines):**
```javascript
const computeHaloPaddingForDepth = (depth, config) => {
  const { base = 0, minStep = 0, decay = 1, increment = 0 } = config;

  if (!Number.isFinite(depth) || depth <= 0) {
    return base;
  }

  // Compute: base + sum of (increment × decay^level) for each level
  return Array.from({ length: depth }).reduce((padding, _, level) => {
    const step = increment * Math.pow(decay, level);
    const appliedStep = Number.isFinite(step)
      ? Math.max(minStep, Math.round(step))
      : minStep;
    return padding + appliedStep;
  }, base);
};
```

### Expected Impact (Refactoring #4)
- Lines reduced: 28 → 14 lines (50% reduction)
- Mutable variables: 3 → 0
- Readability: Mathematical formula is now explicit (`increment * Math.pow(decay, level)`)
- Testability: Each iteration's calculation is now a single expression

---

## Combined Testing Strategy

### Pre-refactoring Checks
1. Run full test suite: `npm test`
2. Verify all 542 tests pass
3. Note current test execution time

### During Implementation
1. Implement refactoring #3 first (4 changes)
2. Run tests: `npm test -- tests/groupHelpers.test.js`
3. Verify 24 tests pass
4. Implement refactoring #4 (1 function replacement)
5. Run tests: `npm test -- tests/groupHelpers.test.js`
6. Verify 24 tests still pass

### Post-refactoring Validation
1. Run full test suite: `npm test`
2. Verify all 542 tests pass
3. Check test execution time (should be identical)
4. Manually test group halo rendering in UI
5. Test nested group padding calculations

### Test Coverage Targets
All existing tests must pass without modification. Key test files:
- `tests/groupHelpers.test.js` (24 tests) - Direct coverage
- `tests/unit/frontend/GroupHaloOverlay.test.jsx` (3 tests) - Halo rendering
- `tests/unit/frontend/App-group-behavior.test.jsx` (6 tests) - Group interactions
- `tests/api-group-operations.test.js` (15 tests) - API endpoints

---

## Risk Assessment

### Low Risk Factors
- **Pure refactoring:** Zero behavior change intended
- **Well-tested:** 542 existing tests cover affected code paths
- **Isolated changes:** Both refactorings are self-contained
- **Reversible:** Changes can be easily reverted if issues arise

### Mitigation Strategies
- Run tests after each refactoring step (not just at the end)
- Keep changes in separate commits for easier debugging
- Verify test count stays at 542 (no tests accidentally skipped)
- Manual QA of group halo rendering after completion

---

## Commit Strategy

### Option A: Single Commit (Recommended)
```bash
git add src/utils/groupUtils.js
git commit -m "refactor: extract subtree flag helper and simplify padding loop

- Extract setSubtreeHidden helper to eliminate 4 instances of duplication
- Replace imperative padding loop with functional reduce
- No behavior change, all 542 tests pass

Reduces ~30 lines and eliminates 3 mutable variables."
```

### Option B: Two Commits
```bash
# Commit 1
git add src/utils/groupUtils.js
git commit -m "refactor: extract setSubtreeHidden helper

Eliminates 4 instances of flag management duplication."

# Commit 2
git add src/utils/groupUtils.js
git commit -m "refactor: simplify computeHaloPaddingForDepth

Replace imperative loop with functional reduce."
```

---

## Success Criteria

✅ All 542 tests pass
✅ Test execution time unchanged
✅ No new linting errors
✅ Group halos render correctly in UI
✅ Nested group padding calculations produce identical results
✅ Code is more readable (peer review confirms)
✅ ~30 lines reduced, 3 mutable variables eliminated

---

## Rollback Plan

If any issues arise:
1. `git revert HEAD` (if single commit)
2. Or `git revert HEAD HEAD~1` (if two commits)
3. Verify tests pass after revert
4. Document issue for future reference

---

## References

- Original analysis: See conversation with Edu on refactoring ideas
- Target file: `src/utils/groupUtils.js`
- Documentation: `.agent/system/group_nodes_system.md`
- Related tests: `tests/groupHelpers.test.js`

---

**Estimated Time:** 15-20 minutes
**Complexity:** Low
**Confidence Level:** High (mechanical refactoring with comprehensive tests)
