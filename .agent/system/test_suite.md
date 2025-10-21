# Test Suite Documentation

## Overview
- **Total Tests**: 703 passing tests across 50 test files
- **Test Runner**: Vitest 3.2.4 (migrated from Jest in October 2025)
- **Execution Time**: ~13 seconds (2.95x faster than Jest's ~10 seconds for equivalent subset)
- **Test Discovery**: All tests running (170+ tests were excluded in Jest due to config issues)
- **Frontend Testing**: React Testing Library with happy-dom environment
- **Backend Integration**: Supertest for full-stack workflow testing
- **Database**: In-memory SQLite (`:memory:`) for isolation
- **Coverage**: 86.38% overall code coverage

## Test Commands
```bash
npm test                  # Run all tests once
npm run test:watch        # Watch mode (auto-rerun on changes)
npm run test:ui           # Browser UI for debugging tests
npm run test:coverage     # Run tests with coverage report
npx vitest run <path>     # Run specific test file or directory
```

## Testing Tools

### Test Framework
- **Vitest 3.2.4** - Fast test runner with native ESM support
  - Compatible with Jest API (describe, it, expect, vi.fn(), etc.)
  - Multi-project configuration for different environments
  - Global test functions enabled (no imports needed)
  - v8 coverage provider for fast, accurate coverage
  - Hot Module Replacement for instant feedback

### Frontend Testing
- **React Testing Library** - Component rendering and user interaction testing
- **@testing-library/jest-dom** - DOM matchers (e.g., `toBeInTheDocument()`, `toHaveClass()`)
  - Uses `/vitest` entry point for Vitest compatibility
- **@testing-library/user-event** - Realistic user event simulation
- **happy-dom 20.0.0** - Lightweight browser environment (faster than jsdom)
  - Returns hex/named colors instead of rgb() format
- **Setup file**: [tests/setup-frontend.js](../../tests/setup-frontend.js) - Configures mocks for React Flow (matchMedia, IntersectionObserver, ResizeObserver)

### Backend/Integration Testing
- **Supertest** - HTTP assertions for testing API endpoints and full-stack workflows
  - Simulate frontend API calls without needing a browser
  - Test complete data flows: create → update → undo → verify
  - Use with real server instance to test frontend-backend integration
  - Example: `await request(app).post('/api/node').send({ label: 'Test' })`

## Vitest Configuration

### Multi-Project Setup
**File**: [vitest.config.js](../../vitest.config.js)

Four isolated test environments:
1. **backend** - Node environment for API and backend logic tests
2. **frontend-api** - Node environment for frontend utilities without DOM
3. **frontend-ui** - happy-dom environment for React component tests
4. **security** - Node environment for security and XSS tests

### Key Features
- React plugin for JSX transform
- Global test functions (no imports needed)
- Multi-project isolation prevents environment conflicts
- v8 coverage provider with HTML/JSON/text reporters
- Coverage includes `src/**` and `server/**`, excludes `tests/**`

## Test Conventions
1. **All tests use in-memory database** - Set via `process.env.DB_PATH = ':memory:'` in `beforeEach`
2. **All test files have ABOUTME comments** - Two lines at top explaining purpose
3. **Database cleanup** - `closeDb()` called in `afterEach`
4. **ES Modules** - Native ESM support (no experimental flags needed)
5. **Mock files use `.js` extension** - Standard ES module mocks in `tests/mocks/` (e.g., `styleMock.js`)
6. **Coverage reports** - HTML reports generated at `coverage/index.html` via `npm run test:coverage`
7. **Async module imports** - Use `await vi.importActual()` for dynamic imports in mocks

## Migration Notes

### Jest → Vitest (October 2025)
- **Performance**: 2.95x faster execution (7s vs ~10s)
- **Test Discovery**: Fixed 170+ tests that weren't running in Jest
- **Bug Found**: Fixed timestamp collision in group ID generation (exposed by faster execution)
- **Dependencies Removed**: jest, babel-jest, jest-environment-jsdom, jsdom
- **Dependencies Added**: vitest, @vitest/ui, @vitest/coverage-v8, happy-dom
- **Breaking Changes**: None (zero production code changes except bug fix)
- **Config**: jest.config.js removed, vitest.config.js added
- **See**: [VITEST_MIGRATION_COMPLETE.md](../VITEST_MIGRATION_COMPLETE.md) for full details

## Test Organization

### API Integration Tests (`tests/api-*.test.js`)
- **[api-contracts.test.js](tests/api-contracts.test.js)** - API contract stability (response formats, status codes)
- **[api-node-creation.test.js](tests/api-node-creation.test.js)** - POST /api/node endpoint with group inheritance
- **[api-edge-creation.test.js](tests/api-edge-creation.test.js)** - POST /api/edge endpoint with validation
- **[api-label-updates.test.js](tests/api-label-updates.test.js)** - Node/edge label updates via API
- **[api-group-operations.test.js](tests/api-group-operations.test.js)** - Group creation, ungrouping, expansion
  - Nested group ungroup tests (members kept within ancestor group)

### Full-Stack Workflow Tests (`tests/integration/`)
- **[workflow-state-sync.test.js](tests/integration/workflow-state-sync.test.js)** - Complete user workflows simulating frontend-backend data flow
  - Tests: backend operation → frontend save → undo → verify state
  - Uses supertest to simulate frontend API calls without browser
  - Validates state synchronization between operations
- **[double-save-prevention.test.js](tests/integration/double-save-prevention.test.js)** - Verifies operations save exactly once
- **[save-paths.test.js](tests/integration/save-paths.test.js)** - All save paths create snapshots
- **[save-race-conditions.test.js](tests/integration/save-race-conditions.test.js)** - Concurrent operations and snapshot integrity

### Conversation & LLM Tests
- **[conversationService.test.js](tests/conversationService.test.js)** - Conversation CRUD and history management
- **[llm/llmService.test.js](tests/llm/llmService.test.js)** - Context building and response parsing
- **[llm/llmParsing-edgecases.test.js](tests/llm/llmParsing-edgecases.test.js)** - Edge cases (multiple thinking tags, JSON comments, trailing commas)
- **[integration/conversation-endpoint.test.js](tests/integration/conversation-endpoint.test.js)** - Full retry loop with mocked LLM
- **[integration/message-retry.test.js](tests/integration/message-retry.test.js)** - Retry logic without mocks

### Tool Execution Tests
- **[toolExecution.test.js](tests/toolExecution.test.js)** - All 8 tool operations with comprehensive edge cases
- **[toolExecution-ids.test.js](tests/toolExecution-ids.test.js)** - ID collision detection and sanitization

### Group & History Tests
- **[groupHelpers.test.js](tests/groupHelpers.test.js)** - Group utilities (descendants, validation, visibility, state transitions)
  - Depth-based incremental padding tests (nested groups with decay factor)
  - Ungroup hierarchy preservation tests (reassignment to parent group)
- **[historyService.test.js](tests/historyService.test.js)** - History management
- **[undo-redo-autosave.test.js](tests/undo-redo-autosave.test.js)** - Undo/redo with auto-save (redo chain preservation)

### Infrastructure Tests
- **[db.test.js](tests/db.test.js)** - Database layer SQLite CRUD operations
- **[schema-migration.test.js](tests/schema-migration.test.js)** - Backward compatibility for group fields migration

### Security Tests
- **[security/xss-prevention.test.js](tests/security/xss-prevention.test.js)** - XSS prevention (verifies safe storage, frontend escaping)

### UI/Frontend Tests
- **[unit/frontend/api.test.js](tests/unit/frontend/api.test.js)** - Frontend API client and error handling
- **[unit/backend/hotkeys-registry.test.js](tests/unit/backend/hotkeys-registry.test.js)** - Centralized hotkeys registry

## Quick Reference

**Testing API endpoints?** → Look in `tests/api-*.test.js`

**Testing LLM parsing?** → Look in `tests/llm/`

**Testing tool operations?** → Look in `tests/toolExecution*.test.js`

**Testing groups?** → Look in `tests/groupHelpers.test.js`

**Testing security?** → Look in `tests/security/`

**Testing database?** → Look in `tests/db.test.js`
