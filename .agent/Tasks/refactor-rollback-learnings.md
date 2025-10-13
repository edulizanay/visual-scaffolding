# Refactor Rollback: What We Tried & What We Learned

**Date:** 2025-10-13
**Branch:** `refactor/save-centralization` (TO BE ROLLED BACK)
**Status:** Failed - Rolling back to main

---

## What We Tried

### Goal:
Remove frontend autosave useEffect to centralize all saves in the backend, eliminating double-save bugs and race conditions.

### Changes Made:
1. ✅ Removed autosave useEffect from App.jsx (lines 105-120)
2. ✅ Removed `isBackendProcessing` state and guards
3. ✅ Added explicit save on drag-stop (`onNodeDragStop`)
4. ✅ Fixed ChatInterface tests (36/36 passing)
5. ✅ Backend tests still passing (9/10 double-save prevention tests)

### Test Results Before Manual Testing:
- 340/366 tests passing (93%)
- All backend save tests passing
- Double-save prevention tests passing
- **Tests said: "Everything works!" ✅**

---

## What Broke (Manual Testing Revealed)

### Bug #1: Drag + Undo Doesn't Work ❌
**What happened:**
- Drag node to new position
- Press Cmd+Z
- **Node doesn't return to original position**

**Why it broke:**
- `onNodeDragStop` used stale nodes/edges from closure
- Fixed by using refs, but still didn't work fully
- Root cause: Layout animation changes positions AFTER drag, creating mismatch

### Bug #2: Layout Animation Positions Not Saved ❌
**What happened:**
- LLM creates nodes
- Layout animation calculates positions
- **Calculated positions never saved to database**
- Visual state ≠ Database state

**Why it broke:**
- Removing autosave removed the mechanism that saved layout positions
- Backend saves nodes with simple positions (0, 0)
- Layout calculates real positions (100, 200)
- We removed the save that persisted calculated positions

### Bug #3: LLM Node Accumulation (CRITICAL) ❌
**What happened:**
1. Ask LLM to create child node → 1 node created
2. Undo
3. Ask LLM same thing → 2 nodes created
4. Undo
5. Ask LLM same thing → 3 nodes created
6. **Nodes multiply with each undo+retry cycle**

**Why it broke:**
- Undo restores incomplete snapshot (without layout positions)
- LLM conversation history still contains previous tool calls
- LLM reads incomplete database state
- LLM thinks "I need to complete what I started before" → creates duplicates
- Database/conversation context out of sync

---

## Why Our Tests Didn't Catch This

### The Fundamental Gap:

**We tested:** Individual save operations (backend plumbing)
**We didn't test:** Complete user workflows (end-to-end flows)

### Specific Missing Tests:

#### Missing Test #1: Drag + Undo Integration
```
MISSING: tests/integration/drag-undo-flow.test.js

Should test:
- Create node at position (0, 0)
- Drag to (100, 100)
- Save triggered
- Undo
- Verify: node back at (0, 0)

Why it matters:
- Would catch stale closure bugs
- Would catch position save bugs
- Would catch snapshot completeness bugs
```

#### Missing Test #2: Layout Animation Save
```
MISSING: tests/integration/layout-animation-save.test.js

Should test:
- LLM creates 3 nodes (backend saves with simple positions)
- Wait for layout animation to complete
- Check database: nodes have calculated positions (not simple positions)
- Undo
- Verify: nodes restored correctly

Why it matters:
- Would catch "layout positions not saved" bug
- Would catch database/visual state mismatches
- Would catch incomplete snapshot bugs
```

#### Missing Test #3: LLM Undo + Retry
```
MISSING: tests/integration/llm-undo-retry.test.js

Should test:
- LLM creates 3 nodes
- Undo
- Same LLM request again
- Verify: still only 3 nodes (not 6)
- Undo again
- Third LLM request
- Verify: still only 3 nodes (not 9)

Why it matters:
- Would catch conversation context accumulation bug
- Would catch database/LLM context sync issues
- Would catch the CRITICAL multiplicative bug
```

#### Missing Test #4: Visual State = Database State
```
MISSING: tests/integration/visual-database-sync.test.js

Should test:
- Perform any operation (create node, drag, layout, etc)
- Read visual state (what React Flow displays)
- Read database state (what's in SQLite)
- Assert: positions match exactly

Why it matters:
- Would catch ANY state sync issues
- Would catch incomplete saves
- Would catch layout animation save gaps
```

#### Missing Test #5: Complete Undo Workflow
```
MISSING: tests/e2e/undo-workflow.test.js (Playwright)

Should test:
- User creates 5 nodes via different methods (chat, drag, double-click)
- User drags 2 nodes
- User presses Cmd+Z 7 times (5 creates + 2 drags)
- Verify: canvas empty
- User presses Cmd+Shift+Z 7 times
- Verify: all 5 nodes back with correct positions

Why it matters:
- Would catch ALL undo/redo bugs
- Would catch state management issues
- Would catch the complete user experience
```

---

## What We Learned

### Lesson #1: Unit Tests Are Not Enough
✅ **Backend unit tests** verified save logic works
❌ **Backend unit tests** didn't verify WHAT was saved (complete vs incomplete state)

**Takeaway:** Need integration tests that verify database contents, not just "did a save happen?"

### Lesson #2: Testing Plumbing ≠ Testing User Flows
✅ **We tested:** Backend creates snapshots (plumbing)
❌ **We didn't test:** User drag → save → undo → restore (flow)

**Takeaway:** Need E2E tests that simulate actual user workflows, not just API calls.

### Lesson #3: Frontend + Backend Integration Is Critical
✅ **Backend tests** passed in isolation
✅ **Frontend tests** passed in isolation
❌ **Integration** between them broke (layout animation, state sync)

**Takeaway:** Need tests that cross the frontend/backend boundary (layout animation triggers backend save).

### Lesson #4: Conversation Context Is Part of State
We thought about:
- Database state ✓
- Visual state ✓

We forgot about:
- **LLM conversation context** ❌

Undo affects database but not conversation → out of sync → accumulation bug.

**Takeaway:** Need to test that ALL stateful systems (DB, visual, conversation) stay in sync.

### Lesson #5: Manual Testing Found What Tests Missed
Our 340 passing tests said "everything works!"
5 minutes of manual testing found 3 critical bugs.

**Takeaway:** Automated tests give false confidence without E2E/integration coverage.

---

## Tests to Keep from This Branch

Even though we're rolling back the code changes, we should keep the test infrastructure:

### ✅ Keep These Test Files:
1. **tests/integration/double-save-prevention.test.js** (10 tests, 9 passing)
   - Tests backend save behavior
   - Catches future double-save bugs
   - Good foundation, just incomplete

2. **tests/integration/save-paths.test.js** (15 tests, 14 passing)
   - Verifies all save paths create snapshots
   - Useful for future refactors

3. **tests/integration/save-race-conditions.test.js** (10 tests, 9 passing)
   - Tests concurrent operations
   - Catches race conditions

4. **.agent/Tasks/save-centralization-diagnosis.md**
   - Documents the root cause analysis
   - Still accurate understanding of the problem

5. **.agent/Tasks/test-protection-analysis.md**
   - Explains test coverage gaps
   - Useful for future test planning

### ❌ Delete These Test Files:
1. **tests/unit/frontend/autosave-tracking.test.jsx**
   - Documentation tests only, no real value

2. **tests/unit/frontend/autosave-real-test.test.jsx**
   - Just explains testing limitations

3. **tests/unit/frontend/App-autosave.test.jsx**
   - CSS import errors, doesn't run

---

## Tests We Need to Add (On Main Branch)

### Priority 1: CRITICAL (Must Have Before Any Refactor)

**1. Drag + Undo Integration Test**
```
File: tests/integration/drag-undo.test.js
Purpose: Verify drag+undo restores original position
Effort: 2-3 hours
Value: Would have caught Bug #1
```

**2. Layout Animation Save Test**
```
File: tests/integration/layout-save.test.js
Purpose: Verify layout positions are saved to database
Effort: 3-4 hours
Value: Would have caught Bug #2
```

**3. LLM Undo + Retry Test**
```
File: tests/integration/llm-undo-retry.test.js
Purpose: Verify nodes don't accumulate after undo+retry
Effort: 2-3 hours
Value: Would have caught Bug #3 (CRITICAL)
```

### Priority 2: Important (Should Have)

**4. Visual/Database State Sync Test**
```
File: tests/integration/state-sync.test.js
Purpose: Verify visual state always matches database
Effort: 4-5 hours
Value: Catches ANY state sync issues
```

**5. Complete Undo Workflow E2E Test**
```
File: tests/e2e/undo-workflow.spec.js (Playwright)
Purpose: Full user workflow with undo/redo
Effort: 4-6 hours (includes Playwright setup)
Value: Catches ALL user-facing bugs
```

### Priority 3: Nice to Have

**6. Conversation Context Sync Test**
```
File: tests/integration/conversation-context.test.js
Purpose: Verify undo doesn't break LLM context
Effort: 3-4 hours
Value: Prevents future conversation bugs
```

---

## Recommended Next Steps

### Before Any Future Refactor:

1. **Write Priority 1 tests first** (drag-undo, layout-save, llm-undo-retry)
   - These would have caught ALL the bugs we hit
   - Estimate: 1-2 days of work
   - Worth it: Prevents wasted refactor efforts

2. **Set up Playwright for E2E tests**
   - We need to test actual user workflows
   - Backend tests alone are insufficient
   - Estimate: 1 day setup + ongoing test writing

3. **Define "Refactor Ready" Checklist**
   ```
   Before declaring refactor ready:
   - [ ] All Priority 1 integration tests written and passing
   - [ ] At least 1 E2E test covering the workflow
   - [ ] Manual testing plan documented
   - [ ] State sync verified (visual = database)
   - [ ] Conversation context verified (if LLM involved)
   ```

### Alternative Approach: Smaller Refactor

Instead of removing autosave entirely, consider:
- Keep autosave BUT fix the guards to actually work
- Add better debouncing to prevent double-saves
- Make autosave more reliable rather than removing it

**Why this might be better:**
- Autosave handles layout animation saves naturally
- Less risky than architectural change
- Can be done incrementally

---

## Summary: What Tests Are Missing Today?

| Test Type | What We Have | What We Need |
|-----------|--------------|--------------|
| Backend unit tests | ✅ Excellent (31 tests) | - |
| Frontend unit tests | ✅ Good (36 ChatInterface tests) | ReactFlow interaction tests |
| Backend integration tests | ✅ Good (34 save tests) | Incomplete - only test plumbing |
| **Frontend integration tests** | ❌ **NONE** | ❌ **Drag+undo, layout save** |
| **Cross-boundary integration** | ❌ **NONE** | ❌ **Layout animation → backend save** |
| **E2E tests** | ❌ **NONE** | ❌ **Complete user workflows** |
| **LLM conversation tests** | ❌ **NONE** | ❌ **Undo+retry, context sync** |
| **State sync tests** | ❌ **NONE** | ❌ **Visual = Database verification** |

---

## Commit to Keep/Merge to Main

Even though we're rolling back the refactor, we should merge this commit to main:

**Commit:** `f8f3813` - "test: add comprehensive save system tests and diagnosis"

**Why keep it:**
- 34 new backend tests (31 passing)
- Test infrastructure is valuable
- Diagnosis documents are accurate
- Helps future refactor attempts

**What NOT to merge:**
- `393f4c4` - "refactor: centralize save logic to backend-only" (THE FAILED REFACTOR)
- `22da1cf` - "fix: use refs in onNodeDragStop to capture current state" (DIDN'T FULLY WORK)

---

## The Bottom Line

**What we tried:** Remove autosave to fix double-save bug
**What we learned:** Autosave was also saving layout positions (hidden dependency)
**Why tests didn't catch it:** We tested save mechanics, not complete user workflows
**What we need:** Integration tests that verify visual state = database state
**Effort to do it right:** ~2 days of test writing before attempting refactor again

**Recommendation:** Add Priority 1 tests to main branch BEFORE attempting any save refactor.

---

**Status:** Ready to roll back to main and cherry-pick test commits.
