# Server Reorganization Plan

## 🟢 Progress Status: Phase 1 Complete (2/6 steps)

**Completed:**
- ✅ Step 2: Moved `buildRetryMessage()` to llmService.js
- ✅ Tests verified: All passing (16 llmService tests + 20 API contract tests)

**Next Steps:**
- Step 1: Extract flowOperations.js (can be done now)
- Step 3: Update server.js imports/calls (blocked - requires service wrapper decision)
- Step 4-6: Delete services, merge tests (blocked - depends on Step 3)

---

## Overview
Reorganize server code to separate concerns: HTTP layer, business logic, LLM communication, and data persistence.

## Final File Structure

```
server/
├── server.js                 (~370 lines) - HTTP layer
├── flowOperations.js         (~260 lines) - Business logic [NEW]
├── llm/
│   └── llmService.js         (~290 lines) - LLM communication
└── db.js                     (280 lines) - Data persistence [UNCHANGED]

DELETE:
├── conversationService.js    [DELETE]
└── historyService.js         [DELETE]
```

---

## Migration Checklist

### 1. Create flowOperations.js (extract from server.js)

**Move these functions (lines 307-565):**
- [ ] `executeTool()`
- [ ] `executeToolCalls()`
- [ ] `executeAddNode()`
- [ ] `executeUpdateNode()`
- [ ] `executeDeleteNode()`
- [ ] `executeAddEdge()`
- [ ] `executeUpdateEdge()`
- [ ] `executeDeleteEdge()`
- [ ] `executeUndo()`
- [ ] `executeRedo()`

**Move these helpers:**
- [ ] `generateId()`
- [ ] `sanitizeId()`

**Add imports:**
- [ ] `import { getFlow, saveFlow, undo, redo } from './db.js'`

**Export:**
- [ ] `export { executeToolCalls }`

---

### 2. Update llmService.js (extract from server.js) ✅ PARTIALLY COMPLETED

**Move this function:**
- [x] `buildRetryMessage()` (lines 189-237 from server.js) → **DONE: Now at llmService.js:179-227**

**Update imports (NOT YET DONE - depends on service wrapper removal):**
- [ ] Remove `import { getHistory } from '../conversationService.js'`
- [ ] Add `import { getConversationHistory } from '../db.js'`

**Update function calls (NOT YET DONE - depends on service wrapper removal):**
- [ ] `getHistory(6)` → `getConversationHistory(6)`

**Export:**
- [x] `export { buildRetryMessage }` → **DONE**

**Status:** Function moved and exported. Import updates blocked pending Step 3 completion.

---

### 3. Update server.js (consolidate + cleanup)

**Remove (move to flowOperations.js):**
- [ ] All execute* functions (lines 307-565)
- [ ] `generateId()`, `sanitizeId()` helpers

**Remove (inline from services):**
- [ ] `import { addUserMessage, addAssistantMessage, getHistory, clearHistory } from './conversationService.js'`
- [ ] `import { pushSnapshot, undo, redo, getHistoryStatus, initializeHistory } from './historyService.js'`

**Add imports:**
- [ ] `import { executeToolCalls } from './flowOperations.js'`
- [x] `import { buildRetryMessage } from './llm/llmService.js'` → **DONE**
- [ ] `import { addConversationMessage, getConversationHistory, clearConversationHistory } from './db.js'`
- [ ] `import { pushUndoSnapshot, undo, redo, getUndoStatus, initializeUndoHistory } from './db.js'`

**Replace function calls:**
- [ ] `addUserMessage(msg)` → `addConversationMessage('user', msg)`
- [ ] `addAssistantMessage(msg, tools)` → `addConversationMessage('assistant', msg, tools)`
- [ ] `getHistory()` → `getConversationHistory()`
- [ ] `clearHistory()` → `clearConversationHistory()`
- [ ] `pushSnapshot(flow)` → `pushUndoSnapshot(flow)`
- [ ] `historyUndo()` → `undo()`
- [ ] `historyRedo()` → `redo()`
- [ ] `getHistoryStatus()` → `getUndoStatus()`
- [ ] `initializeHistory(flow)` → `initializeUndoHistory(flow)`

**Remove or update:**
- [ ] `readFlow()` and `writeFlow()` - replace with direct `getFlow()` and `saveFlow()` from db.js

---

### 4. Delete obsolete files
- [ ] Delete `conversationService.js`
- [ ] Delete `historyService.js`

---

### 5. Update and reorganize tests

#### Critical Discovery
The service test files (conversationService.test.js, historyService.test.js) have BETTER coverage than db.test.js for the same functionality:
- conversationService.test.js tests timestamp format validation, flow.json leak prevention, edge cases
- historyService.test.js tests multi-step undo/redo sequences, canUndo/canRedo helpers
- db.test.js has basic coverage but missing these edge cases

**Strategy:** Merge the BEST tests into db.test.js, delete redundant service test files.

---

#### Tests to MERGE & DELETE

**Merge conversationService.test.js → db.test.js:**
- [ ] Copy "Timestamp handling" tests (timestamp format validation)
- [ ] Copy "Data integrity" tests (no flow.json leak)
- [ ] Copy "Edge cases" tests (limit exceeds length)
- [ ] Organize under new `describe('Conversation Operations', () => {})` sections
- [ ] Delete conversationService.test.js after merge

**Merge historyService.test.js → db.test.js:**
- [ ] Copy "Multi-step sequences" tests (undo multiple times, redo multiple times)
- [ ] Copy "State management helpers" tests (canUndo, canRedo, getHistoryStatus)
- [ ] Copy any edge cases not in db.test.js
- [ ] Organize under expanded `describe('Undo/Redo Operations', () => {})` sections
- [ ] Delete historyService.test.js after merge

**Result:** db.test.js grows from ~324 lines to ~600-650 lines with comprehensive coverage

---

#### Tests to RENAME & UPDATE

**Rename toolExecution.test.js → flowOperations.test.js:**
- [ ] Rename file: `mv tests/toolExecution.test.js tests/flowOperations.test.js`
- [ ] Update imports:
  ```javascript
  // OLD
  import { executeToolCalls, readFlow } from '../server/server.js';

  // NEW
  import { executeToolCalls } from '../server/flowOperations.js';
  import { getFlow } from '../server/db.js';
  ```
- [ ] Update helper function: `readFlow()` → `getFlow()`

---

#### Tests to UPDATE (imports only)

**undo-redo-autosave.test.js:**
- [ ] Update imports:
  ```javascript
  // OLD
  import { pushSnapshot, undo, redo, canRedo, clearHistory } from '../server/historyService.js';

  // NEW
  import { pushUndoSnapshot, undo, redo, getUndoStatus, clearUndoHistory } from '../server/db.js';
  ```
- [ ] Update function calls:
  - `pushSnapshot()` → `pushUndoSnapshot()`
  - `clearHistory()` → `clearUndoHistory()`
  - `canRedo()` → `getUndoStatus().canRedo`

**llmService.test.js:**
- [ ] Update imports:
  ```javascript
  // OLD
  import { clearHistory, addUserMessage, addAssistantMessage } from '../../server/conversationService.js';

  // NEW
  import { clearConversationHistory, addConversationMessage } from '../../server/db.js';
  ```
- [ ] Update function calls:
  - `addUserMessage('msg')` → `addConversationMessage('user', 'msg')`
  - `addAssistantMessage('msg', tools)` → `addConversationMessage('assistant', 'msg', tools)`
  - `clearHistory()` → `clearConversationHistory()`

---

#### Tests to CREATE

**Add to llmService.test.js:**
- [ ] Create new test suite: `describe('buildRetryMessage', () => {})`
- [ ] Test: formats successful tool calls
- [ ] Test: formats failed tool calls with errors
- [ ] Test: shows current flow state (nodes and edges)
- [ ] Test: handles mixed success/failure results
- [ ] Test: includes retry instructions
- [ ] Test: handles empty flow state

---

#### Tests to KEEP (no changes)

- [ ] **api-contracts.test.js** - No changes needed

---

#### Final Verification

- [ ] Run full test suite: `npm test`
- [ ] Verify no imports from deleted files
- [ ] Check test coverage hasn't decreased: `npm test -- --coverage`
- [ ] Ensure all edge cases still covered

---

## Design Decisions

### readFlow/writeFlow Functions
**Decision:** Remove these wrappers and use `getFlow()` and `saveFlow()` from db.js directly.

**Rationale:** They're thin wrappers that add no value. The only logic is the snapshot handling, which should be explicit at the call site.

### buildRetryMessage Location
**Decision:** Move to llmService.js

**Rationale:**
- It's LLM-facing translation logic
- Follows the pattern: `buildLLMContext()` translates TO LLM (initial), `parseToolCalls()` translates FROM LLM, `buildRetryMessage()` translates TO LLM (retry)
- Centralizes all LLM communication logic
- Makes testing easier

### Service Layer Removal
**Decision:** Delete conversationService.js and historyService.js

**Rationale:**
- They're trivial wrappers with no business logic
- Premature abstraction that adds indirection without value
- Direct db.js calls are clearer and simpler
