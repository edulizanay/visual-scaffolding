# Test Suite Documentation

## Overview
- **Total Tests**: 500+ passing tests
- **Test Runner**: Vitest 3.2.4 with multi-project configuration
- **Database**: Supabase test database with `setupTestDb()/cleanupTestDb()` helpers
- **Coverage**: Target >85%, currently tracking well

For test commands and how to write tests, see [writing-tests.md](../SOP/writing-tests.md).

## Configuration

**File**: [vitest.config.js](../../vitest.config.js)

Multi-project setup with 4 isolated environments:
- **backend** - Node environment for API and backend logic
- **frontend-api** - Node environment for frontend utilities
- **frontend-ui** - happy-dom for React components
- **security** - Node environment for security tests

Coverage via v8 provider, includes `src/**` and `server/**`.

## Test Organization

- **API Tests** (`tests/api-*.test.js`) - Contract stability, endpoint validation, CRUD operations
- **Integration Tests** (`tests/integration/`) - Full-stack workflows, state sync, save paths, race conditions
- **LLM Tests** (`tests/llm/`, conversation endpoints) - Context building, parsing, retry logic
- **Tool Tests** (`tests/toolExecution*.test.js`) - Tool operations, ID sanitization, edge cases
- **Group Tests** (`tests/groupHelpers.test.js`) - Utilities, validation, visibility, depth-based padding
- **History Tests** (`tests/historyService.test.js`, `tests/undo-redo-autosave.test.js`) - Undo/redo, snapshots
- **Infrastructure** (`tests/db.test.js`, `tests/schema-migration.test.js`) - Database layer, migrations
- **Security** (`tests/security/xss-prevention.test.js`) - XSS prevention, safe storage
- **Frontend** (`tests/unit/frontend/`, `tests/unit/backend/hotkeys-registry.test.js`) - API client, components, hotkeys
