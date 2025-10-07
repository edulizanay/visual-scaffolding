# TODO: Fix Failing Tests Before SQLite Migration

## Phase 1: Fix Test Failures ✅ COMPLETE
- [x] Fix toolExecution.test.js (11 failures)
  - [x] Analyze executeTool signature and usage
  - [x] Update tests to properly load/pass flow (created wrapper using executeToolCalls)
  - [x] Run tests to verify fix
- [x] Fix undo-redo-autosave.test.js (1 failure)
  - [x] Understand expected vs actual behavior (test pollution from shared history.json)
  - [x] Add isolated test path
  - [x] Run tests to verify fix
- [x] Verify all tests pass (baseline green) - **66/66 tests passing!**
- [x] Update scratchpad.md with results
- [x] Commit test fixes to git (commit 4dd9cdc)

## Phase 2: SQLite Migration (Ready to start!)

### Step 1: Branch & Setup ✅
- [x] Create branch: feature/sqlite-migration
- [x] Update scratchpad.md with migration start
- [x] Install better-sqlite3 dependency (v12.4.1)

### Step 2: Create Test Suite (Safety Net) ✅ COMPLETE
- [x] Create tests/e2e-flow-operations.test.js (7 tests covering persistence, undo/redo, complex graphs)
- [x] Create tests/data-integrity.test.js (10 tests covering unicode, special chars, edge cases)
- [x] Create tests/api-contracts.test.js (20 tests covering all API endpoints and error handling)
- [x] Run full test suite - **102/102 tests passing!**

### Step 3: Database Layer
- [ ] Create server/migrations/001_initial.sql (schema)
- [ ] Create server/db.js (database wrapper with all CRUD functions)
- [ ] Create tests/db.test.js to test database layer
- [ ] Run db tests to verify correctness

### Step 4: Update Services (Replace File I/O)
- [ ] Update server/server.js (readFlow/writeFlow)
  - [ ] Replace file I/O with db.js calls
  - [ ] Run tests after changes
- [ ] Update server/llm/llmService.js (loadFlow)
  - [ ] Replace file I/O with db.js calls
  - [ ] Run tests after changes
- [ ] Update server/conversationService.js
  - [ ] Replace file I/O with db.js calls
  - [ ] Run tests after changes
- [ ] Update server/historyService.js
  - [ ] Replace file I/O with db.js calls
  - [ ] Run tests after changes

### Step 5: Migration Script
- [ ] Create server/migrate-to-sqlite.js
- [ ] Test migration script with backup data
- [ ] Verify node count before/after migration

### Step 6: Configuration
- [ ] Update .gitignore (add *.db, *.db-shm, *.db-wal)
- [ ] Update package.json (add better-sqlite3, add migrate script)
- [ ] Create .env.example

### Step 7: Final Verification
- [ ] Run full test suite - all must pass
- [ ] Manual smoke test (create nodes, restart, verify persistence)
- [ ] Run migration script on real data
- [ ] Verify database contents
- [ ] Update scratchpad.md with completion
- [ ] Commit to feature branch
- [ ] Ask Edu for review before merging
