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

### Step 3: Database Layer ✅ COMPLETE
- [x] Create server/migrations/001_initial.sql (schema for flows, conversation, undo/redo)
- [x] Create server/db.js (database wrapper with all CRUD functions)
- [x] Create tests/db.test.js (22 tests covering all operations)
- [x] Run db tests - **22/22 passing!**

### Step 4: Update Services (Replace File I/O) ✅ COMPLETE
- [x] Update server/server.js (readFlow/writeFlow)
  - [x] Replace file I/O with db.js calls
  - [x] Run tests after changes
- [x] Update server/llm/llmService.js (loadFlow)
  - [x] Replace file I/O with db.js calls
  - [x] Run tests after changes
- [x] Update server/conversationService.js
  - [x] Replace file I/O with db.js calls
  - [x] Run tests after changes
- [x] Update server/historyService.js
  - [x] Replace file I/O with db.js calls
  - [x] Run tests after changes
- [x] Fix all test failures (updated all tests to use :memory: DB)
- [x] Run full test suite - **121/121 tests passing!**

### Step 5: Migration Script ✅ COMPLETE
- [x] Create server/migrate-to-sqlite.js
- [x] Test migration script with backup data
- [x] Verify node count before/after migration (15 nodes, 18 edges ✅)

### Step 6: Configuration ✅ COMPLETE
- [x] Update .gitignore (add *.db, *.db-shm, *.db-wal, backup-*/)
- [x] Update package.json (add migrate script)
- [x] Create .env.example

### Step 7: Final Verification ✅ COMPLETE
- [x] Run full test suite - **121/121 tests passing!** ✅
- [x] Run migration script on real data (15 nodes, 18 edges) ✅
- [x] Verify database contents ✅
- [x] Update scratchpad.md with completion
- [x] Commit to feature branch (commit 2cccff8)
- [ ] Ask Edu for review before merging

## 🎉 SQLite Migration Complete!

All 7 steps completed successfully. Committed to feature/sqlite-migration branch.
Ready for Edu's review!
