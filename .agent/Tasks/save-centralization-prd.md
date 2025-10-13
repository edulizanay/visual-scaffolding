# PRD: Save Centralization & Test Coverage Improvement

**Created:** 2025-10-13
**Status:** Draft - Awaiting Approval
**Dependencies:** [save-centralization-diagnosis.md](./save-centralization-diagnosis.md)

---

## Overview

Centralize save logic to backend-only to fix unpredictable undo/redo breakage caused by multiple competing save paths and race conditions.

---

## Goals

### Primary
1. **Fix undo/redo reliability** - Must work 100% of the time
2. **Eliminate race conditions** - Single save path prevents timing issues
3. **Simplify architecture** - Clear separation: backend = persistence, frontend = display

### Secondary
4. **Improve test coverage** - 95% → 100%, add integration tests for save coordination
5. **Better DX** - Easier to reason about, easier to add features without breaking undo/redo

---

## Non-Goals

- Performance optimization (current perf is acceptable)
- UI/UX changes (behavior stays similar from user perspective)
- New features (this is purely refactoring + bug fixing)

---

## Success Metrics

| Metric | Before | After |
|--------|--------|-------|
| Tests passing | 302/317 (95%) | 350+/350 (100%) |
| Undo/redo reliability | ~85% (breaks randomly) | 100% (never breaks) |
| Double-saves per operation | 2+ | 1 |
| Save paths | 4 competing paths | 1 centralized path |
| Untested functionality | 38% | 5% |

---

## Technical Design

### Current Architecture (BROKEN)

```
┌──────────────────────────────────────────┐
│ FRONTEND (App.jsx)                       │
├──────────────────────────────────────────┤
│ User Action                              │
│   ↓                                      │
│ State Change (setNodes/setEdges)         │
│   ↓                                      │
│ useEffect watches [nodes, edges] ────────┼──┐
│   ↓ (500ms debounce)                     │  │
│   ↓ Guards: isLoading, isAnimating,      │  │
│   ↓         isBackendProcessing          │  │
│   ↓                                      │  │
│ saveFlow() ──────────────────────────────┼──┼──┐
└──────────────────────────────────────────┘  │  │
                                              │  │
┌──────────────────────────────────────────┐  │  │
│ BACKEND (server.js)                      │  │  │
├──────────────────────────────────────────┤  │  │
│ POST /api/node (or /edge, /group, etc)  │  │  │
│   ↓                                      │  │  │
│ executeToolCalls() ──────────────────────┼──┼──┼──┐
│   ↓                                      │  │  │  │
│ writeFlow() + pushSnapshot() ←───────────┼──┘  │  │
│   ↓                                      │     │  │
│ Return updated flow ──────────────────────────┘  │
└──────────────────────────────────────────┘        │
   ↓                                                 │
┌──────────────────────────────────────────┐        │
│ FRONTEND                                 │        │
│ handleFlowUpdate(updatedFlow)            │        │
│   ↓                                      │        │
│ setNodes/setEdges ───────────────────────┼────────┘
│   ↓                                      │
│ Triggers autosave useEffect AGAIN! ✗     │
│   ↓                                      │
│ DOUBLE SAVE + RACE CONDITION ✗           │
└──────────────────────────────────────────┘
```

**Problems:**
- 🔴 Backend saves → Returns flow → Frontend sets state → Autosave triggers AGAIN
- 🔴 Layout animation updates positions → Autosave triggers
- 🔴 Guards (`isAnimating`, `isBackendProcessing`) don't always prevent autosave
- 🔴 Multiple save paths = unpredictable race conditions

---

### New Architecture (FIXED)

```
┌──────────────────────────────────────────┐
│ FRONTEND (App.jsx)                       │
├──────────────────────────────────────────┤
│ User Action                              │
│   ↓                                      │
│ API Call (createNode, updateEdge, etc)   │
│   ↓                                      │
│ (NO AUTOSAVE USEEFFECT!)                 │
└──────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────┐
│ BACKEND (server.js)                      │
├──────────────────────────────────────────┤
│ POST /api/node (or /edge, /group, etc)  │
│   ↓                                      │
│ Execute operation                        │
│   ↓                                      │
│ writeFlow() + pushSnapshot() ✓ (ONCE!)   │
│   ↓                                      │
│ Return updated flow                      │
└──────────────────────────────────────────┘
   ↓
┌──────────────────────────────────────────┐
│ FRONTEND                                 │
│ handleFlowUpdate(updatedFlow)            │
│   ↓                                      │
│ setNodes/setEdges (DISPLAY ONLY)         │
│   ↓                                      │
│ (NO SAVE TRIGGERED) ✓                    │
│   ↓                                      │
│ Optional: applyLayout (DISPLAY ONLY) ✓   │
└──────────────────────────────────────────┘
```

**Benefits:**
- ✅ Single save path = no race conditions
- ✅ Backend owns persistence = clear responsibility
- ✅ Frontend displays results = simpler React logic
- ✅ Explicit saves only = predictable behavior

---

## Implementation Plan

### Phase 1: Write Failing Tests (DO NOT CHANGE CODE)

**Files to Create:**

1. **`tests/integration/double-save-prevention.test.js`**
```javascript
describe('Double-save prevention', () => {
  test('API node creation saves exactly once', async () => {
    const initialSnapshotCount = await getSnapshotCount();
    await request(app).post('/api/node').send({ label: 'Test' });
    const finalSnapshotCount = await getSnapshotCount();
    expect(finalSnapshotCount - initialSnapshotCount).toBe(1); // NOT 2!
  });

  test('handleFlowUpdate does not trigger autosave', async () => {
    // Spy on saveFlow calls
    // Call handleFlowUpdate
    // Assert saveFlow was NOT called
  });

  // More tests...
});
```

2. **`tests/integration/save-paths.test.js`**
```javascript
describe('Save path verification', () => {
  test('API operations create snapshots', async () => {
    // Test POST /api/node
    // Test POST /api/edge
    // Test POST /api/group
    // Assert snapshot created for each
  });

  test('LLM tool execution creates snapshots', async () => {
    // Mock LLM response with tool calls
    // Execute tools
    // Assert single snapshot created
  });

  // More tests...
});
```

3. **`tests/integration/save-race-conditions.test.js`**
```javascript
describe('Save race conditions', () => {
  test('Simultaneous node creation and layout', async () => {
    // Create node + trigger layout simultaneously
    // Assert no corruption, single snapshot
  });

  test('Undo during pending autosave', async () => {
    // Trigger autosave debounce
    // Call undo before debounce completes
    // Assert redo chain preserved
  });

  // More tests...
});
```

**Expected Result:** All 3 test files FAIL (bugs exist in current code).

**Deliverable:** Document which tests fail and why.

---

### Phase 2: Implement Backend-Only Save

**Changes:**

#### 1. Remove Frontend Autosave

**File:** `src/App.jsx`

**Before:**
```javascript
useEffect(() => {
  if (isLoading || isAnimating || isBackendProcessing) return;

  const timeoutId = setTimeout(async () => {
    try {
      await saveFlow(nodes, edges);
      // ...
    } catch (error) {
      console.error('Failed to save flow:', error);
    }
  }, 500);

  return () => clearTimeout(timeoutId);
}, [nodes, edges, isLoading, canUndo, isAnimating, isBackendProcessing]);
```

**After:**
```javascript
// REMOVED - Backend handles all saves
```

**Rationale:** Backend already saves when operations execute. Autosave is redundant and causes double-saves.

---

#### 2. Simplify handleFlowUpdate

**File:** `src/App.jsx`

**Before:**
```javascript
const handleFlowUpdate = useCallback((updatedFlow) => {
  if (!updatedFlow) return;

  const nodesWithPosition = updatedFlow.nodes.map(node => ({
    ...node,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));

  const normalizedFlow = applyGroupVisibility(nodesWithPosition, updatedFlow.edges);

  setNodes(normalizedFlow.nodes);
  setEdges(normalizedFlow.edges);

  // Auto-layout when LLM adds nodes
  setTimeout(() => {
    applyLayoutWithAnimation(normalizedFlow.nodes, normalizedFlow.edges);
  }, 100);
}, [setNodes, setEdges, applyLayoutWithAnimation]);
```

**After:**
```javascript
const handleFlowUpdate = useCallback((updatedFlow) => {
  if (!updatedFlow) return;

  const nodesWithPosition = updatedFlow.nodes.map(node => ({
    ...node,
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
  }));

  const normalizedFlow = applyGroupVisibility(nodesWithPosition, updatedFlow.edges);

  // DISPLAY ONLY - no save triggered
  setNodes(normalizedFlow.nodes);
  setEdges(normalizedFlow.edges);

  // Auto-layout when LLM adds nodes (DISPLAY ONLY)
  setTimeout(() => {
    applyLayoutWithAnimation(normalizedFlow.nodes, normalizedFlow.edges);
  }, 100);
}, [setNodes, setEdges, applyLayoutWithAnimation]);
```

**Rationale:** Function now clearly labeled as display-only. No save logic here.

---

#### 3. Remove isBackendProcessing Guard

**File:** `src/App.jsx`

**Before:**
```javascript
const [isBackendProcessing, setIsBackendProcessing] = useState(false);
// ... used in autosave guard
```

**After:**
```javascript
// REMOVED - no longer needed
```

**File:** `src/ChatInterface.jsx`

**Before:**
```javascript
onProcessingChange(true);
// ... API call
onProcessingChange(false);
```

**After:**
```javascript
// REMOVED - no longer needed
```

**Rationale:** Guard was to prevent autosave during backend operations. No autosave = no guard needed.

---

#### 4. Ensure Backend Saves Exactly Once

**File:** `server/tools/executor.js`

**Verify:**
```javascript
export async function executeToolCalls(toolCalls) {
  let flow = await readFlow();
  const results = [];
  let flowChanged = false;

  for (const { name, params } of toolCalls) {
    const result = await executeTool(name, params, flow);
    results.push(result);

    if (result.success && result.updatedFlow) {
      flow = result.updatedFlow;
      flowChanged = true;
    }
  }

  if (flowChanged) {
    await writeFlow(flow); // ✓ Single save
  }

  return results;
}
```

**File:** `server/server.js`

**Verify:**
```javascript
export async function writeFlow(flowData, skipSnapshot = false) {
  dbSaveFlow(flowData);

  if (!skipSnapshot) {
    await pushSnapshot(flowData); // ✓ Always snapshot
  }
}
```

**Action:** Remove `skipSnapshot` parameter (always snapshot). Verify all API endpoints call `writeFlow()` exactly once.

---

#### 5. Add Drag-Stop Explicit Save (NEW FEATURE)

**File:** `src/App.jsx`

**Add:**
```javascript
const onNodeDragStop = useCallback(async (event, node) => {
  // Explicit save when user stops dragging
  try {
    await saveFlow(nodes, edges);
  } catch (error) {
    console.error('Failed to save after drag:', error);
  }
}, [nodes, edges]);
```

**Register:**
```javascript
<ReactFlow
  // ...
  onNodeDragStop={onNodeDragStop}
  // ...
>
```

**Rationale:** Replace autosave with explicit user-action-triggered save.

---

### Phase 3: Verify Tests Pass

**Actions:**
1. Run `npm test`
2. Verify all Phase 1 tests now PASS
3. Verify existing 302 tests still PASS
4. Document any regressions

**Expected Result:** 320-330 tests passing (100% pass rate).

---

### Phase 4: Write Future State Tests

**Files to Create:**

1. **`tests/integration/drag-save.test.js`**
```javascript
describe('Drag-stop save', () => {
  test('Drag stop triggers explicit save', async () => {
    // Simulate drag stop
    // Assert saveFlow called
    // Assert snapshot created
  });

  test('Dragging without stop does not save', async () => {
    // Simulate drag (no stop)
    // Assert saveFlow NOT called
  });
});
```

2. **`tests/unit/frontend/centralized-display.test.js`**
```javascript
describe('Centralized display logic', () => {
  test('handleFlowUpdate displays without saving', async () => {
    // Call handleFlowUpdate
    // Assert state updated
    // Assert saveFlow NOT called
  });
});
```

---

## Acceptance Criteria

### Must Have (Blocking Release)

- [ ] All Phase 1 tests written
- [ ] All Phase 1 tests fail before refactor
- [ ] All Phase 1 tests pass after refactor
- [ ] Zero regressions in existing tests
- [ ] Undo/redo works 100% in manual testing
- [ ] Documentation updated

### Should Have (Nice to Have)

- [ ] Phase 4 tests written
- [ ] Fix React act() warnings (15 failing tests)
- [ ] E2E tests for complete workflows

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking undo/redo during refactor | Medium | High | Write tests FIRST |
| Users confused by drag-stop behavior | Low | Low | Behavior similar to current |
| Regressions in untested paths | Medium | Medium | Comprehensive test suite |
| Tests take too long to write | Low | Low | Focus on Priority 1 only |

---

## Timeline

**Phase 1:** 2-3 hours (write tests)
**Phase 2:** 3-4 hours (refactor code)
**Phase 3:** 1-2 hours (verify + fix regressions)
**Phase 4:** 2-3 hours (future state tests)

**Total:** 8-12 hours

---

## Open Questions

1. **Should we keep any autosave?**
   - **Answer:** No - all saves explicit via API/drag-stop

2. **What about unsaved position changes during drag?**
   - **Answer:** User must stop dragging to save (same as current behavior effectively)

3. **Do we need a "saving..." indicator?**
   - **Answer:** Out of scope - current behavior doesn't have one either

---

## Rollback Plan

If refactor fails:
1. Revert all code changes
2. Keep test files (valuable for future)
3. Document learnings
4. Retry with smaller scope

Git makes this easy - just revert the commits.

---

## Documentation Updates Required

- [ ] Update `.agent/system/project_architecture.md` - Remove autosave section
- [ ] Update `.agent/system/database_schema.md` - No changes needed
- [ ] Update `.agent/system/test_suite.md` - Add new test files
- [ ] Update `.agent/Tasks/` - Mark this PRD as completed

---

## Success Looks Like

**Before:**
```
User creates node
→ Backend saves ✓
→ Returns flow
→ Frontend updates state
→ Autosave triggers ✗ (double-save!)
→ Layout animates
→ Autosave triggers AGAIN ✗ (triple-save!)
→ Undo/redo sometimes breaks ✗
```

**After:**
```
User creates node
→ Backend saves ONCE ✓
→ Returns flow
→ Frontend displays ✓
→ Layout animates (display only) ✓
→ Undo/redo always works ✓
```

---

**Status:** Awaiting Edu's approval to proceed.
