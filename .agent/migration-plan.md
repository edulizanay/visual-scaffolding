# Future Migration Plan: Remove db.js Compatibility Layer

**Status**: Documentation only - NOT included in current refactor
**Purpose**: Plan for eventual removal of db.js compatibility layer

## Overview

The current refactor has created domain-specific repositories (flowRepository, undoRepository, conversationRepository, notesRepository) while keeping db.js as a compatibility layer that re-exports from these repositories. This document outlines the plan for future migration to direct repository imports.

## Migration Priorities

### Priority 1: Core Service Modules

These modules should be migrated first as they form the foundation:

- **`server/historyService.js`** - Currently imports from db.js
  - Should import: `flowRepository.getFlow/saveFlow`, `undoRepository.*`
  - Impact: Undo/redo functionality

- **`server/llm/llmService.js`** - Currently imports from db.js (if any)
  - Review for any db.js dependencies
  - Migrate to repository imports if needed

- **`server/conversationService.js`** - Currently imports from db.js
  - Should import: `conversationRepository.*`
  - Impact: Conversation history management

**Action**: Update these files to import directly from repositories instead of db.js

### Priority 2: Test Files

After Priority 1 is stable and tested:

- All test files currently importing from db.js
- Tests currently verify the compatibility layer works correctly
- Migrate tests to import from repositories directly
- This validates the repository layer independently

**Action**: Update test imports from `'../server/db.js'` to specific repository imports

### Priority 3: Route Handlers (No Action Needed)

- Route handlers receive `readFlow`/`writeFlow` via dependency injection
- These come from `flowService.js` which already uses repositories
- No migration needed for route handlers

## Compatibility Layer Removal

### When

After Priority 1 and Priority 2 are complete and stable.

### Verification Command

```bash
rg "from ['\"].*[/]db['\"]" -g '*.js' -g '!node_modules'
```

Should return zero results (except for repository files importing from each other).

### Action

1. Delete `server/db.js`
2. Run full test suite: `npm test`
3. Verify all tests pass
4. Commit with message: "refactor: remove db.js compatibility layer"

## Benefits of Completion

- **Clearer dependencies**: Modules explicitly import what they need
- **Better maintainability**: No hidden re-exports through compatibility layer
- **Reduced indirection**: Direct imports are easier to trace
- **Smaller bundle**: No unnecessary re-export overhead

## Notes

- This migration is intentionally left for future work
- Current refactor focused on establishing repository pattern
- Compatibility layer allows gradual migration
- No breaking changes to existing code during transition
