# SOP: Adding New Persistence Actions

> **When to use this**: When adding a new user action that needs to persist to the backend database.

---

## Overview

All flow persistence goes through explicit backend API calls. This SOP guides you through adding a new persistence action following the established backend-only pattern.

**Key Principles:**
- Direct backend calls: Every action calls a specific API endpoint
- Origin tagging: Every snapshot gets an origin tag for observability
- Error handling: Failed operations revert UI state and alert user
- Comprehensive testing: Unit + integration tests required

---

## Architecture Pattern

```
User Action → Frontend Handler → Backend API Call → Snapshot with Origin Tag
                                       ↓ (on error)
                                   Revert UI State + Alert User
```

**Existing Examples:**
- **Drag position**: `onNodesChange` → `PUT /api/node/:id` → origin: `'ui.node.update'`
- **Delete node**: `onNodesDelete` → `DELETE /api/node/:id` → origin: `'ui.node.delete'`
- **Subtree collapse**: `onNodeClick` (Alt) → `PUT /api/subtree/:id/collapse` → origin: `'ui.subtree'`

---

## Step-by-Step Guide

### 1. Create Backend Tool Executor

**File**: `server/tools/executor.js`

Add case with: validation → load flow → perform action → save + snapshot → return result.

**Checklist:**
- [ ] Input validation
- [ ] Load current flow state via `dbGetFlow()`
- [ ] Execute action logic
- [ ] Save via `dbSaveFlow(updatedFlow)` and create snapshot with origin tag
- [ ] Return `{ success, flow }` or `{ success: false, error }`

---

### 2. Add Backend API Route

**File**: `server/routes/flowRoutes.js`

Use `toolEndpoint` helper: specify toolName, action, extractParams, and origin tag.

**Checklist:**
- [ ] Route follows RESTful conventions, uses `toolEndpoint`, includes origin tag

---

### 3. Create Frontend API Client

**File**: `src/services/api/flowApi.js`

Create async function with fetch, error handling, and JSDoc. Export from `src/services/api/index.js`.

**Checklist:**
- [ ] JSDoc, proper HTTP method, error handling, exported

---

### 4. Wire Frontend Handler

**File**: `src/App.jsx`

Use `handleMutation` pattern or React Flow callback. Pattern: capture original state → call API → update UI on success → revert on error.

**Checklist:**
- [ ] Captures state, calls API, updates UI on success, reverts on failure, shows errors

---

### 5. Verify Origin Tag in Logs

`logToolExecution` handles this automatically. Verify origin follows pattern `ui.[resource].[action]`.

---

### 6. Write Integration Tests

**File**: `tests/integration/your-action.test.js`

Use supertest with `setupTestDb/cleanupTestDb`. Test: success case, error cases, snapshot origin tag, response format.

**Checklist:**
- [ ] Success + error cases tested, snapshot origin verified, uses Supabase test environment

---

### 7. Write Unit Tests (if needed)

For complex helpers: test valid input, edge cases (null, undefined, empty), pure functions.

---

### 8. Run QA Validation

**Manual QA:**
- [ ] Action works, API called (check logs), snapshot created, error handling works, undo/redo works

**Database verification:** Check Supabase for snapshot origin tags in `undo_history` table.

---

### 9. Document Your Changes

Add code comments explaining backend call and origin tag. Update this SOP if process improved.

---

## Testing Checklist

Before considering your persistence action complete:

- [ ] Unit tests: Helper functions tested (if any)
- [ ] Integration tests: API route tested (success + errors)
- [ ] Manual QA: Action validated end-to-end
- [ ] Snapshot verification: Origin tag correct in DB
- [ ] Error handling: Failures revert UI state and alert user
- [ ] Undo/redo: Action appears in history and can be undone
- [ ] Performance: Action feels responsive
- [ ] CI passing: All tests green

---

## Common Pitfalls

1. **Not reverting UI on error**: Users see incorrect state after failures
2. **Missing origin tag**: Observability lost
3. **Not testing error cases**: Crashes in production
4. **Forgetting to update handleFlowUpdate**: UI doesn't reflect changes
5. **Not capturing original state**: Can't revert on error
6. **Skipping undo/redo testing**: History breaks
7. **Not using handleMutation pattern**: Inconsistent error handling

---

## References

- **Existing Examples**:
  - Drag-end: [App.jsx:89-143](../../src/App.jsx#L89-L143) (`onNodesChange` handler)
  - Delete node: [App.jsx:243-268](../../src/App.jsx#L243-L268) (`onNodesDelete` handler)
  - Delete edge: [App.jsx:270-293](../../src/App.jsx#L270-L293) (`onEdgesDelete` handler)
  - Subtree: [App.jsx:439-461](../../src/App.jsx#L439-L461) (`onNodeClick` with altKey)
- **Backend Tools**: [server/tools/executor.js](../../server/tools/executor.js)
- **API Routes**: [server/routes/flowRoutes.js](../../server/routes/flowRoutes.js)

---

**Last Updated**: 2025-10-21 (Phase 7 & 8 - Backend-only architecture)
