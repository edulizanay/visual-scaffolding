# Test Suite Analysis & Recommendations

**Last Updated:** October 2025
**Total Test Files:** 20
**Overall Assessment:** Strong backend coverage, zero frontend coverage

---

## Executive Summary

### Strengths 🟢
- **Backend layer is excellent**: Database, services, tool execution, group system, and API endpoints all have comprehensive test coverage
- **LLM integration is well-tested**: Context building, parsing (including edge cases), and tool execution are thoroughly covered
- **Visual settings backend is complete**: E2E execution tests and merge logic tests cover the full backend flow
- **Good test quality**: Consistent patterns, helpful ABOUTME headers, proper cleanup, fast execution (in-memory DB)

### Critical Gaps 🔴
- **Zero frontend component tests**: No tests for App.jsx, Node.jsx, Edge.jsx, or ChatInterface.jsx
- **Zero hook tests**: useFlowLayout (dagre layout + collapse logic) is completely untested
- **Zero API client tests**: src/api.js frontend helpers have no coverage
- **Incomplete integration tests**: POST /api/conversation/message retry loop not tested end-to-end

### Issues ⚠️
- **visual-settings-llm.test.js is misleading**: Documents expected behaviors but doesn't actually test parsing
- **Tests could be better organized**: Flat structure makes it hard to navigate as suite grows

---

## Current Test Inventory (20 Files)

### Unit Tests - Backend (10 files)

#### Core Infrastructure
- ✅ **`tests/db.test.js`** (442 lines) - **Excellent**
  - Schema creation, table verification, indexes
  - Flow CRUD (nodes, edges, type fields, parentGroupId, isCollapsed)
  - Visual settings persistence & merging
  - Conversation history CRUD & limiting
  - Undo/redo snapshots (push, limit to 50, deduplication, truncation)
  - Nested groups, mixed old/new nodes

- ✅ **`tests/conversationService.test.js`** (139 lines) - **Good**
  - addUserMessage, addAssistantMessage with timestamps
  - getHistory with limiting (N interactions = 2N messages)
  - clearHistory
  - Proper SQLite timestamp format validation

- ✅ **`tests/historyService.test.js`** (247 lines) - **Good**
  - pushSnapshot, undo, redo, canUndo, canRedo
  - Truncation after undo (redo chain removal)
  - Snapshot limit enforcement (50 max)
  - clearHistory, initializeHistory

#### Tool Execution
- ✅ **`tests/toolExecution.test.js`** (290 lines) - **Excellent**
  - All 13 tools: addNode, updateNode, deleteNode, addEdge, updateEdge, deleteEdge, createGroup, ungroup, toggleGroupExpansion, undo, redo, changeVisuals, changeDimensions
  - Batch execution (sequential, continue on failure)
  - Edge creation with labels
  - Auto-generated labels for nodes
  - Error handling (node not found, edge source/target missing)

- ✅ **`tests/toolExecution-ids.test.js`** (65 lines) - **Good**
  - Custom ID collision detection
  - Sanitized label collision (e.g., "Test Node" and "Test@Node" both → "test_node")
  - Special character sanitization (alphanumeric + underscore only)

#### Group System
- ✅ **`tests/groupHelpers.test.js`** (371 lines) - **Excellent**
  - getGroupDescendants (direct children, nested recursion, circular reference guard)
  - getExpandedGroupHalos (bounding box calculation with padding, nested descendants)
  - detectCircularReference (direct & indirect)
  - validateGroupMembership (duplicates, ancestor/descendant prevention)
  - applyGroupVisibility (hiding members, preserving other hidden states, nested groups)
  - createGroup, toggleGroupExpansion, ungroup lifecycle
  - collapseSubtreeByHandles (subtree collapse system)

#### LLM Integration
- ✅ **`tests/llm/llmService.test.js`** (247 lines) - **Good**
  - buildLLMContext (system prompt, user message, flow state, conversation history, tool definitions)
  - History limiting (last 6 interactions = 12 messages)
  - Flow state inclusion without duplication in history
  - parseToolCalls (thinking/response extraction, single/multiple tool calls, malformed JSON, missing tags, single object vs array)

- ✅ **`tests/llm/llmParsing-edgecases.test.js`** (295 lines) - **Great**
  - Multiple thinking tags (uses first)
  - JSON comments (single-line //, inline)
  - Trailing commas (documents failure - standard JSON.parse doesn't support)
  - Large arrays (50 calls <100ms, 100 calls <200ms, deeply nested objects)

#### Visual Settings
- ⚠️ **`tests/visual-settings-llm.test.js`** (356 lines) - **Misleading**
  - **Problem**: Only tests tool definition schemas, doesn't actually call parseToolCalls or execute tools
  - Tests are documentation disguised as assertions (e.g., `expect(expectedToolCall.name).toBe('changeVisuals')` - circular!)
  - **Recommendation**: Either remove (redundant with visual-settings-e2e.test.js) OR rewrite to test actual parsing:
    ```javascript
    it('should parse "change background to blue"', () => {
      const llmResponse = '<thinking>Blue bg</thinking><response>[{"type":"tool_use","id":"t1","name":"changeVisuals","input":{"target":"background","color":"blue"}}]</response>';
      const result = parseToolCalls(llmResponse);
      expect(result.toolCalls[0].params.color).toBe('blue');
    });
    ```

- ✅ **`tests/visual-settings-rendering.test.js`** (481 lines) - **Excellent**
  - mergeWithDefaultVisualSettings (background, allNodes colors, perNode overrides, dimensions, dagre spacing)
  - Deep merge without mutation
  - Simulated style application to nodes (applyVisualSettingsToNode helper)
  - Per-node overrides vs global settings priority

### Integration Tests - Backend (8 files)

- ✅ **`tests/api-contracts.test.js`** (299 lines) - **Good**
  - GET /api/flow (schema validation, empty flow, existing flow)
  - POST /api/flow (validation, persistence, skipSnapshot parameter)
  - POST /api/conversation/message (validation, response structure)
  - Undo/redo endpoints (POST /api/flow/undo, /redo, GET /api/flow/history-status)
  - Conversation endpoints (GET /api/conversation/debug, DELETE /api/conversation/history)
  - Error handling (404, 500)
  - CORS headers
  - ⚠️ **Issue**: Will hit real Groq/Cerebras APIs if keys are present - flaky/slow

- ✅ **`tests/api-node-creation.test.js`** (112 lines) - **Good**
  - POST /api/node with parent connection
  - Group membership inheritance (child inherits parent's parentGroupId)
  - Auto-generated labels
  - Validation (parent must exist)

- ✅ **`tests/api-edge-creation.test.js`** (202 lines) - **Good**
  - POST /api/edge (with/without label)
  - PUT /api/edge/:id (label updates)
  - DELETE /api/edge/:id
  - Validation (source/target required, must exist)

- ✅ **`tests/api-label-updates.test.js`** (294 lines) - **Good**
  - PUT /api/node/:id (label, description, position, both label+description)
  - PUT /api/edge/:id (label updates)
  - Empty labels/descriptions
  - Very long labels (1000 chars)
  - Special characters, HTML-like content
  - skipSnapshot verification

- ✅ **`tests/api-group-operations.test.js`** (298 lines) - **Excellent**
  - POST /api/group (multiple nodes, auto-generated labels, synthetic edge generation)
  - DELETE /api/group/:id (ungroup, restore members)
  - PUT /api/group/:id/expand (expand/collapse)
  - Validation (min 2 members, no overlapping groups, group must exist)

- ⚠️ **`tests/integration/message-retry.test.js`** (128 lines) - **Incomplete**
  - **Problem**: Only tests tool execution directly, never calls POST /api/conversation/message
  - Imports supertest but doesn't use it
  - **Missing**: Full retry loop, mocked LLM responses, buildRetryMessage verification
  - Tests mixed success/failure batches, flow state consistency

- ✅ **`tests/undo-redo-autosave.test.js`** (97 lines) - **Good**
  - Verifies redo chain preserved during autosave
  - Position-only changes don't truncate redo

- ✅ **`tests/schema-migration.test.js`** (176 lines) - **Good**
  - Backward compatibility for old flows (without type/parentGroupId)
  - Mixed old/new nodes in same flow

### E2E Tests (1 file)

- ✅ **`tests/visual-settings-e2e.test.js`** (580 lines) - **Excellent**
  - Background colors (hex, gradient, named, rgba, invalid color rejection)
  - All nodes colors (background, border, text, default property)
  - Per-node color overrides (multiple nodes, validation)
  - Node dimensions (width, height, both axes, constraints 60-600 width, 24-320 height)
  - Layout spacing (horizontal, vertical, both, constraints 10-400)
  - Batch operations (multiple visual changes)
  - Persistence (settings survive operations, overrides preserved)
  - ⚠️ **Naming issue**: Called "E2E" but doesn't use HTTP or UI, just calls executor directly

### Security Tests (1 file)

- ✅ **`tests/security/xss-prevention.test.js`** (84 lines) - **Good**
  - Verifies malicious input stored as-is (backend doesn't sanitize)
  - Tests script tags, onclick attributes, img tags with onerror
  - **Documents**: Frontend MUST escape on render
  - ❌ **Missing**: Tests verifying frontend actually escapes

---

## Critical Coverage Gaps

### 1. Zero Frontend Component Tests 🔴

**Missing Files:**
- ❌ `tests/unit/frontend/App.test.jsx`
- ❌ `tests/unit/frontend/Node.test.jsx`
- ❌ `tests/unit/frontend/Edge.test.jsx`
- ❌ `tests/unit/frontend/ChatInterface.test.jsx`

**What's Not Tested:**

#### src/App.jsx
- ❌ Flow loading on mount
- ❌ Keyboard shortcuts (⌘Z, ⌘Y, ⌘G, ⌘⇧G, Alt+Click)
- ❌ Double-click handlers (create child node, toggle group expansion)
- ❌ Autosave debouncing (500ms)
- ❌ Toast notifications (group operations, errors)
- ❌ applyGroupVisibility called on load
- ❌ Visual settings applied to nodes
- ❌ Multi-select state management

#### src/ChatInterface.jsx
- ❌ Message sending on Enter key
- ❌ Loading spinner during processing
- ❌ Iteration count display (when > 1)
- ❌ Error handling and display
- ❌ Input clearing after send

#### src/Node.jsx
- ❌ Label and description rendering
- ❌ Inline editing (contentEditable)
- ❌ Collapse indicator display (when data.collapsed = true)
- ❌ Custom styles from visualSettings

#### src/Edge.jsx
- ❌ Edge label rendering
- ❌ Inline label editing

**Impact:** **CRITICAL** - These are primary user-facing components. Zero automated verification of UI behavior.

**Recommended Setup:**
```bash
npm install --save-dev @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Update `jest.config.js`:
```javascript
testEnvironment: 'jsdom', // Change from 'node'
```

**Example Test:**
```javascript
// tests/unit/frontend/App.test.jsx
import { render, screen, fireEvent } from '@testing-library/react';
import App from '../../../src/App';

vi.mock('@xyflow/react', () => ({
  ReactFlow: () => <div data-testid="react-flow" />,
  useNodesState: () => [[], vi.fn(), vi.fn()],
  useEdgesState: () => [[], vi.fn(), vi.fn()],
  // ... other mocks
}));

test('loads flow on mount', async () => {
  global.fetch = vi.fn(() => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ nodes: [], edges: [], settings: {} })
  }));

  render(<App />);

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith('http://localhost:3001/api/flow');
  });
});

test('handles Cmd+Z keyboard shortcut', () => {
  render(<App />);
  fireEvent.keyDown(document, { key: 'z', metaKey: true });
  // Assert undo API called
});
```

---

### 2. Zero Hook Tests 🔴

**Missing:**
- ❌ `tests/unit/frontend/useFlowLayout.test.js`

**What's Not Tested in useFlowLayout:**
- ❌ Dagre layout calculations (node positioning)
- ❌ collapseSubtreeByHandles (hide descendants via edges)
- ❌ expandSubtreeByHandles (show descendants)
- ❌ Animation triggering
- ❌ Edge direction handling
- ❌ Layout options (dagre horizontal/vertical spacing)

**Impact:** **HIGH** - Critical auto-layout logic has no tests.

**Recommended Approach:**
```javascript
import { renderHook, act } from '@testing-library/react-hooks';
import useFlowLayout from '../../../src/hooks/useFlowLayout';

test('calculates layout with dagre', () => {
  const { result } = renderHook(() => useFlowLayout(mockReactFlowInstance));

  const nodes = [{ id: '1' }, { id: '2' }];
  const edges = [{ source: '1', target: '2' }];

  act(() => {
    result.current.applyLayoutWithAnimation(nodes, edges);
  });

  // Assert nodes have position updates
});
```

---

### 3. Zero API Client Tests 🔴

**Missing:**
- ❌ `tests/unit/frontend/api.test.js`

**What's Not Tested in src/api.js:**
- ❌ API_URL configuration
- ❌ Error handling in API calls
- ❌ Response parsing
- ❌ Helper functions (createGroup, ungroup, toggleGroupExpansion)

**Impact:** **MEDIUM** - Frontend API logic not verified (though backend endpoints are tested).

---

### 4. Incomplete Integration Tests ⚠️

#### POST /api/conversation/message - Missing True E2E Test

**Current state:**
- `tests/integration/message-retry.test.js` only calls `executeToolCalls` directly
- Never uses supertest despite importing it
- Doesn't test the actual HTTP endpoint

**What's Missing:**
- ❌ Full retry loop through POST /api/conversation/message
- ❌ Mocked LLM responses (XML with tool calls)
- ❌ buildRetryMessage verification (error details + available node IDs)
- ❌ 3-iteration limit enforcement
- ❌ Response structure validation (thinking, toolCalls, execution, updatedFlow, iterations)

**Impact:** **HIGH** - Core retry mechanism not tested end-to-end.

**Recommended Test:**
```javascript
// tests/integration/conversation-endpoint.test.js
test('retries failed tool execution', async () => {
  // Mock LLM to return tool call referencing non-existent node
  vi.mock('../../server/llm/llmService.js', () => ({
    callLLM: vi.fn()
      .mockResolvedValueOnce(`<thinking>Create child</thinking><response>[{"type":"tool_use","id":"t1","name":"addNode","input":{"label":"Child","parentNodeId":"nonexistent"}}]</response>`)
      .mockResolvedValueOnce(`<thinking>Retry with correct ID</thinking><response>[{"type":"tool_use","id":"t2","name":"addNode","input":{"label":"Child","parentNodeId":"existing"}}]</response>`)
  }));

  // Create parent node first
  await executeTool('addNode', { id: 'existing', label: 'Parent' });

  // Send message that will fail, then retry
  const response = await request(app)
    .post('/api/conversation/message')
    .send({ message: 'add a child to parent' })
    .expect(200);

  expect(response.body.iterations).toBe(2); // Failed once, succeeded on retry
  expect(response.body.success).toBe(true);
});
```

---

#### GroupHaloOverlay - No Component Tests

**Missing:**
- ❌ Halo rendering tests
- ❌ Double-click handler tests (collapse group)
- ❌ Hover state tests
- ❌ Bounding box calculation integration with getExpandedGroupHalos

**Impact:** **MEDIUM** - Visual component critical for group UX.

---

### 5. Frontend Security - No Rendering Tests 🔴

**Current state:**
- `tests/security/xss-prevention.test.js` verifies backend stores malicious input as-is ✅
- **Missing**: Tests verifying frontend escapes on render

**What's Needed:**
```javascript
// tests/security/xss-rendering.test.jsx
test('Node component escapes malicious labels', () => {
  const node = {
    id: 'test',
    data: { label: '<script>alert("xss")</script>' }
  };

  render(<Node {...node} />);

  // Verify script tag is escaped, not executed
  const label = screen.getByText(/<script>alert\("xss"\)<\/script>/);
  expect(label).toBeInTheDocument();
  expect(label.innerHTML).not.toContain('<script>');
});
```

---

## Proposed Test Structure Reorganization

**Current:** Flat structure with some subfolders
```
tests/
├── *.test.js (many files)
├── integration/
└── llm/
```

**Proposed:** Organized by layer
```
tests/
├── unit/
│   ├── backend/
│   │   ├── db.test.js
│   │   ├── conversationService.test.js
│   │   ├── historyService.test.js
│   │   ├── toolExecution.test.js
│   │   ├── toolExecution-ids.test.js
│   │   ├── groupHelpers.test.js
│   │   └── visualSettings-merge.test.js (renamed from visual-settings-rendering.test.js)
│   ├── llm/
│   │   ├── llmService.test.js
│   │   └── llmParsing-edgecases.test.js
│   └── frontend/           # NEW - All new tests
│       ├── App.test.jsx
│       ├── Node.test.jsx
│       ├── Edge.test.jsx
│       ├── ChatInterface.test.jsx
│       ├── GroupHaloOverlay.test.jsx
│       ├── useFlowLayout.test.js
│       └── api.test.js
├── integration/
│   ├── api-contracts.test.js
│   ├── api-node-creation.test.js
│   ├── api-edge-creation.test.js
│   ├── api-label-updates.test.js
│   ├── api-group-operations.test.js
│   ├── conversation-endpoint.test.js  # NEW - True E2E with mocked LLM
│   ├── undo-redo-autosave.test.js
│   └── schema-migration.test.js
├── e2e/
│   └── visual-settings.test.js (renamed from visual-settings-e2e.test.js)
└── security/
    ├── xss-storage.test.js (renamed from xss-prevention.test.js)
    └── xss-rendering.test.jsx      # NEW
```

**Benefits:**
- Clear separation by test type
- Easier to run specific test categories
- Better organization as suite grows
- Matches industry conventions

---

## Recommended Action Plan (Priority Order)

### **Phase 1: Critical Frontend Coverage** (Highest Priority)

1. **Setup React Testing Infrastructure**
   - Install @testing-library/react, @testing-library/jest-dom, @testing-library/user-event
   - Change jest.config.js testEnvironment to 'jsdom'
   - Create tests/unit/frontend/ folder

2. **Core Component Tests**
   - App.test.jsx - Focus on keyboard shortcuts, double-click, autosave, toast
   - Node.test.jsx - Inline editing, XSS escaping, collapse indicator
   - ChatInterface.test.jsx - Message sending, loading states
   - Edge.test.jsx - Label rendering, inline editing

3. **Hook Tests**
   - useFlowLayout.test.js - Dagre layout, collapse/expand, animations

4. **Frontend Security Tests**
   - xss-rendering.test.jsx - Verify Node/Edge components escape malicious content

**Estimated Effort:** 2-3 days

---

### **Phase 2: Complete Integration Coverage** (High Priority)

5. **True Conversation Endpoint E2E Test**
   - Create tests/integration/conversation-endpoint.test.js
   - Mock LLM responses with XML tool calls
   - Test full 3-iteration retry loop
   - Verify buildRetryMessage format

6. **GroupHaloOverlay Component Tests**
   - Render tests, double-click handlers, hover states

**Estimated Effort:** 1 day

---

### **Phase 3: API Client Coverage** (Medium Priority)

7. **Frontend API Client Tests**
   - tests/unit/frontend/api.test.js
   - Mock fetch responses
   - Test error handling

**Estimated Effort:** 0.5 day

---

### **Phase 4: Cleanup & Organization** (Low Priority)

8. **Fix visual-settings-llm.test.js**
   - Option A: Remove (redundant with visual-settings-e2e.test.js)
   - Option B: Rewrite to test actual parseToolCalls behavior

9. **Reorganize Test Structure**
   - Create unit/backend/, unit/frontend/, integration/, e2e/ folders
   - Move existing tests to appropriate locations
   - Update CI config if needed

10. **Mock LLM in api-contracts.test.js**
    - Prevent hitting real Groq/Cerebras APIs during tests

**Estimated Effort:** 1 day

---

## Coverage Summary

| Layer | Files | Lines | Status | Notes |
|-------|-------|-------|--------|-------|
| **Database** | 1 | 442 | 🟢 Excellent | Comprehensive CRUD, migrations |
| **Services** | 2 | 386 | 🟢 Good | Conversation, history |
| **Tool Execution** | 2 | 355 | 🟢 Excellent | All 13 tools, IDs, batching |
| **Group System** | 1 | 371 | 🟢 Excellent | Helpers, validation, visibility |
| **LLM Integration** | 2 | 542 | 🟡 Good | Parsing covered, E2E missing |
| **API Endpoints** | 5 | 1305 | 🟢 Good | REST CRUD, groups, contracts |
| **Visual Settings** | 3 | 1417 | 🟢 Excellent | Execution, merge, rendering |
| **Security** | 1 | 84 | 🟡 Minimal | Storage only, rendering missing |
| **Integration Tests** | 3 | 525 | 🟡 Good | Missing conversation E2E |
| **Frontend Components** | 0 | 0 | 🔴 **ZERO** | **No React tests** |
| **Frontend Hooks** | 0 | 0 | 🔴 **ZERO** | **No hook tests** |
| **Frontend API Client** | 0 | 0 | 🔴 **ZERO** | **No api.js tests** |

**Total Backend Coverage:** ~5,427 lines across 19 files
**Total Frontend Coverage:** 0 lines across 0 files

---

## Notes

### Test Quality Observations
- ✅ Consistent use of beforeEach/afterEach for setup/cleanup
- ✅ Good ABOUTME headers explaining test purpose
- ✅ Clear test descriptions using "should" convention
- ✅ In-memory SQLite for fast execution
- ✅ Good use of helper functions (executeTool)
- ✅ Performance benchmarks in LLM parsing tests

### Infrastructure
- Jest with NODE_OPTIONS=--experimental-vm-modules for ES modules
- All tests use :memory: database (process.env.DB_PATH = ':memory:')
- Supertest for API testing
- No mocking of external services (could hit real APIs if keys present)

---

**Status:** Backend is production-ready, frontend is untested
**Priority:** Add React component tests, hook tests, and conversation E2E tests
**Effort:** ~4-5 days to achieve good frontend coverage
