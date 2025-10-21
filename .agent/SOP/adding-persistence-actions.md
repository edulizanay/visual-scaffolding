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

```javascript
case 'yourAction': {
  // Extract and validate parameters
  const { param1, param2 } = params;

  if (!param1) {
    return {
      success: false,
      error: 'param1 is required'
    };
  }

  // Load current flow
  const currentFlow = dbGetFlow();

  // Execute your action logic
  const updatedFlow = performYourAction(
    currentFlow,
    param1,
    param2
  );

  // Save to DB and create snapshot
  dbSaveFlow(updatedFlow);
  await pushSnapshot(updatedFlow, 'ui.your_action');

  return { success: true, flow: updatedFlow };
}
```

**Checklist:**
- [ ] Input validation
- [ ] Load current flow state via `dbGetFlow()`
- [ ] Execute action logic
- [ ] Save via `dbSaveFlow(updatedFlow)`
- [ ] Create snapshot with origin tag
- [ ] Return `{ success, flow }` or `{ success: false, error }`

---

### 2. Add Backend API Route

**File**: `server/routes/flowRoutes.js`

Use the `toolEndpoint` helper for consistency:

```javascript
// PUT /api/your-resource/:id
router.put('/your-resource/:id', toolEndpoint({
  toolName: 'yourAction',
  action: 'your action description',
  extractParams: (req) => ({
    resourceId: req.params.id,
    ...req.body
  }),
  origin: 'ui.your_action'
}, readFlow, writeFlow));
```

**Checklist:**
- [ ] Route follows RESTful conventions
- [ ] Uses `toolEndpoint` helper
- [ ] Specifies correct `origin` tag
- [ ] Returns standardized response

---

### 3. Create Frontend API Client

**File**: `src/services/api/flowApi.js` (or appropriate domain file)

```javascript
/**
 * Execute your action via backend API
 * @param {string} param1 - Description
 * @param {any} param2 - Description
 * @returns {Promise<{success: boolean, flow?: object, error?: string}>}
 */
export async function yourAction(param1, param2) {
  try {
    const response = await fetch(`${API_BASE_URL}/your-resource/${param1}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ param2 }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to execute action');
    }

    return await response.json();
  } catch (error) {
    console.error('Error executing action:', error);
    throw error;
  }
}
```

**Checklist:**
- [ ] JSDoc documentation
- [ ] Proper HTTP method
- [ ] Error handling with meaningful messages
- [ ] Exported from `src/services/api/index.js`

---

### 4. Wire Frontend Handler

**File**: `src/App.jsx` (or relevant component)

Use the `handleMutation` pattern for consistency:

```javascript
const handleYourAction = useCallback(
  (param1, param2) => handleMutation(
    () => yourAction(param1, param2),
    {
      errorContext: 'execute your action',
      onSuccess: () => {
        // Optional success callback
      },
      onError: (msg) => {
        // Optional error handling beyond default alert
      }
    }
  ),
  [handleMutation]
);
```

**Or for React Flow callbacks with state management:**

```javascript
const onYourEvent = useCallback(async (eventData) => {
  // Capture original state for revert on error
  const originalState = captureCurrentState();

  try {
    const result = await yourAction(eventData.id, eventData.value);

    if (result.success && result.flow) {
      handleFlowUpdate(result.flow);
    } else {
      console.error('Failed:', result.error);
      alert(`Failed: ${result.error}`);
      revertToState(originalState);
    }
  } catch (error) {
    console.error('Error:', error);
    alert(`Error: ${error.message}`);
    revertToState(originalState);
  }
}, [handleFlowUpdate]);
```

**Checklist:**
- [ ] Captures original state if needed for revert
- [ ] Calls backend API
- [ ] Updates UI on success via `handleFlowUpdate`
- [ ] Reverts UI on failure
- [ ] Shows user-friendly error messages
- [ ] Registered with React Flow component (if applicable)

---

### 5. Add Origin Tag to Logs

**File**: `server/tools/executor.js`

The `logToolExecution` function already handles this, but verify your origin tag appears in logs:

**Expected log format:**
```json
{
  "timestamp": "2025-10-21T05:00:00.000Z",
  "tool": "yourAction",
  "origin": "ui.your_action",
  "duration": "2ms",
  "success": true
}
```

**Checklist:**
- [ ] Origin tag is descriptive and follows pattern `ui.[resource].[action]`
- [ ] Logged for both success and failure
- [ ] Includes execution duration

---

### 6. Write Integration Tests

**File**: `tests/integration/your-action.test.js`

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { setupTestDb, cleanupTestDb } from '../../tests/test-db-setup.js';
import { initializeUndoHistory } from '../../server/db.js';

let app;

beforeEach(async () => {
  await setupTestDb();
  const serverModule = await import('../../server/server.js');
  app = serverModule.default || serverModule.app;
  await initializeUndoHistory({ nodes: [], edges: [] });
});

afterEach(async () => {
  await cleanupTestDb();
});

describe('PUT /api/your-resource/:id', () => {
  it('should execute action successfully', async () => {
    // Setup test data
    const setupResponse = await request(app)
      .post('/api/node')
      .send({ label: 'Test', description: '' });

    const nodeId = setupResponse.body.nodeId;

    // Execute action
    const response = await request(app)
      .put(`/api/your-resource/${nodeId}`)
      .send({ param2: 'value' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.flow).toBeDefined();
  });

  it('should return error for invalid input', async () => {
    const response = await request(app)
      .put('/api/your-resource/invalid-id')
      .send({ param2: 'value' });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toBeDefined();
  });

  it('should create snapshot with correct origin tag', async () => {
    // Test implementation
  });
});
```

**Checklist:**
- [ ] Success case tested
- [ ] Error cases tested (validation, invalid IDs, etc.)
- [ ] Snapshot origin tag verified
- [ ] Response format validated
- [ ] Uses Supabase test environment via setupTestDb/cleanupTestDb

---

### 7. Write Unit Tests (if needed)

For complex helper functions, add unit tests:

**File**: `tests/unit/shared/yourActionHelpers.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import { yourHelper } from '../../../src/utils/yourActionHelpers.js';

describe('yourHelper', () => {
  it('should handle valid input', () => {
    expect(yourHelper('input')).toBe('expected');
  });

  it('should handle edge cases', () => {
    expect(yourHelper(null)).toBe(null);
    expect(yourHelper([])).toEqual([]);
  });
});
```

**Checklist:**
- [ ] All helper functions covered
- [ ] Edge cases tested (null, undefined, empty arrays, etc.)
- [ ] Pure functions (no side effects)

---

### 8. Run QA Validation

**Manual QA:**
- [ ] Action works correctly in UI
- [ ] Backend API called (check server logs for `[TOOL_EXECUTION]`)
- [ ] Tool execution log shows correct origin
- [ ] Snapshot created in database
- [ ] Error handling works (test with invalid data)
- [ ] Undo/redo works for this action
- [ ] Refresh preserves state

**Database verification:**
Check Supabase dashboard or use the Supabase MCP tool to verify snapshots:
```sql
SELECT id, created_at, snapshot->'_meta'->>'origin' as origin
FROM undo_history
ORDER BY created_at DESC
LIMIT 5;
```

**Checklist:**
- [ ] All manual QA steps passed
- [ ] Snapshot origin tag verified in Supabase
- [ ] Automated tests passing
- [ ] No duplicate snapshots created

---

### 9. Document Your Changes

**Update these files:**

1. **Add code comments**:
   ```javascript
   // Persist action via backend API (creates snapshot with origin: 'ui.your_action')
   ```

2. **Update this SOP** if you discovered improvements to the process

**Checklist:**
- [ ] Code comments added explaining backend call
- [ ] Origin tag documented if new pattern
- [ ] README updated if major user-facing feature

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
