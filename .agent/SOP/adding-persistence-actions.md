# SOP: Adding New Persistence Actions

> **When to use this**: When adding a new user action that needs explicit backend persistence via the backend save funnel (not autosave).

---

## Overview

The backend save funnel provides explicit, API-driven persistence for user actions like drag-end and subtree collapse. This SOP guides you through adding a new persistence action following the established pattern.

**Key Principles:**
- Feature-flagged: Defaults OFF for safe rollout
- Explicit backend calls: Direct API persistence, not autosave
- Origin tagging: Every action gets an origin tag for observability
- Error handling: Revert UI state on failure
- Comprehensive testing: Unit + integration + QA validation

---

## Architecture Pattern

```
User Action → Frontend Handler → Feature Flag Check → Backend API Call → Snapshot with Origin Tag
                                       ↓ (flag OFF)
                                   Autosave Fallback
```

**Existing Examples:**
- **Drag-end**: `ENABLE_BACKEND_DRAG_SAVE` → `updateNode` → origin: `'ui.node.update'`
- **Subtree collapse**: `ENABLE_BACKEND_SUBTREE` → `toggleSubtreeCollapse` → origin: `'ui.subtree'`

---

## Step-by-Step Guide

### 1. Add Feature Flag

**File**: `server/config.js`

```javascript
export const config = {
  // ... existing flags ...

  // Enable backend persistence for [your action]
  // When false: frontend autosave handles persistence
  // When true: [action] calls [backend API] for explicit persistence
  ENABLE_BACKEND_YOUR_ACTION: process.env.ENABLE_BACKEND_YOUR_ACTION === 'true',
};
```

**Checklist:**
- [ ] Flag defaults to `false`
- [ ] Comment explains ON vs OFF behavior
- [ ] Environment variable documented

---

### 2. Expose Flag to Frontend

**File**: `server/routes/flowRoutes.js`

Add flag to config endpoint:

```javascript
router.get('/config', (req, res) => {
  res.json({
    ENABLE_BACKEND_DRAG_SAVE: config.ENABLE_BACKEND_DRAG_SAVE,
    ENABLE_BACKEND_SUBTREE: config.ENABLE_BACKEND_SUBTREE,
    ENABLE_BACKEND_YOUR_ACTION: config.ENABLE_BACKEND_YOUR_ACTION, // Add this
  });
});
```

**Checklist:**
- [ ] Flag exposed in `/api/flow/config` endpoint
- [ ] Frontend will fetch on mount via `getFeatureFlags()`

---

### 3. Create Backend Tool Executor

**File**: `server/tools/executor.js`

```javascript
case 'yourAction': {
  // Extract parameters
  const { param1, param2 } = params;

  // Validate inputs
  if (!param1) {
    return {
      success: false,
      error: 'param1 is required'
    };
  }

  // Load current flow
  const currentFlow = loadFlowFromFile();

  // Execute your action logic
  const updatedFlow = performYourAction(
    currentFlow,
    param1,
    param2
  );

  // Save with origin tag
  saveFlowToFile(updatedFlow);
  await pushSnapshot(updatedFlow, 'ui.your_action');

  return { success: true, flow: updatedFlow };
}
```

**Checklist:**
- [ ] Input validation
- [ ] Load current flow state
- [ ] Execute action logic
- [ ] Save updated flow
- [ ] Create snapshot with origin tag
- [ ] Return success + updated flow
- [ ] Handle errors gracefully

---

### 4. Add Backend API Route

**File**: `server/routes/flowRoutes.js`

```javascript
// POST /api/flow/your-action
router.post('/your-action', async (req, res) => {
  try {
    const { param1, param2 } = req.body;

    const result = await executeTools([{
      name: 'yourAction',
      input: { param1, param2 }
    }], 'ui.your_action');

    if (result.results[0].success) {
      res.json({ success: true, flow: result.results[0].flow });
    } else {
      res.status(400).json({
        success: false,
        error: result.results[0].error
      });
    }
  } catch (error) {
    console.error('Error in your-action route:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});
```

**Checklist:**
- [ ] Route follows RESTful conventions
- [ ] Input validation
- [ ] Calls executor via `executeTools`
- [ ] Returns standardized response (`{ success, flow/error }`)
- [ ] Error handling with appropriate status codes

---

### 5. Create Frontend API Helper

**File**: `src/services/api/flowApi.js`

```javascript
/**
 * Execute your action via backend API
 * @param {string} param1 - Description
 * @param {any} param2 - Description
 * @returns {Promise<{success: boolean, flow?: object, error?: string}>}
 */
export async function apiYourAction(param1, param2) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/flow/your-action`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ param1, param2 }),
    });

    const data = await response.json();
    if (!response.ok) {
      return { success: false, error: data.error };
    }
    return { success: true, flow: data.flow };
  } catch (error) {
    console.error('API call failed:', error);
    return { success: false, error: error.message };
  }
}
```

**Checklist:**
- [ ] JSDoc documentation
- [ ] Proper HTTP method (POST for mutations)
- [ ] JSON content type
- [ ] Error handling
- [ ] Standardized return format

---

### 6. Create Helper for Feature Flag Check

**File**: `src/utils/yourActionHelpers.js`

```javascript
// ABOUTME: Helper utilities for your action backend save funnel
// ABOUTME: Feature flag checks and state transformations

/**
 * Determine if backend API should be used for your action
 * @param {boolean} featureFlagEnabled - ENABLE_BACKEND_YOUR_ACTION flag
 * @param {Array} items - Items to process
 * @returns {boolean}
 */
export function shouldUseBackendYourAction(featureFlagEnabled, items) {
  return featureFlagEnabled && items.length > 0;
}
```

**Checklist:**
- [ ] Pure function (no side effects)
- [ ] ABOUTME header comments
- [ ] JSDoc documentation
- [ ] Unit tests (see step 10)

---

### 7. Wire Frontend Handler

**File**: `src/App.jsx` (or relevant component)

```javascript
const handleYourAction = useCallback(async (param1, param2) => {
  // Backend save funnel: When flag is ON, persist via API; when OFF, autosave handles it
  if (shouldUseBackendYourAction(featureFlags.ENABLE_BACKEND_YOUR_ACTION, [param1])) {
    try {
      const result = await apiYourAction(param1, param2);

      if (result.success && result.flow) {
        // Update UI with backend response
        handleFlowUpdate(result.flow);
      } else {
        console.error('Failed to execute action:', result.error);
        alert(`Failed to execute action: ${result.error}`);
        // Revert UI state if needed
      }
    } catch (error) {
      console.error('Error executing action:', error);
      alert(`Error executing action: ${error.message}`);
      // Revert UI state if needed
    }
  } else {
    // Legacy path: local state update, autosave will persist
    // ... local implementation ...
  }
}, [featureFlags.ENABLE_BACKEND_YOUR_ACTION, handleFlowUpdate]);
```

**Checklist:**
- [ ] Feature flag check using helper
- [ ] Backend API call with error handling
- [ ] UI update on success
- [ ] UI revert on failure (if applicable)
- [ ] Fallback to local + autosave when flag OFF
- [ ] Comments explaining backend save funnel logic

---

### 8. Add Origin Tag to Tool Execution Logs

**File**: `server/tools/executor.js`

Ensure structured logging includes your action:

```javascript
// Log execution with origin tag
logToolExecution(tool.name, origin, startTime, success, error);
```

**Expected log format:**
```json
{
  "timestamp": "2025-10-20T19:13:28.177Z",
  "tool": "yourAction",
  "origin": "ui.your_action",
  "duration": "0ms",
  "success": true
}
```

**Checklist:**
- [ ] Origin tag matches snapshot origin
- [ ] Logged for success and failure
- [ ] Includes duration measurement

---

### 9. Write Integration Tests

**File**: `tests/integration/your-action-backend.test.js`

```javascript
import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import app from '../../server/app.js';

describe('POST /api/flow/your-action', () => {
  beforeEach(() => {
    // Setup test data
  });

  it('should execute action successfully', async () => {
    const response = await request(app)
      .post('/api/flow/your-action')
      .send({ param1: 'test', param2: 'value' });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.flow).toBeDefined();
  });

  it('should return error for invalid input', async () => {
    const response = await request(app)
      .post('/api/flow/your-action')
      .send({ param2: 'value' }); // Missing param1

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error).toContain('param1');
  });

  it('should create snapshot with correct origin tag', async () => {
    // Test that snapshot has origin: 'ui.your_action'
  });
});
```

**Checklist:**
- [ ] Success case tested
- [ ] Error cases tested (validation, failures)
- [ ] Snapshot origin tag verified
- [ ] Response format validated

---

### 10. Write Unit Tests

**File**: `tests/unit/shared/yourActionHelpers.test.js`

```javascript
import { describe, it, expect } from 'vitest';
import { shouldUseBackendYourAction } from '../../../src/utils/yourActionHelpers.js';

describe('shouldUseBackendYourAction', () => {
  it('should return true when flag is true and items exist', () => {
    expect(shouldUseBackendYourAction(true, ['item'])).toBe(true);
  });

  it('should return false when flag is false', () => {
    expect(shouldUseBackendYourAction(false, ['item'])).toBe(false);
  });

  it('should return false when items array is empty', () => {
    expect(shouldUseBackendYourAction(true, [])).toBe(false);
  });
});
```

**Checklist:**
- [ ] Test flag ON + valid data
- [ ] Test flag OFF
- [ ] Test edge cases (empty arrays, null, etc.)
- [ ] All helper functions covered

---

### 11. Run QA Validation

Use the Phase 4 QA script as a template:

**Manual QA (flags OFF):**
- [ ] Action works as before
- [ ] Autosave persists changes
- [ ] No backend logs for this action
- [ ] Refresh preserves state

**Manual QA (flags ON):**
- [ ] Action works correctly
- [ ] Backend API called (check logs)
- [ ] Tool execution log shows correct origin
- [ ] Snapshot created in database
- [ ] Error handling works (test failures)
- [ ] Refresh preserves state

**Database verification:**
```bash
# Check snapshot was created with correct origin
sqlite3 server/data/flow.db "SELECT id, datetime(created_at, 'localtime'), json_extract(snapshot, '$._meta.origin') FROM undo_history ORDER BY id DESC LIMIT 5;"
```

**Checklist:**
- [ ] All manual QA steps passed (flags OFF)
- [ ] All manual QA steps passed (flags ON)
- [ ] Snapshot origin tag verified in DB
- [ ] Automated tests passing
- [ ] No duplicate snapshots

---

### 12. Document Your Changes

**Update these files:**

1. **Add comment to handler** (`src/App.jsx` or relevant file):
   ```javascript
   // Backend save funnel: When ENABLE_BACKEND_YOUR_ACTION is true, persist via [API].
   // When false, autosave handles persistence (legacy fallback).
   ```

2. **Update server/config.js** (if not already done in step 1)

3. **Update this SOP** if you discovered improvements to the process

**Checklist:**
- [ ] Code comments added
- [ ] Origin tag documented in `server/historyService.js` if new
- [ ] README updated if major feature

---

## Testing Checklist

Before considering your persistence action complete:

- [ ] Unit tests: Helper functions tested
- [ ] Integration tests: API route tested (success + errors)
- [ ] Manual QA: Both flag states validated
- [ ] Snapshot verification: Origin tag correct in DB
- [ ] Error handling: Failures revert UI state
- [ ] Performance: Action feels responsive
- [ ] CI passing: All 716+ tests green

---

## Rollback Strategy

If issues arise in production:

1. **Immediate**: Set flag to `false` via environment variable and redeploy
   ```bash
   ENABLE_BACKEND_YOUR_ACTION=false npm start
   ```

2. **Verify**: System reverts to autosave-based persistence

3. **No code changes needed**: Autosave remains functional as fallback

---

## Common Pitfalls

1. **Forgetting to expose flag to frontend**: Route won't know flag exists
2. **Not handling errors**: UI state becomes inconsistent
3. **Missing origin tag**: Observability lost
4. **Skipping QA with flags OFF**: Rollback path untested
5. **Not reverting UI on failure**: Users see incorrect state
6. **Forgetting to clear loading states**: UI appears stuck
7. **Not testing empty/null inputs**: Crashes in production

---

## References

- **Implementation Plan**: [backend-save-funnel-implementation-plan.md](../tasks/backend-save-funnel-implementation-plan.md)
- **Phase 4 QA Script**: [phase4-local-qa-script.md](../tasks/phase4-local-qa-script.md)
- **Existing Examples**:
  - Drag-end: `src/App.jsx:115-155`, `server/tools/executor.js`
  - Subtree: `src/App.jsx:469-491`, `server/tools/executor.js`

---

**Last Updated**: 2025-10-20
