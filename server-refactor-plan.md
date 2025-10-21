# Server Structure Refactoring Plan

**Status**: Ready for execution
**Last Updated**: 2025-10-21
**Estimated Time**: 6-8 hours

## Overview

After migrating from SQLite to Supabase, `server/db.js` has grown to 517 lines handling three domains (flows, undo, conversation). This refactoring splits it into focused repositories, migrates notes to Supabase, consolidates duplicate code, and removes legacy routes.

**Key Goals**:
1. Split db.js into domain repositories (~200 lines each)
2. Migrate notes from JSON file to Supabase table
3. Consolidate duplicate readFlow/writeFlow implementations
4. Extract shared LLM utilities
5. Update tests to use namespaced routes
6. Document follow-through plan for direct repository imports

**Success Criteria**:
- ✅ All 542 tests passing
- ✅ Test coverage remains >86%
- ✅ db.js reduced from 517 to ~10 lines
- ✅ No more notes-debug.json file
- ✅ No duplicate code
- ✅ Clean namespace routes

---

## Task 1: Split db.js into Domain Repositories

**Goal**: Break 517-line db.js into 3 focused repositories (flows, undo, conversation).

### Checklist

- [x] **1.1: Create flowRepository.js**
  - [ ] Create `server/repositories/flowRepository.js`
  - [ ] Extract `sanitizeFlowData()` (db.js lines 32-39)
  - [ ] Extract `getFlow()` (db.js lines 41-58)
  - [ ] Extract `saveFlow()` (db.js lines 64-84)
  - [ ] Extract `getFlowId()` (db.js lines 89-102)
  - [ ] Add ABOUTME comments
  - [ ] Verify ~100 lines total

- [x] **1.2: Create undoRepository.js**
  - [ ] Create `server/repositories/undoRepository.js`
  - [ ] Extract `stableStringify()` (db.js lines 13-24)
  - [ ] Extract `pushUndoSnapshot()` (db.js lines 174-307)
  - [ ] Extract `undo()` (db.js lines 312-355)
  - [ ] Extract `redo()` (db.js lines 360-403)
  - [ ] Extract `getUndoStatus()` (db.js lines 408-485)
  - [ ] Extract `clearUndoHistory()` (db.js lines 490-509)
  - [ ] Extract `initializeUndoHistory()` (db.js lines 514-517)
  - [ ] Add ABOUTME comments
  - [ ] Verify ~200 lines total

- [x] **1.3: Create conversationRepository.js**
  - [ ] Create `server/repositories/conversationRepository.js`
  - [ ] Extract `addConversationMessage()` (db.js lines 109-121)
  - [ ] Extract `getConversationHistory()` (db.js lines 127-152)
  - [ ] Extract `clearConversationHistory()` (db.js lines 157-166)
  - [ ] Add ABOUTME comments
  - [ ] Verify ~50 lines total

- [x] **1.4: Update db.js to re-export**
  - [ ] Replace db.js content with:
    ```javascript
    // ABOUTME: Database layer compatibility exports
    // ABOUTME: Re-exports from domain repositories for backward compatibility
    export * from './repositories/flowRepository.js';
    export * from './repositories/undoRepository.js';
    export * from './repositories/conversationRepository.js';
    ```
  - [ ] Verify db.js is now ~10 lines

- [x] **1.5: Update tests**
  - [ ] Run `npm test -- tests/db.test.js`
  - [ ] Verify all 404 lines of tests still pass
  - [ ] Add test suites that import repositories directly (optional)

- [x] **1.6: Verify no regressions**
  - [ ] Run full test suite: `npm test`
  - [ ] Verify 542 tests passing
  - [ ] Check coverage: `npm run test:coverage` (>86%)

---

## Task 2: Migrate Notes to Supabase

**Goal**: Replace file-based notes storage with Supabase table.

### Checklist

- [x] **2.1: Create Supabase migration**
  - [ ] Use Supabase MCP `apply_migration` tool
  - [ ] Migration name: `create_notes_table`
  - [ ] SQL:
    ```sql
    CREATE TABLE notes (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      bullets JSONB NOT NULL DEFAULT '[]',
      conversation_history JSONB NOT NULL DEFAULT '[]',
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    INSERT INTO notes (id, bullets, conversation_history)
    VALUES (1, '[]', '[]')
    ON CONFLICT DO NOTHING;

    ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Allow all operations on notes"
      ON notes FOR ALL
      USING (true) WITH CHECK (true);
    ```
  - [ ] Verify migration applied successfully
  - [ ] Document in `.agent/migrations/README.md`

- [x] **2.2: Create notesRepository.js**
  - [ ] Create `server/repositories/notesRepository.js`
  - [ ] Implement `getNotes()` - returns empty state if row missing
  - [ ] Implement `saveNotes(bullets, conversationHistory)` - upsert
  - [ ] Implement `updateBullets(bullets)` - upsert-tolerant
  - [ ] Add ABOUTME comments
  - [ ] Verify ~70 lines total

- [x] **2.3: Update test-db-setup.js**
  - [ ] Add `'notes'` to `tables` array (line 27)
  - [ ] Add `seedNotes()` helper after `seedConversationHistory`
  - [ ] Add notes singleton reset in `truncateAllTables()` (after undo_state)
  - [ ] Verify cleanup handles notes table

- [x] **2.4: Update notesRoutes.js**
  - [ ] Replace import: `'../notesService.js'` → `'../repositories/notesRepository.js'`
  - [ ] Replace function calls: `loadNotes()` → `getNotes()`
  - [ ] **CRITICAL**: Add `await` to all repository calls (getNotes, saveNotes, updateBullets are now async)
  - [ ] Example: `const notes = loadNotes()` → `const notes = await getNotes()`
  - [ ] Verify all route handlers are async functions
  - [ ] Verify route still works

- [x] **2.5: Update tests/notesService.test.js**
  - [ ] Update import to use `notesRepository.js`
  - [ ] Add `setupTestDb/cleanupTestDb` imports and hooks
  - [ ] **CRITICAL**: Add `await` to all repository calls (getNotes, saveNotes, updateBullets)
  - [ ] Replace file system assertions with Supabase queries (use `await testSupabase.from('notes')...`)
  - [ ] Remove `NOTES_FILE_PATH`, `existsSync`, `readFileSync`, etc.
  - [ ] Run `npm test -- tests/notesService.test.js`
  - [ ] Verify all 168 lines of tests pass

- [x] **2.6: Update tests/api-notes.test.js**
  - [ ] Remove `existsSync, unlinkSync` imports (lines 7-8)
  - [ ] Remove `NOTES_FILE_PATH` constant (lines 14-15)
  - [ ] Remove file cleanup in `beforeEach` (lines 28-31)
  - [ ] Remove file cleanup in `afterEach` (lines 37-40)
  - [ ] **CRITICAL - Dynamic imports**: Delete `await import('../server/notesService.js')` in T1.10 (line 46)
  - [ ] Update T1.10: Use `await seedNotes()` from test-db-setup instead of file pre-population
  - [ ] Update T1.10b: Remove `existsSync` check
  - [ ] Update T1.11+: Replace file assertions with `await testSupabase.from('notes')...` queries
  - [ ] Run `npm test -- tests/api-notes.test.js`
  - [ ] Verify tests pass

- [x] **2.7: Update tests/integration/notesPanel.integration.test.js**
  - [ ] Remove `fs` import (line 7)
  - [ ] Remove `NOTES_FILE_PATH` constant (lines 14-15)
  - [ ] Remove file cleanup in `beforeEach` (lines 19-22)
  - [ ] Remove file cleanup in `afterEach` (lines 27-30)
  - [ ] **CRITICAL - Dynamic imports**: Update `await import('../../server/notesService.js')` (line 72) → `await import('../../server/repositories/notesRepository.js')`
  - [ ] **CRITICAL**: Add `await` to all repository calls (getNotes, saveNotes)
  - [ ] Update I1: Remove file assertions (lines 62-66), use `await testSupabase.from('notes')...` queries
  - [ ] Update I2: Replace `loadNotes/saveNotes` with `getNotes/saveNotes` from notesRepository
  - [ ] Replace file reads with Supabase queries
  - [ ] Run `npm test -- tests/integration/notesPanel.integration.test.js`
  - [ ] Verify tests pass

- [x] **2.8: Update tests/e2e/notesPanel.e2e.test.js**
  - [ ] Remove `fs` import (line 8)
  - [ ] Remove `NOTES_FILE_PATH` constant (lines 15-16)
  - [ ] Remove file cleanup in `beforeEach` (lines 22-25)
  - [ ] Remove file cleanup in `afterEach` (lines 30-33)
  - [ ] **CRITICAL**: Verify no dynamic imports of notesService (check entire file)
  - [ ] Update E2E1: Remove file assertions (line 80+), rely on `/api/notes` responses to verify persistence
  - [ ] Update all tests: Replace file operations with API checks (no direct `testSupabase` usage in E2E suite)
  - [ ] Run `npm test -- tests/e2e/notesPanel.e2e.test.js`
  - [ ] Verify tests pass

- [x] **2.9: Verify no remaining notesService imports**
  - [ ] Run: `rg "from ['\"].*notesService" -g '!node_modules'`
  - [ ] Expected: No matches (all 4 files updated in 2.4-2.8)
  - [ ] If stragglers found, update them

- [x] **2.10: Verify no remaining notes-debug.json references**
  - [ ] Run: `rg 'notes-debug' -g '!node_modules'`
  - [ ] Expected: Only `package.json` server:dev script
  - [ ] If other matches found, clean them up

- [x] **2.11: Delete notesService.js and notes-debug.json**
  - [ ] Delete `server/notesService.js` (73 lines removed)
  - [ ] Delete `notes-debug.json` (if exists in project root)
  - [ ] Update `.gitignore`: Remove notes-debug.json entry (if exists)

- [x] **2.12: Update package.json**
  - [ ] Edit `server:dev` script
  - [ ] Remove `--ignore 'notes-debug.json'` from nodemon command
  - [ ] Final script: `"server:dev": "nodemon --ignore 'server/data/**' server/server.js"`

- [x] **2.13: Verify all notes tests pass**
  - [ ] Run: `npm test -- notesService.test.js`
  - [ ] Run: `npm test -- api-notes.test.js`
  - [ ] Run: `npm test -- integration/notesPanel`
  - [ ] Run: `npm test -- e2e/notesPanel`
  - [ ] Verify all pass

---

## Task 3: Consolidate readFlow/writeFlow

**Goal**: Eliminate duplicate implementations in app.js and executor.js.

### Checklist

- [x] **3.1: Create flowService.js**
  - [ ] Create `server/services/flowService.js`
  - [ ] Implement `readFlow(userId, name)` calling `flowRepository.getFlow()`
  - [ ] Implement `writeFlow(flowData, skipSnapshot, origin, userId, name)` calling `flowRepository.saveFlow()` + `historyService.pushSnapshot()`
  - [ ] Add ABOUTME comments
  - [ ] Verify ~20 lines total

- [x] **3.2: Update app.js**
  - [ ] Remove `getFlow as dbGetFlow, saveFlow as dbSaveFlow` import
  - [ ] Remove `pushSnapshot` import
  - [ ] Remove `readFlow()` function (lines 18-20)
  - [ ] Remove `writeFlow()` function (lines 22-28)
  - [ ] Add import: `import { readFlow, writeFlow } from './services/flowService.js';`
  - [ ] Re-export: `export { readFlow, writeFlow };`
  - [ ] Lines saved: 12 net reduction

- [x] **3.3: Update executor.js**
  - [ ] Remove `getFlow as dbGetFlow, saveFlow as dbSaveFlow` import
  - [ ] Remove `pushSnapshot` import
  - [ ] Remove `readFlow()` function (lines 10-12)
  - [ ] Remove `writeFlow()` function (lines 14-19)
  - [ ] Add import: `import { readFlow, writeFlow } from '../services/flowService.js';`
  - [ ] Lines saved: 13 net reduction

- [x] **3.4: Verify no regressions**
  - [ ] Run full test suite: `npm test`
  - [ ] Verify 542 tests still passing
  - [ ] Check that flow operations work correctly

---

## Task 4: Extract Shared LLM Utility

**Goal**: DRY up checkLLMAvailability and logError duplication.

### Checklist

- [x] **4.1: Create llmUtils.js**
  - [ ] Create `server/llm/llmUtils.js`
  - [ ] Implement `checkLLMAvailability()` - returns Boolean for API key check
  - [ ] Implement `logError(operation, error)` - consistent error logging
  - [ ] Add ABOUTME comments
  - [ ] Verify ~20 lines total

- [x] **4.2: Update conversationRoutes.js**
  - [ ] Delete `logError()` function (lines 13-15)
  - [ ] Delete `checkLLMAvailability()` function (lines 30-32)
  - [ ] Add import: `import { checkLLMAvailability, logError } from '../llm/llmUtils.js';`
  - [ ] Lines saved: 5 net reduction

- [x] **4.3: Update notesRoutes.js**
  - [ ] Delete `logError()` function (lines 10-12)
  - [ ] Delete `checkLLMAvailability()` function (lines 15-17)
  - [ ] Add import: `import { checkLLMAvailability, logError } from '../llm/llmUtils.js';`
  - [ ] Lines saved: 5 net reduction

- [x] **4.4: Verify no regressions**
  - [ ] Run: `npm test -- integration/conversation-endpoint.test.js`
  - [ ] Run: `npm test -- api-notes.test.js`
  - [ ] Verify route behavior unchanged

---

## Task 5: Update Legacy Route Tests

**Goal**: Update tests to use namespaced routes (`/api/flow/*`), then remove legacy mounting.

### Checklist

- [x] **5.1: Verify frontend uses namespaced routes**
  - [ ] Run: `rg "'/api/(node|edge|group)'" src/`
  - [ ] Expected: No matches (frontend already uses `/api/flow/*`)

- [x] **5.2: Update test files to use namespaced routes**
  - [ ] Update `tests/api-node-creation.test.js`
    - [ ] Replace `/api/node` → `/api/flow/node` (4 instances)
    - [ ] Run test, verify passes
  - [ ] Update `tests/api-edge-creation.test.js`
    - [ ] Replace `/api/edge` → `/api/flow/edge` (6 instances)
    - [ ] Run test, verify passes
  - [ ] Update `tests/integration/workflow-state-sync.test.js`
    - [ ] Replace `/api/node` → `/api/flow/node` (14 instances)
    - [ ] Run test, verify passes
  - [ ] Update `tests/integration/save-paths.test.js`
    - [ ] Replace `/api/node` → `/api/flow/node`
    - [ ] Replace `/api/edge` → `/api/flow/edge`
    - [ ] Replace `/api/group` → `/api/flow/group`
    - [ ] Run test, verify passes
  - [ ] Update `tests/integration/drag-end-persistence.test.js`
    - [ ] Replace `/api/node` → `/api/flow/node` (4 instances)
    - [ ] Run test, verify passes
  - [ ] Update `tests/integration/save-race-conditions.test.js`
    - [ ] Replace `/api/node` → `/api/flow/node` (2 instances)
    - [ ] Run test, verify passes

- [x] **5.3: Verify no remaining legacy route usage**
  - [ ] Run: `rg "'/api/(node|edge|group)'" -g '*.js' -g '!node_modules'`
  - [ ] Expected: No matches

- [x] **5.4: Remove legacy route mounting**
  - [ ] Open `server/routes/index.js`
  - [ ] Delete lines 23-27:
    ```javascript
    // Legacy flat routes under /api
    // /api/node, /api/edge, /api/group (not nested under /api/flow)
    const legacyRouter = Router();
    registerFlowRoutes(legacyRouter, { readFlow, writeFlow });
    app.use('/api', legacyRouter);
    ```
  - [ ] Lines saved: 5 lines deleted

- [x] **5.5: Verify all tests still pass**
  - [ ] Run full test suite: `npm test`
  - [ ] Verify 542 tests passing
  - [ ] Specifically check updated integration tests

---

## Task 6: Document Follow-Through Plan

**Goal**: Document plan for future migration from db.js compatibility layer to direct repository imports.

### Checklist

- [ ] **6.1: Document Priority 1 modules**
  - [ ] List in plan.md: `server/historyService.js`, `server/llm/llmService.js`, `server/conversationService.js`
  - [ ] Note: These should import from repositories, not db.js

- [ ] **6.2: Document Priority 2 modules**
  - [ ] List in plan.md: Test files can migrate after Priority 1 stable
  - [ ] Note: Tests currently verify compatibility layer works

- [ ] **6.3: Document Priority 3 modules**
  - [ ] List in plan.md: Route handlers get readFlow/writeFlow via DI, no action needed

- [ ] **6.4: Document compatibility layer removal plan**
  - [ ] When: After Priority 1 + 2 complete
  - [ ] Verify: `rg "from ['\"].*[/]db['\"]" -g '!node_modules'`
  - [ ] Action: Delete db.js, verify tests pass

- [ ] **6.5: Note this is for future work**
  - [ ] Mark as not included in current refactor
  - [ ] Purpose: Documentation only

---

## Documentation Updates

### Checklist

- [ ] **Update .agent/system/project_architecture.md**
  - [ ] Add "Repository Layer" section
  - [ ] Document domain repositories (flow, undo, conversation, notes)
  - [ ] Document service layer (flowService, conversationService)
  - [ ] Commit with refactor changes

- [ ] **Update .agent/system/database_schema.md**
  - [ ] Add notes table documentation after conversation_history
  - [ ] Include: Table structure, fields, API functions, RLS info
  - [ ] Mark as singleton table pattern
  - [ ] Commit with refactor changes

- [ ] **Update .agent/migrations/README.md**
  - [ ] Add entry for create_notes_table migration
  - [ ] Include timestamp, table details, RLS policy
  - [ ] Commit with refactor changes

---

## Testing & Verification

### Checklist

- [ ] **Per-task testing**
  - [ ] Task 1: db.test.js passes (404 lines)
  - [ ] Task 2: All notes tests pass (notesService, api-notes, integration, e2e)
  - [ ] Task 3: Full test suite passes
  - [ ] Task 4: Conversation and notes integration tests pass
  - [ ] Task 5: All updated test files pass
  - [ ] Task 6: Documentation only (no tests)

- [ ] **Final regression suite**
  - [ ] Run: `npm test`
  - [ ] Verify: All 542 tests passing
  - [ ] Run: `npm run test:coverage`
  - [ ] Verify: Coverage >86%
  - [ ] Manually test: Notes panel in UI
  - [ ] Manually test: Flow operations (add node, undo, etc.)

- [ ] **Critical test files verified green**
  - [ ] tests/db.test.js (404 lines)
  - [ ] tests/historyService.test.js (259 lines)
  - [ ] tests/conversationService.test.js (138 lines)
  - [ ] tests/notesService.test.js (168 lines)
  - [ ] All 42 API integration tests
  - [ ] All 8 updated route tests

---

## File Changes Summary

### New Files (7 created)
- [ ] `server/repositories/flowRepository.js` (~100 lines)
- [ ] `server/repositories/undoRepository.js` (~200 lines)
- [ ] `server/repositories/conversationRepository.js` (~50 lines)
- [ ] `server/repositories/notesRepository.js` (~70 lines)
- [ ] `server/services/flowService.js` (~20 lines)
- [ ] `server/llm/llmUtils.js` (~20 lines)
- [ ] Migration: `create_notes_table` (~25 lines SQL)

### Modified Files (16 updated)
- [ ] `server/db.js` - Reduced from 517 to ~10 lines
- [ ] `server/app.js` - Import flowService
- [ ] `server/tools/executor.js` - Import flowService
- [ ] `server/routes/conversationRoutes.js` - Import llmUtils
- [ ] `server/routes/notesRoutes.js` - Import llmUtils + notesRepository
- [ ] `server/routes/index.js` - Remove legacy mounting
- [ ] `tests/test-db-setup.js` - Add notes table handling
- [ ] `tests/notesService.test.js` - Supabase assertions
- [ ] `tests/api-notes.test.js` - Supabase assertions
- [ ] `tests/integration/notesPanel.integration.test.js` - Supabase assertions
- [ ] `tests/e2e/notesPanel.e2e.test.js` - Supabase assertions
- [ ] `tests/api-node-creation.test.js` - Namespaced routes
- [ ] `tests/api-edge-creation.test.js` - Namespaced routes
- [ ] `tests/integration/workflow-state-sync.test.js` - Namespaced routes
- [ ] `tests/integration/save-paths.test.js` - Namespaced routes
- [ ] `tests/integration/drag-end-persistence.test.js` - Namespaced routes
- [ ] `tests/integration/save-race-conditions.test.js` - Namespaced routes
- [ ] `package.json` - Remove notes-debug ignore
- [ ] `.gitignore` - Remove notes-debug.json (if present)

### Deleted Files (2 removed)
- [ ] `server/notesService.js` (73 lines)
- [ ] `notes-debug.json` (if exists)

### Net Line Change
- **Lines added**: ~485 (new files)
- **Lines removed**: ~610 (db.js split + duplicates + notesService + legacy routes)
- **Net reduction**: ~125 lines while improving organization

---

## Rollback Strategy

If any task fails:

1. **Revert migration** (Task 2 only):
   ```bash
   # Use Supabase console or MCP to drop notes table
   ```

2. **Git reset**:
   ```bash
   git reset --hard HEAD
   ```

3. **Verify tests**:
   ```bash
   npm test  # Confirm back to 542 passing
   ```

Each task is independently reversible.

---

## Success Criteria (Final Checklist)

- [ ] ✅ All 542 tests passing
- [ ] ✅ Test coverage remains >86%
- [ ] ✅ db.js reduced from 517 to ~10 lines
- [ ] ✅ No duplicate readFlow/writeFlow implementations
- [ ] ✅ Notes using Supabase (no more JSON file)
- [ ] ✅ checkLLMAvailability centralized in llmUtils
- [ ] ✅ All tests using namespaced routes (`/api/flow/*`)
- [ ] ✅ Legacy route mounting removed
- [ ] ✅ test-db-setup.js handles notes table
- [ ] ✅ RLS policies configured for notes table
- [ ] ✅ No references to notes-debug.json remain
- [ ] ✅ Package.json cleaned up
- [ ] ✅ Documentation updated (architecture, schema, migrations)
- [ ] ✅ Follow-through plan documented (Task 6)

---

## Estimated Effort

- Task 1 (Split db.js): 2-3 hours
- Task 2 (Notes to Supabase): 2-3 hours
- Task 3 (Consolidate flow helpers): 30 minutes
- Task 4 (Extract LLM utils): 15 minutes
- Task 5 (Update test routes): 45 minutes
- Task 6 (Document follow-through): 15 minutes
- Documentation updates: 30 minutes

**Total: 6-8 hours**

---

## Notes

- Keep db.js as compatibility layer short-term (prevents breaking 42 import sites)
- Task 6 documents plan for future direct repository imports
- All tests must pass after each task before proceeding
- Use `npm test -- <file>` for targeted test runs during development
- Commit after each major task completion

---

**Ready to execute!** Start with Task 1, verify tests pass, then proceed sequentially.
