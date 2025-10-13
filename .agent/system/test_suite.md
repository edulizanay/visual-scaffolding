# Test Suite Documentation

## Overview
- **Total Tests**: 317 tests across 19 test files
- **Test Runner**: Jest with ES modules (`NODE_OPTIONS=--experimental-vm-modules`)
- **Frontend Testing**: React Testing Library with jsdom environment
- **Database**: In-memory SQLite (`:memory:`) for isolation
- **Run All Tests**: `npm test`
- **Run Specific**: `NODE_OPTIONS=--experimental-vm-modules npx jest <path>`

## Frontend Testing Tools
- **React Testing Library** - Component rendering and user interaction testing
- **@testing-library/jest-dom** - DOM matchers (e.g., `toBeInTheDocument()`, `toHaveClass()`)
- **@testing-library/user-event** - Realistic user event simulation
- **jsdom** - Browser environment simulation for React components
- **Setup file**: [tests/setup-frontend.js](../../tests/setup-frontend.js) - Configures mocks for React Flow (matchMedia, IntersectionObserver, ResizeObserver)

## Test Conventions
1. **All tests use in-memory database** - Set via `process.env.DB_PATH = ':memory:'` in `beforeEach`
2. **All test files have ABOUTME comments** - Two lines at top explaining purpose
3. **Database cleanup** - `closeDb()` called in `afterEach`
4. **ES Modules** - All tests require `NODE_OPTIONS=--experimental-vm-modules`

## Test Organization

### API Integration Tests (`tests/api-*.test.js`)
- **[api-contracts.test.js](tests/api-contracts.test.js)** - API contract stability (response formats, status codes)
- **[api-node-creation.test.js](tests/api-node-creation.test.js)** - POST /api/node endpoint with group inheritance
- **[api-edge-creation.test.js](tests/api-edge-creation.test.js)** - POST /api/edge endpoint with validation
- **[api-label-updates.test.js](tests/api-label-updates.test.js)** - Node/edge label updates via API
- **[api-group-operations.test.js](tests/api-group-operations.test.js)** - Group creation, ungrouping, expansion

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
- **[groupHelpers.test.js](tests/groupHelpers/groupHelpers.test.js)** - Group utilities (descendants, validation, visibility, state transitions)
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
