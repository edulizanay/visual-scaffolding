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
- [ ] Commit test fixes to git

## Phase 2: SQLite Migration (BLOCKED until Phase 1 complete)
- [ ] Create branch: feature/sqlite-migration
- [ ] Phase 2.1: Create test suite (e2e, data-integrity, api-contracts)
- [ ] Phase 2.2: Create database layer (schema + db.js)
- [ ] Phase 2.3: Update services (server.js, llmService.js, etc.)
- [ ] Phase 2.4: Create migration script
- [ ] Phase 2.5: Update existing tests for SQLite
- [ ] Phase 2.6: Update configuration (.gitignore, package.json)
- [ ] Phase 2.7: Verification & testing
