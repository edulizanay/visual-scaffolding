# SOP: Writing Tests with Vitest

This guide explains how to write tests for Visual Scaffolding using Vitest.

## Overview

The project uses Vitest 3.2.4 with a multi-project configuration that isolates different test environments:
- **backend** - Node environment for API and backend logic
- **frontend-api** - Node environment for frontend utilities without DOM
- **frontend-ui** - happy-dom environment for React components
- **security** - Node environment for security tests

## Test File Structure

### File Naming
- Unit tests: `<filename>.test.js` or `<filename>.test.jsx`
- Integration tests: Place in `tests/integration/`
- API tests: `tests/api-<feature>.test.js`
- Security tests: `tests/security/`

### ABOUTME Comments
**Every test file MUST start with two ABOUTME comments:**

```javascript
// ABOUTME: This file tests the conversation service CRUD operations
// ABOUTME: Covers creating, reading, updating conversations and message history
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
```

## Test Setup Pattern

### Backend/Integration Tests

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDb, closeDb } from '../server/db.js';

describe('Feature Name', () => {
  beforeEach(async () => {
    // Use in-memory database for isolation
    process.env.DB_PATH = ':memory:';
    await initDb();
  });

  afterEach(async () => {
    // Always clean up
    await closeDb();
  });

  it('should do something', async () => {
    // Test implementation
  });
});
```

### Frontend Component Tests

```javascript
// ABOUTME: Tests for the ChatInterface component
// ABOUTME: Covers message sending, textarea auto-sizing, and keyboard shortcuts
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '../../src/ChatInterface.jsx';

describe('ChatInterface Component', () => {
  beforeEach(() => {
    // Setup runs before each test
  });

  it('should render the component', () => {
    render(<ChatInterface onSendMessage={() => {}} />);
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });
});
```

## Writing Different Types of Tests

### 1. Backend Unit Tests

Test individual functions and services in `tests/` directory:

```javascript
import { saveFlow, getFlow } from '../server/db.js';

it('should save and retrieve flow', async () => {
  const flow = { nodes: [], edges: [] };
  await saveFlow('default', 'main', flow);
  expect(await getFlow('default', 'main')).toEqual(flow);
});
```

### 2. API Integration Tests

Test HTTP endpoints using Supertest in `tests/api-*.test.js`:

```javascript
import request from 'supertest';
import app from '../server/server.js';

it('should create a new node', async () => {
  const response = await request(app)
    .post('/api/node')
    .send({ label: 'Test Node' })
    .expect(201);

  expect(response.body).toHaveProperty('id');
});
```

### 3. Frontend Component Tests

Test React components with React Testing Library in `src/**/__tests__/`:

```javascript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Node from '../../src/Node.jsx';

it('should allow editing label on double-click', async () => {
  const user = userEvent.setup();
  const onUpdate = vi.fn();
  render(<Node data={{ label: 'Test' }} id="node-1" onUpdateNode={onUpdate} />);

  await user.dblClick(screen.getByText('Test'));
  await user.type(screen.getByRole('textbox'), 'New{Enter}');

  expect(onUpdate).toHaveBeenCalled();
});
```

### 4. Testing Layout Algorithms

Test layout calculations with specific node/edge structures (see [tests/unit/frontend/getLayoutedElements.test.js](../../tests/unit/frontend/getLayoutedElements.test.js)):

```javascript
import { getLayoutedElements } from '../../src/hooks/useFlowLayout.js';

const makeNode = (id, overrides = {}) => ({
  id, type: 'default', position: { x: 0, y: 0 },
  data: { label: id, ...overrides?.data }, ...overrides
});
const makeEdge = (source, target) => ({ id: `${source}-${target}`, source, target });

it('should maintain horizontal parent-child alignment', () => {
  const nodes = [makeNode('parent'), makeNode('child')];
  const edges = [makeEdge('parent', 'child')];
  const { nodes: layouted } = getLayoutedElements(nodes, edges, 'LR');

  const parent = layouted.find(n => n.id === 'parent');
  const child = layouted.find(n => n.id === 'child');

  expect(child.position.y).toBeCloseTo(parent.position.y, 5);
  expect(child.position.x).toBeGreaterThan(parent.position.x);
});
```

**TDD Approach:** Write failing test → Implement fix → Refactor

## Running Tests

```bash
# Run all tests
npm test

# Watch mode (re-run on file changes)
npm run test:watch

# Coverage report
npm run test:coverage

# Run specific test file
npx vitest run tests/db.test.js

# Run tests matching pattern
npx vitest run --grep "should create node"

# UI mode for debugging
npm run test:ui
```

## Common Patterns

### Testing Tool Execution
```javascript
import { executeTool } from '../server/tools/executor.js';

it('should add node via tool execution', async () => {
  const result = await executeTool('addNode', { label: 'Test Node' });
  expect(result.success).toBe(true);
  expect(result.nodeId).toBeDefined();
});
```

### Testing Error Handling
```javascript
it('should return 400 for invalid node data', async () => {
  const response = await request(app)
    .post('/api/node')
    .send({}) // missing required label
    .expect(400);

  expect(response.body.error).toBeDefined();
});
```

## Debugging Tests

### 1. Use Console Logs (Temporarily)
```javascript
it('should debug test', () => {
  const result = someFunction();
  console.log('Debug result:', result); // Remove after debugging
  expect(result).toBeDefined();
});
```

### 2. Use Vitest UI
```bash
npm run test:ui
```
Opens a browser interface for interactive test debugging.

### 3. Run Single Test
```javascript
it.only('should debug this specific test', () => {
  // Only this test will run
});
```

### 4. Skip Tests Temporarily
```javascript
it.skip('should test something later', () => {
  // This test will be skipped
});
```


## Best Practices

1. **Always use in-memory database** for isolation
2. **Clean up after each test** (closeDb, clearAllMocks)
3. **Write ABOUTME comments** at the top of every test file
4. **Test behavior, not implementation** - Focus on what the code does, not how
5. **Keep tests fast** - Use mocks for external APIs and slow operations
6. **Test edge cases** - Empty inputs, null values, boundary conditions
7. **Use descriptive test names** - Someone should understand what's being tested without reading the code
8. **One assertion focus per test** - Tests should be focused and easy to debug

## Troubleshooting

### Tests Timing Out
```javascript
// Increase timeout for slow tests
it('should handle slow operation', async () => {
  // Test code
}, 10000); // 10 second timeout
```

### Module Import Errors
Ensure you're using `.js` extensions in imports:
```javascript
import { someFunction } from '../server/module.js'; // Good
import { someFunction } from '../server/module';    // May fail
```

### React Component Not Rendering
Check that setup file is configured in vitest.config.js:
```javascript
setupFiles: ['./tests/setup-frontend.js']
```

## Coverage Goals

Aim for:
- **Overall**: >85% coverage
- **Critical paths**: 100% coverage (database operations, tool execution, API endpoints)
- **UI components**: >80% coverage

Check coverage:
```bash
npm run test:coverage
open coverage/index.html
```

## See Also

- [test_suite.md](../system/test_suite.md) - Complete test suite documentation
- [project_architecture.md](../system/project_architecture.md) - Testing strategy overview
- [Vitest Documentation](https://vitest.dev/) - Official Vitest docs
- [Testing Library Docs](https://testing-library.com/) - React Testing Library guides

