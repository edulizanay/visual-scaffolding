# Phase 4 – Local QA Script

> Created: 2025-10-20
> Purpose: Validate backend save funnel implementation locally before merging to main

---

## Test Environment

- **Branch**: `feature/backend-save-phase-3`
- **Node version**: v20.15.1
- **Test database**: `server/data/flow.db`
- **Start command**: `npm run dev:all`

---

## Part 1: Baseline Test (Flags OFF)

### Setup
```bash
# Ensure flags are OFF (default)
npm run dev:all
```

### Manual QA Steps

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Single node drag | Node moves, autosave persists after 500ms debounce | [ ] |
| 2 | Multi-node drag (3 nodes) | All nodes move, autosave persists | [ ] |
| 3 | Alt+Click node with children | Subtree collapses, autosave persists | [ ] |
| 4 | Alt+Click again | Subtree expands, autosave persists | [ ] |
| 5 | Undo (Cmd+Z) | Reverts to previous state | [ ] |
| 6 | Redo (Cmd+Shift+Z) | Restores undone change | [ ] |
| 7 | Make LLM edit via chat | LLM updates flow, autosave persists | [ ] |
| 8 | Refresh page | All changes persisted correctly | [ ] |

### Database Verification (Flags OFF)
```bash
# Check recent snapshots - should show autosave pattern
sqlite3 server/data/flow.db "SELECT id, datetime(created_at, 'localtime') as time FROM undo_history ORDER BY id DESC LIMIT 10;"
```

**Expected**: Snapshots created by autosave debounce (500ms after changes)

---

## Part 2: Validation Test (Flags ON)

### Setup
```bash
# Kill server (Ctrl+C)
# Clean test data from previous run
sqlite3 server/data/flow.db "DELETE FROM undo_history WHERE created_at > datetime('now', '-1 hour');"

# Restart with flags ON
ENABLE_BACKEND_DRAG_SAVE=true ENABLE_BACKEND_SUBTREE=true npm run dev:all
```

### Manual QA Steps

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Single node drag | Node moves, immediate backend call | [ ] |
| 2 | Multi-node drag (3 nodes) | All nodes move, 3 backend calls | [ ] |
| 3 | Alt+Click node with children | Subtree collapses, immediate backend call | [ ] |
| 4 | Alt+Click again | Subtree expands, immediate backend call | [ ] |
| 5 | Undo (Cmd+Z) | Reverts to previous state | [ ] |
| 6 | Redo (Cmd+Shift+Z) | Restores undone change | [ ] |
| 7 | Make LLM edit via chat | LLM updates flow, backend persists | [ ] |
| 8 | Refresh page | All changes persisted correctly | [ ] |

### Log Verification (Flags ON)

Watch terminal for `[TOOL_EXECUTION]` logs during each action:

**Expected patterns:**
```
Single drag → 1x updateNode with origin:"ui.node.update"
Multi-node drag → 3x updateNode with origin:"ui.node.update"
Alt+Click → 1x toggleSubtreeCollapse with origin:"ui.subtree"
LLM edit → Nx tool calls with origin:"llm.tool"
```

### Database Verification (Flags ON)
```bash
# After single node drag:
sqlite3 server/data/flow.db "SELECT id, datetime(created_at, 'localtime') as time FROM undo_history ORDER BY id DESC LIMIT 3;"
# Expected: 1 new snapshot at drag-end time

# After 3-node drag:
sqlite3 server/data/flow.db "SELECT id, datetime(created_at, 'localtime') as time FROM undo_history ORDER BY id DESC LIMIT 5;"
# Expected: 3 new snapshots with same timestamp

# Check for NO background snapshots (wait 10 seconds idle):
sqlite3 server/data/flow.db "SELECT id, datetime(created_at, 'localtime') as time FROM undo_history ORDER BY id DESC LIMIT 5;"
# Expected: No new snapshots created while idle
```

---

## Part 3: Automated Test Coverage

### Run Full Test Suite
```bash
npm test
```

**Expected**: All 716 tests pass, including:
- Unit tests for `dragHelpers.js` and `subtreeHelpers.js`
- Integration test for drag-end persistence
- Subtree collapse/expand tests
- LLM tool execution tests

### Key Test Files
- `tests/unit/shared/dragHelpers.test.js` (9 tests)
- `tests/unit/shared/subtreeHelpers.test.js` (6 tests)
- `tests/integration/drag-end-persistence.test.js` (integration test)
- `tests/integration/subtree-collapse-backend.test.js` (backend route tests)

---

## Part 4: Rollback Drill

### Setup
```bash
# Kill server (Ctrl+C)
# Restart with flags OFF (back to autosave mode)
npm run dev:all
```

### Rollback Verification

| Step | Action | Expected Result | Status |
|------|--------|----------------|--------|
| 1 | Single node drag | Node moves, autosave resumes (500ms debounce) | [ ] |
| 2 | Check terminal logs | No `[TOOL_EXECUTION]` updateNode logs for drags | [ ] |
| 3 | Alt+Click subtree | Collapses locally, autosave persists | [ ] |
| 4 | Check terminal logs | No `[TOOL_EXECUTION]` toggleSubtreeCollapse logs | [ ] |
| 5 | Verify persistence | Refresh page, changes persisted via autosave | [ ] |

**Expected behavior**: System reverts to legacy autosave path seamlessly

---

## Part 5: Performance Check

### Latency Observations (Flags ON)

During manual testing, observe:
- **Drag responsiveness**: Should feel instant (backend calls are async, don't block UI)
- **Subtree collapse**: Should feel instant
- **Console logs**: Check `duration` field in `[TOOL_EXECUTION]` logs

**Target**: Operations complete in <50ms (local), <300ms would be acceptable for network calls in production

### Example Log Analysis
```
[TOOL_EXECUTION] {"timestamp":"...","tool":"updateNode","origin":"ui.node.update","duration":"0ms","success":true}
                                                                                     ^^^^^^^^^
```

---

## Results Summary Template

### Test Execution Date
- **Date**: YYYY-MM-DD
- **Tester**: Name
- **Environment**: Local development

### Baseline Test (Flags OFF)
- [ ] All manual QA steps passed
- [ ] Autosave behavior verified
- [ ] No regressions observed

### Validation Test (Flags ON)
- [ ] All manual QA steps passed
- [ ] Backend calls logged with correct origins
- [ ] Snapshot counts match tool executions
- [ ] No duplicate/background snapshots detected
- [ ] Multi-node drags work correctly

### Automated Tests
- [ ] 716/716 tests passing
- [ ] No new test failures
- [ ] Coverage maintained

### Rollback Drill
- [ ] Flags OFF restore autosave behavior
- [ ] No backend calls for drag/subtree operations
- [ ] Persistence still works via autosave

### Performance
- [ ] Drag operations feel responsive
- [ ] Subtree toggles feel instant
- [ ] Tool execution durations <50ms locally

### Issues Found
_Document any issues or unexpected behavior here_

---

## Sign-off

- [ ] All tests completed successfully
- [ ] No blocking issues found
- [ ] Ready to merge Phase 3 to main
- [ ] Ready to proceed to Phase 5

**Tester Signature**: _______________
**Date**: _______________
