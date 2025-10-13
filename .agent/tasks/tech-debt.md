# Technical Debt Inventory

## ID Generation Inconsistencies

### Issue
Multiple ID generation patterns exist across the codebase with no clear rationale.

**Current State:**
- `generateId()` - Used for edges and some nodes: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
- Node IDs - Try sanitized label first, fall back to `generateId()`
- Group IDs - ~~Used timestamp only (FIXED)~~ Now uses `generateId()`

**Historical Context:**
- `generateId()` existed from the beginning with proper randomness
- Group functionality added later (Oct 12) used simpler `group-${Date.now()}` pattern
- Caused timestamp collision bug when tests ran fast in Vitest
- Bug was latent in production but rare (requires <1ms between group creations)

**What Was Fixed:**
```javascript
// Before (BUG):
const groupId = `group-${Date.now()}`;

// After (FIXED):
const groupId = generateId();
```

**Recommendation:**
Create a unified ID generation strategy:
1. Define when semantic IDs are appropriate (e.g., sanitized labels for nodes)
2. Document why certain entities get prefixes (e.g., `group-`)
3. Ensure all IDs include randomness to prevent collisions
4. Consider creating type-specific generators: `generateNodeId()`, `generateGroupId()`, etc.

---

## Undo/Redo Position-Only Update Feature

### Issue
Two tests expect a "smart position-only update" feature that was never implemented.

**Affected Tests:**
1. `tests/db.test.js` - "should update positions without creating new snapshot"
2. `tests/undo-redo-autosave.test.js` - "auto-save with position change after undo should not truncate redo chain"

**Expected Behavior (Not Implemented):**
- When pushing a snapshot that differs only in node positions (not data/labels)
- System should UPDATE the existing snapshot instead of creating a new one
- Redo chain should be preserved after undo + position-only change

**Actual Behavior:**
- `pushUndoSnapshot()` only skips if 100% identical (exact JSON match)
- Any difference creates a new snapshot
- Any snapshot after undo truncates the redo chain

**Why Tests Existed:**
- Tests were added Oct 6-10 in commits related to undo/redo fixes
- Never ran in Jest due to `testMatch` pattern exclusion
- Vitest discovered them during migration

**Options:**
1. **Delete tests** - Feature never existed, tests are aspirational
2. **Implement feature** - Requires significant work:
   - Position-only change detection logic
   - Redo chain preservation strategy
   - Complex edge cases (what counts as "position-only"?)
3. **Mark as `.skip` with TODO** - Document as future feature request
4. **Update test expectations** - Test current behavior (creates 2 snapshots)

**Recommendation:**
Option 1 or 3. This is a nice-to-have UX feature but adds significant complexity to the undo system. If users complain about "undo pollution from dragging nodes", revisit as a feature request.

---

## Jest Test Discovery Gaps (RESOLVED)

### Issue
Jest configuration excluded several test files at project root.

**What Happened:**
- Jest `testMatch` only included `tests/unit/backend/**`, `tests/integration/**`, etc.
- But several tests lived at `tests/*.test.js` (root level)
- Files excluded: `db.test.js`, `undo-redo-autosave.test.js`, `api-*.test.js`
- These tests NEVER RAN until Vitest migration

**Resolution:**
- Vitest config explicitly includes all root-level test files
- Migration discovered 278 MORE tests than Jest (544 vs 266)
- Found 1 production bug and 2 stale tests

**Lesson Learned:**
Always verify test discovery. Use `--listTests` or similar to audit what's actually running.

---

## Summary

**Fixed:**
- ✅ Group ID timestamp collision bug

**Needs Decision:**
- ⚠️ Two stale tests expecting unimplemented feature
- ⚠️ ID generation strategy unification

**Discovered by Migration:**
- 278 additional tests
- 1 production bug
- 2 aspirational/stale tests
