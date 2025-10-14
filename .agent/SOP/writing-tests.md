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

Test individual functions and services:

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { initDb, closeDb, getDb } from '../server/db.js';
import { saveFlow, getFlow } from '../server/db.js';

describe('Database Operations', () => {
  beforeEach(async () => {
    process.env.DB_PATH = ':memory:';
    await initDb();
  });

  afterEach(async () => {
    await closeDb();
  });

  it('should save and retrieve flow', async () => {
    const flow = { nodes: [], edges: [] };
    await saveFlow('default', 'main', flow);

    const retrieved = await getFlow('default', 'main');
    expect(retrieved).toEqual(flow);
  });
});
```

### 2. API Integration Tests

Test full HTTP request/response cycle using Supertest:

```javascript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../server/server.js';
import { initDb, closeDb } from '../server/db.js';

describe('POST /api/node', () => {
  beforeEach(async () => {
    process.env.DB_PATH = ':memory:';
    await initDb();
  });

  afterEach(async () => {
    await closeDb();
  });

  it('should create a new node', async () => {
    const response = await request(app)
      .post('/api/node')
      .send({ label: 'Test Node' })
      .expect(201);

    expect(response.body).toHaveProperty('id');
    expect(response.body.label).toBe('Test Node');
  });
});
```

### 3. Frontend Component Tests

Test React components with React Testing Library:

```javascript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Node from '../../src/Node.jsx';

describe('Node Component', () => {
  it('should allow editing label on double-click', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(
      <Node
        data={{ label: 'Test' }}
        id="node-1"
        onUpdateNode={onUpdate}
      />
    );

    // Double-click to enter edit mode
    await user.dblClick(screen.getByText('Test'));

    // Type new label
    const input = screen.getByRole('textbox');
    await user.clear(input);
    await user.type(input, 'New Label');
    await user.keyboard('{Enter}');

    expect(onUpdate).toHaveBeenCalledWith('node-1', { label: 'New Label' });
  });
});
```

### 4. Mocking in Vitest

Use `vi.fn()` for mock functions and `vi.mock()` for module mocks:

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('LLM Service', () => {
  beforeEach(() => {
    // Mock external API calls
    vi.mock('../server/llm/llmService.js', () => ({
      callLLM: vi.fn().mockResolvedValue({
        response: '<response>[{"tool": "addNode", "params": {"label": "Test"}}]</response>'
      })
    }));
  });

  it('should parse LLM response', async () => {
    const { callLLM } = await import('../server/llm/llmService.js');
    const result = await callLLM('Create a test node');

    expect(result.response).toContain('addNode');
  });
});
```

### 5. Testing Async Operations

Always use `async/await` for asynchronous tests:

```javascript
it('should handle async operation', async () => {
  const result = await someAsyncFunction();
  expect(result).toBeDefined();
});

// Use waitFor for eventual assertions
it('should update UI after async operation', async () => {
  render(<Component />);

  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
});
```

## Test Conventions

### 1. Use In-Memory Database
```javascript
beforeEach(async () => {
  process.env.DB_PATH = ':memory:';
  await initDb();
});
```

### 2. Clean Up After Tests
```javascript
afterEach(async () => {
  await closeDb();
  vi.clearAllMocks(); // Clear mocks if used
});
```

### 3. Descriptive Test Names
Use `should` pattern for clarity:
```javascript
it('should create a node with parent connection', async () => {
  // Test implementation
});
```

### 4. Arrange-Act-Assert Pattern
```javascript
it('should calculate total correctly', () => {
  // Arrange - Set up test data
  const items = [1, 2, 3];

  // Act - Perform the action
  const result = calculateTotal(items);

  // Assert - Verify the result
  expect(result).toBe(6);
});
```

### 5. Test One Thing Per Test
```javascript
// Good - Tests one specific behavior
it('should return null when user not found', () => {
  const user = findUser('nonexistent');
  expect(user).toBeNull();
});

// Bad - Tests multiple unrelated things
it('should handle user operations', () => {
  const user = createUser('test');
  expect(user).toBeDefined();
  const deleted = deleteUser('test');
  expect(deleted).toBe(true);
  // Too much in one test!
});
```

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
  const result = await executeTool('addNode', {
    label: 'Test Node',
    description: 'Test description'
  });

  expect(result.success).toBe(true);
  expect(result.nodeId).toBeDefined();
});
```

### Testing Group Operations
```javascript
it('should create group from selected nodes', async () => {
  // Create nodes first
  const node1 = await createNode({ label: 'Node 1' });
  const node2 = await createNode({ label: 'Node 2' });

  // Create group
  const response = await request(app)
    .post('/api/group')
    .send({
      label: 'Test Group',
      nodeIds: [node1.id, node2.id]
    })
    .expect(201);

  expect(response.body.groupId).toBeDefined();
});
```

### Testing Error Handling
```javascript
it('should return 400 for invalid node data', async () => {
  const response = await request(app)
    .post('/api/node')
    .send({ /* missing required label */ })
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

## Migration from Jest

If converting an old Jest test:

### Before (Jest)
```javascript
jest.fn()
jest.mock()
jest.clearAllMocks()
```

### After (Vitest)
```javascript
vi.fn()
vi.mock()
vi.clearAllMocks()
```

**Note**: Most Jest APIs work identically in Vitest due to globals being enabled.

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
