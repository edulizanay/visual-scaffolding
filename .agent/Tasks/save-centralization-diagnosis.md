# Save Centralization: Problem Diagnosis

**Created:** 2025-10-13
**Status:** Diagnosis Complete - Awaiting PRD Approval

---

## Problem Statement

Undo/redo breaks unpredictably during feature development due to **multiple competing save paths** that interfere with each other.

---

## Root Cause Analysis

### The Four Save Paths (CURRENT STATE)

```
1. Frontend Autosave (App.jsx:105-120)
   User action → State change → 500ms debounce → saveFlow() → snapshot
   Guards: isLoading, isAnimating, isBackendProcessing

2. API Commands (server.js + api.js)
   API call → Backend saves → Returns flow → handleFlowUpdate() → triggers autosave AGAIN

3. LLM Tool Execution (tools/executor.js)
   LLM tools → Backend saves → Returns flow → triggers autosave AGAIN

4. Layout Animation (App.jsx:138-140)
   Layout runs → Updates positions → triggers autosave
```

**Problem:** Paths 2-4 all trigger Path 1, causing **double-saves and race conditions**.

---

## Evidence of The Problem

### Race Condition Examples

**Example 1: Creating Node Inside Group**
```
User: Create node in group via API
→ Backend saves + snapshot (✓)
→ Returns updated flow
→ handleFlowUpdate() sets state
→ Autosave triggers AGAIN (✗ double-save)
→ Sometimes layout runs before autosave completes
→ Undo/redo history corrupted
```

**Example 2: Auto-Layout Interference**
```
LLM creates nodes
→ Backend saves + snapshot (✓)
→ Returns flow
→ handleFlowUpdate() sets state
→ 100ms delay, then layout starts
→ Autosave debounce (500ms) starts counting
→ Layout completes, updates positions
→ Autosave countdown resets (500ms again)
→ TWO saves happen (✗)
```

---

## Test Coverage Analysis

### What We Have ✅

**Backend (Excellent)**
- ✅ Database operations (save, load, migrations)
- ✅ Snapshot system (push, undo, redo, deduplication, limits)
- ✅ All 11 tool operations
- ✅ All REST API endpoints
- ✅ LLM integration

**Metrics:**
- 317 total tests
- 302 passing (95%)
- 15 failing (React act() warnings, non-critical)
- 5,543 lines of test code

### What We DON'T Have ⚠️

**Critical Gaps:**
- ❌ No test for double-save prevention
- ❌ No test verifying API operations create snapshots
- ❌ No test verifying LLM operations create snapshots
- ❌ No test for race conditions between save paths
- ❌ No test for 500ms autosave debounce
- ❌ No test for frontend save guards
- ❌ No test for handleFlowUpdate() triggering autosave

**Impact:** The bugs we're experiencing have **ZERO test coverage**.

---

## Key Functions & Their Tests

### Well Tested ✅

| Function | Location | Test File |
|----------|----------|-----------|
| `saveFlow()` | server/db.js | tests/db.test.js |
| `pushSnapshot()` | server/historyService.js | tests/historyService.test.js |
| `undo()` / `redo()` | server/historyService.js | tests/historyService.test.js |
| `executeToolCalls()` | server/tools/executor.js | tests/toolExecution.test.js |
| All API endpoints | server/server.js | tests/api-*.test.js |

### NOT Tested ⚠️

| Function | Location | Test File | Impact |
|----------|----------|-----------|--------|
| Frontend autosave useEffect | App.jsx:105-120 | ❌ NONE | HIGH |
| `handleFlowUpdate()` | App.jsx:122-141 | ❌ NONE | HIGH |
| `writeFlow()` snapshot behavior | server/server.js:21-27 | ❌ NONE | HIGH |
| Layout animation save trigger | App.jsx:138-140 | ❌ NONE | MEDIUM |
| Save coordination logic | ❌ MISSING | ❌ NONE | CRITICAL |

---

## Proposed Solution

### Centralized Save Architecture

**Single Source of Truth: Backend ONLY**

```
FRONTEND                    BACKEND
--------                    -------
User action
  ↓
API call ──────────────────→ Execute operation
                              ↓
                             writeFlow() + pushSnapshot()
                              ↓
                             Return updated flow
  ←──────────────────────────
  ↓
setNodes/setEdges
(display only, NO SAVE)
```

### Changes Required

**Remove:**
- ❌ Frontend autosave useEffect (App.jsx:105-120)
- ❌ `skipSnapshot` parameter complexity
- ❌ `isAnimating` / `isBackendProcessing` guards (no longer needed)

**Add:**
- ✅ Explicit drag-stop save handler
- ✅ Backend ensures `writeFlow()` called exactly once per operation

**Simplify:**
- ✅ `handleFlowUpdate()` becomes display-only (no save trigger)
- ✅ Layout is display-only (no save trigger)

### Benefits

1. **One save path** = No race conditions
2. **Backend owns persistence** = Clear responsibility
3. **Frontend owns display** = Simpler React logic
4. **Explicit saves** = Predictable behavior
5. **Easier to test** = Single path to verify

---

## Test Strategy

### Phase 1: Write Failing Tests (Prove Bugs Exist)

**Priority 1: CRITICAL**

1. `tests/integration/double-save-prevention.test.js`
   - API node creation saves exactly once
   - LLM tool execution saves exactly once
   - handleFlowUpdate does NOT trigger autosave
   - Verify snapshot count = 1 per operation

2. `tests/integration/save-paths.test.js`
   - Each save path creates snapshot
   - Verify single save per path
   - Count snapshots, assert = expected

3. `tests/integration/save-race-conditions.test.js`
   - Simultaneous operations (node creation + layout)
   - Rapid API calls
   - Undo during pending autosave
   - Layout during API call

**Expected Result:** These tests will FAIL (bugs exist in current code)

### Phase 2: Refactor Code

Implement centralized save architecture per "Proposed Solution" above.

### Phase 3: Verify Tests Pass

Run all tests, verify:
- ✅ Phase 1 tests now PASS
- ✅ Existing tests still PASS
- ✅ Zero regressions

### Phase 4: Write Future State Tests

1. `tests/integration/drag-save.test.js` (new feature)
2. `tests/unit/frontend/centralized-display.test.js`
3. `tests/e2e/complete-workflow.test.js`

---

## Success Criteria

**Must Have:**
- ✅ All Priority 1 tests written
- ✅ All tests pass (302 → 350+)
- ✅ Zero double-saves detected
- ✅ Zero race conditions detected
- ✅ Undo/redo works 100% of the time

**Metrics:**
- Before: 302/317 passing (95%), 38% functionality untested
- Target: 350+/350 passing (100%), 5% functionality untested

---

## Risk Assessment

### Low Risk ✅
- Backend is well-tested
- Individual components work correctly
- Clear architectural vision

### Medium Risk ⚠️
- Frontend autosave removal might break workflows
- Drag-stop save is new behavior (users must adapt)
- Need comprehensive testing before merge

### High Risk ❌
- **Attempting refactor without tests = GUARANTEED BREAKAGE**

**Mitigation:** Write tests FIRST, then refactor. This is non-negotiable.

---

## Next Steps

1. ✅ **Get approval on this diagnosis**
2. ✅ **Review/approve PRD** (separate document)
3. 🔄 **Write Priority 1 tests** (expect failures)
4. 🔄 **Implement refactor** (per PRD)
5. 🔄 **Verify tests pass**
6. 🔄 **Write Phase 4 tests**
7. 🎉 **Ship it!**

---

**Status:** Awaiting Edu's approval to proceed with PRD.
