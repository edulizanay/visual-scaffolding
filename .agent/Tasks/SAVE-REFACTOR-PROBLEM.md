# Save System Refactor - Problem & Learnings

**Date:** 2025-10-13
**Status:** Previous attempt failed, ready for fresh approach
**This document:** Problem statement, what we learned, what tests exist

---

## THE PROBLEM

**Symptom:** Undo/redo breaks unpredictably. Sometimes works, sometimes loses history, sometimes corrupts state.

**Root Cause:** Four competing save paths creating race conditions:

```
PATH 1: Frontend autosave (App.jsx:105-120)
   Watches [nodes, edges], triggers on ANY state change (500ms debounce)

PATH 2: Backend API operations (server.js)
   Every POST /api/node, /api/edge, /api/group calls writeFlow() → snapshot

PATH 3: LLM tool execution (tools/executor.js)
   Batches tools, saves once after batch completes

PATH 4: Layout animation (implicit)
   Dagre calculates positions → autosave triggers
```

**The Double-Save Bug:**
1. Backend creates node → saves (snapshot #1)
2. Returns flow to frontend
3. Frontend sets state → autosave triggers (snapshot #2) ← BUG
4. Layout animates → autosave triggers (snapshot #3) ← BUG

**Evidence:** Backend tests (31/34 passing) prove backend doesn't double-save. Bug is frontend autosave firing after backend already saved.

---

## WHAT WE TRIED

**Approach:** Remove frontend autosave useEffect entirely. Let backend own all saves.

**Changes made:**
- Removed autosave useEffect from App.jsx
- Added explicit save on drag-stop (`onNodeDragStop`)
- Removed `isBackendProcessing` guards

**Test results BEFORE manual testing:** 340/366 passing (93%). All backend save tests passing.

**Tests said:** "Everything works!" ✅

---

## WHAT BROKE (Manual Testing)

### Bug #1: Drag + Undo Doesn't Work
- Drag node to new position
- Press Cmd+Z
- **Node stays in new position** (doesn't restore)

### Bug #2: Layout Positions Not Saved
- LLM creates nodes → Layout calculates positions
- **Calculated positions never saved to database**
- Visual state ≠ Database state

### Bug #3: Node Accumulation (CRITICAL)
- Ask LLM "create child node" → 1 node appears
- Undo
- Ask LLM same thing → **2 nodes appear**
- Undo
- Ask LLM same thing → **3 nodes appear**
- Nodes multiply with each undo+retry cycle

---

## WHY TESTS DIDN'T CATCH IT

**What we tested:**
- ✅ Does backend create snapshots?
- ✅ Does backend double-save?
- ✅ Do API calls create correct snapshot counts?

**What we DIDN'T test:**
- ❌ After drag, does undo restore position? (complete workflow)
- ❌ After layout animation, are positions in database? (state sync)
- ❌ After undo+retry, do nodes accumulate? (LLM integration)
- ❌ Does visual state match database state? (fundamental invariant)

**The Gap:** We tested backend plumbing in isolation, not complete user workflows or frontend-backend integration.

---

## ROOT CAUSE ANALYSIS

### Bug #1: Drag + Undo
- `onNodeDragStop` used stale nodes/edges from closure
- When drag completes, positions already updated by React Flow
- Callback saved OLD positions (before drag)

### Bug #2: Layout Positions
- Removing autosave removed the mechanism that saved layout positions
- Backend saves nodes with simple positions (0, 0)
- Layout calculates real positions (100, 200)
- No save happens after layout completes
- Database has simple positions, screen shows calculated positions

### Bug #3: Node Accumulation
- Undo restores database snapshot (incomplete due to Bug #2)
- LLM conversation history still contains previous tool executions
- LLM sees incomplete database + remembers what it tried before
- LLM thinks "I need to finish what I started" → creates duplicates
- Accumulates: 1 → 2 → 3 → 4...

**Key insight:** All 3 bugs stem from incomplete snapshots (missing layout positions).

---

## CRITICAL LEARNINGS

### Learning #1: Unit Tests Give False Confidence
Backend tests passed in isolation. Frontend tests passed in isolation. Integration broke.

### Learning #2: Test Workflows, Not Plumbing
Testing "does snapshot exist?" is not the same as "does undo restore state?"

### Learning #3: State Sync Is Fundamental
If visual state ≠ database state, undo/redo WILL break eventually.

### Learning #4: Layout Animation Is Part of Save Flow
We thought autosave was "just a bug source." It was also saving layout positions (hidden dependency).

### Learning #5: Conversation Context Is State
Database, visual state, AND LLM conversation context must stay in sync.

---

## TESTS WE HAVE (Worth Keeping)

These backend integration tests exist and should be kept on main:

**tests/integration/double-save-prevention.test.js** (9/10 passing)
- Tests each API endpoint creates exactly 1 snapshot
- Catches backend double-save bugs
- Useful baseline, but doesn't catch integration bugs

**tests/integration/save-paths.test.js** (14/15 passing)
- Verifies all save paths create snapshots
- Tests LLM batch saves
- Good for regression testing backend

**tests/integration/save-race-conditions.test.js** (9/10 passing)
- Tests concurrent operations
- Verifies snapshot integrity under load
- Catches race conditions in backend

**What these DON'T test:**
- Complete user workflows (drag → undo → verify)
- Frontend-backend integration (layout → save)
- Visual state matching database state
- LLM conversation context sync

---

## TESTING TOOLS WE HAVE

From package.json devDependencies:
- ✅ **Jest** (test runner)
- ✅ **@testing-library/react** (frontend component testing)
- ✅ **@testing-library/user-event** (simulating user interactions)
- ✅ **supertest** (backend API testing)
- ✅ **jsdom/happy-dom** (DOM environment for tests)

**We do NOT have:**
- ❌ Playwright or Cypress (E2E browser testing)

**Can we test drag+undo without Playwright?**
Maybe. React Testing Library can simulate some React Flow interactions, but drag-drop in canvas might be complex. Needs investigation.

---

## WHAT TESTS ARE MISSING

**High-level test categories we need (NOT specific implementations):**

### Category 1: Complete Workflows
Test user actions from start to finish:
- Create node → Drag → Undo → Verify position restored
- LLM creates 3 nodes → Undo → Redo → Verify all operations work

### Category 2: State Sync Verification
Test fundamental invariant:
- After any operation, visual state === database state
- After layout animation, positions in DB match what's on screen

### Category 3: Integration Points
Test where frontend and backend meet:
- Layout animation completes → Database has calculated positions
- Drag stops → Database has new position
- LLM operation completes → All state consistent

### Category 4: Undo/Redo Robustness
Test undo/redo in various scenarios:
- Multiple operations → Undo all → State empty
- Undo → Retry same LLM prompt → No accumulation
- 10+ undo/redo cycles → No corruption

---

## QUESTIONS FOR NEXT ATTEMPT

**Testing questions:**
1. Can React Testing Library simulate drag in React Flow canvas? Or do we need E2E?
2. How do we test layout animation completion in integration tests?
3. Should we mock layout calculation (dagre) or use real implementation?

**Architecture questions:**
1. If we remove autosave, what triggers save after layout animation?
2. Can we keep autosave but scope it to ONLY layout animation?
3. Is there a simpler fix than architectural change?

**Verification questions:**
1. How do we verify visual state === database state in tests?
2. How do we test LLM conversation context stays in sync?
3. What manual testing checklist catches bugs tests miss?

---

## FILES TO READ

**Understanding the problem:**
- `src/App.jsx` lines 105-120 (autosave useEffect)
- `server/server.js` writeFlow function
- `server/tools/executor.js` (LLM saves)
- `src/hooks/useFlowLayout.js` (layout animation)

**Current database schema:**
- `.agent/system/database_schema.md`

**Project architecture:**
- `.agent/system/project_architecture.md`

**Existing tests:**
- `tests/integration/double-save-prevention.test.js`
- `tests/integration/save-paths.test.js`
- `tests/integration/save-race-conditions.test.js`

**Full failure analysis:**
- `.agent/Tasks/refactor-rollback-learnings.md` (verbose, detailed)

---

## MANUAL TEST CHECKLIST (What Caught the Bugs)

These manual tests found all 3 bugs:

**Test 1: Drag + Undo**
1. Create a node
2. Drag it to new position
3. Press Cmd+Z
4. **Expected:** Node returns to original position
5. **Bug #1:** Node stayed in new position

**Test 2: Network Tab Monitoring**
1. Open DevTools → Network tab → Filter "flow"
2. Type in chat: "create a login node"
3. Count POST requests to `/api/flow`
4. **Expected:** Exactly 1 POST
5. **Bug #2:** Would see incomplete saves (positions wrong)

**Test 3: LLM Undo + Retry**
1. Ask LLM: "create a child node under X"
2. Note how many nodes created
3. Press Cmd+Z
4. Ask LLM same prompt again
5. **Expected:** Same number of nodes
6. **Bug #3:** 2x nodes appeared (then 3x, then 4x...)

---

## RECOMMENDATION FOR NEXT ATTEMPT

**DO NOT proceed with code changes until:**

1. You understand the 3 bugs we hit and WHY tests didn't catch them
2. You've identified what types of tests are missing (not specific implementations)
3. You've verified what testing tools we have (React Testing Library, no Playwright)
4. You've decided what level of testing is needed (can we skip E2E? or must we set it up?)
5. You've written tests that would catch Bug #1, #2, #3 if they existed

**Approach this fresh:**
- Read this document
- Think about what tests YOU would write
- Propose test strategy BEFORE writing any tests
- Get approval on strategy BEFORE implementing tests
- Implement tests BEFORE changing production code

**Do NOT:**
- Copy test implementations from previous attempt blindly
- Assume Playwright is required (we might not need it)
- Write tests that only check backend plumbing
- Proceed without state sync verification tests

---

## COMMITS TO KEEP

On branch `refactor/save-centralization`:

**Keep (merge to main):**
- `f8f3813` - "test: add comprehensive save system tests and diagnosis"
  - Contains the 3 integration test files (34 tests, 31 passing)
  - Good baseline for backend behavior

**Discard (do not merge):**
- `393f4c4` - "refactor: centralize save logic to backend-only" (THE FAILED REFACTOR)
- `22da1cf` - "fix: use refs in onNodeDragStop to capture current state" (DIDN'T WORK)

---

## THE BOTTOM LINE

**Problem:** Autosave useEffect causes double/triple saves, corrupting undo/redo
**Attempted Fix:** Remove autosave entirely
**What Broke:** Layout positions not saved → state mismatch → node accumulation
**Why Tests Missed It:** Tested backend plumbing, not user workflows or state sync
**What's Needed:** Tests that verify complete workflows and state consistency
**Tools We Have:** Jest, React Testing Library, Supertest (no Playwright)
**Next Step:** Design test strategy, get approval, implement tests, THEN refactor

---

**This document is complete. Hand to fresh Claude instance with instruction:**
> "Read this document. Understand the problem and what broke. Propose a test strategy that would catch these bugs. Get approval. Then implement tests. Then attempt refactor."
