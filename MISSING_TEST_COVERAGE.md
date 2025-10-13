# Missing Test Coverage Analysis

**Generated**: 2025-10-13
**Purpose**: Comprehensive audit of missing test cases across the codebase

---

## Executive Summary

The Visual Scaffolding project has **317+ tests across 13 test suites** with good coverage in core areas like:
- ✅ API contracts and integration
- ✅ Group operations and validation
- ✅ Tool execution and LLM parsing
- ✅ Undo/redo functionality
- ✅ XSS prevention
- ✅ Frontend API client

However, significant gaps exist in:
- ❌ React component testing (especially App.jsx)
- ❌ Layout algorithm edge cases
- ❌ Server-side error handling
- ❌ Database edge cases
- ❌ Frontend utilities
- ❌ Complex user interaction flows
- ❌ Performance and stress testing

---

## 1. Frontend Component Tests (High Priority)

### 1.1 App.jsx - Main Canvas Component
**Current Coverage**: Partial (keyboard shortcuts only)
**Missing Coverage**: ~85% of component logic

**Missing Tests**:
1. Initial flow loading on mount
2. Autosave debounce behavior (500ms)
3. Group halo rendering with nested groups
4. Selection state management (multi-select, deselect)
5. Node double-click handlers (group toggle vs child creation)
6. Node click handlers (Alt+Click subtree collapse vs Cmd+Click selection)
7. Edge creation via onConnect
8. History status polling (interval every 1000ms)
9. Toast notification display and auto-hide (2500ms)
10. Backend processing flag coordination
11. Group member count display on collapsed groups
12. Node styling for selected/collapsed states
13. Tooltip rendering (group/ungroup hints)
14. Integration with useFlowLayout hook
15. Error handling for failed API calls
16. Empty flow state handling
17. Integration with applyGroupVisibility
18. ReactFlow initialization and fitView

**Files Needed**: `tests/unit/frontend/App.test.jsx`

---

### 1.2 ChatInterface.jsx - AI Chat Component
**Current Coverage**: Partial (basic rendering)
**Missing Coverage**: ~70% of interaction logic

**Missing Tests**:
1. Message submission with Cmd+Enter
2. Submission lock preventing double-submit
3. First message /resume handling
4. Conversation history clear on first message
5. Arrow key navigation through message history
6. Draft message preservation when navigating history
7. Textarea auto-resize (38px-76px range)
8. Processing state and animated placeholder
9. Global keydown listener for auto-focus
10. Error handling for failed message sends
11. Flow update handling from LLM responses
12. Integration with conversation history loading
13. Submission lock race condition handling
14. Empty message prevention

**Files Needed**: `tests/unit/frontend/ChatInterface.test.jsx` (expand existing)

---

### 1.3 useFlowLayout Hook - Layout Calculations
**Current Coverage**: Basic layout algorithm only
**Missing Coverage**: ~60% of edge cases

**Missing Tests**:
1. Animation timing and cubic ease-out curve
2. Animation cleanup on unmount
3. Animation interruption (new layout during animation)
4. getAllDescendants recursive traversal edge cases
5. buildGroupDepthMap with circular references
6. buildGroupDepthMap with orphaned nodes
7. compressGroupMembers with zero gap
8. compressGroupMembers with single-node groups
9. Hidden/grouped node filtering in layout
10. Synthetic edge handling in dagre
11. fitView timing and padding application
12. Empty nodes/edges array handling
13. Concurrent layout requests
14. Layout with all nodes hidden

**Files Needed**: `tests/unit/frontend/useFlowLayout.test.js`

---

## 2. Backend Server Tests (High Priority)

### 2.1 server.js - Express API Endpoints
**Current Coverage**: Integration tests only
**Missing Coverage**: ~50% of error paths

**Missing Tests**:
1. Flow validation errors (malformed data)
2. Concurrent flow save handling
3. LLM API key missing scenarios
4. LLM iteration limit (MAX_ITERATIONS = 3)
5. Tool call retry message formatting
6. Parse error response handling
7. Empty tool call array handling
8. Conversation history limit enforcement (6 interactions)
9. Server startup and port binding
10. CORS configuration validation
11. Request body size limits
12. Invalid JSON request bodies
13. Missing required fields in requests
14. Endpoint rate limiting (if implemented)
15. Graceful shutdown handling

**Files Needed**: `tests/integration/server-endpoints.test.js`

---

### 2.2 db.js - Database Layer
**Current Coverage**: Basic CRUD only
**Missing Coverage**: ~40% of edge cases

**Missing Tests**:
1. Migration rollback scenarios
2. Database corruption recovery
3. Concurrent write conflicts
4. Schema validation failures
5. Foreign key constraint violations
6. Database file permissions errors
7. Disk space exhaustion
8. Transaction rollback on errors
9. Large dataset performance (1000+ nodes)
10. SQL injection prevention (though parameterized)
11. Database backup/restore
12. Migration order enforcement

**Files Needed**: `tests/unit/backend/db-edge-cases.test.js`

---

### 2.3 tools/executor.js - Tool Execution
**Current Coverage**: Good, but missing error scenarios
**Missing Coverage**: ~30%

**Missing Tests**:
1. Tool execution timeout handling
2. Partial success in batch operations
3. State consistency after failed tool
4. Unknown tool name handling
5. Tool parameter validation edge cases
6. Circular edge creation attempts
7. Self-referencing node operations
8. Concurrent tool execution
9. Memory leak detection in long-running operations
10. Tool execution metrics/logging

**Files Needed**: `tests/unit/backend/tool-executor-errors.test.js`

---

## 3. Frontend Utilities (Medium Priority)

### 3.1 groupUtils.js - Group Management
**Current Coverage**: Good for core functions
**Missing Coverage**: ~25%

**Missing Tests**:
1. Synthetic edge deduplication
2. Multiple collapsed groups at different nesting levels
3. Edge cases in normalizeHaloPaddingConfig (invalid configs)
4. computeHaloPaddingForDepth with extreme values
5. GroupHaloOverlay interaction edge cases
6. Group visibility with mixed hidden/visible states
7. Halo rendering with zero-size groups
8. Performance with deeply nested groups (10+ levels)
9. Infinite loop prevention in circular hierarchies

**Files Needed**: `tests/unit/frontend/groupUtils-edge-cases.test.js`

---

### 3.2 api.js - Frontend API Client
**Current Coverage**: Excellent (100%)
**Missing Coverage**: None identified ✅

---

## 4. Integration Tests (Medium Priority)

### 4.1 End-to-End User Workflows
**Current Coverage**: None
**Missing Coverage**: 100%

**Missing Tests**:
1. Complete flow: Create nodes → Group → Collapse → Undo
2. AI workflow: Send message → Tool execution → Flow update → Layout
3. Multi-user simulation (if applicable)
4. Browser refresh data persistence
5. Keyboard shortcut combinations
6. Drag-and-drop node positioning
7. Inline editing (node labels, descriptions, edge labels)
8. Error recovery: LLM failure → Retry → Success
9. History navigation: Multiple undo → Redo → Continue editing

**Files Needed**: `tests/e2e/user-workflows.test.js`

---

### 4.2 Performance and Stress Tests
**Current Coverage**: None
**Missing Coverage**: 100%

**Missing Tests**:
1. Large flow performance (1000+ nodes)
2. Rapid autosave triggering
3. Memory leak detection
4. Layout calculation performance
5. Concurrent API request handling
6. Database query optimization validation
7. Frontend rendering performance (React profiling)
8. Websocket/streaming performance (if implemented)

**Files Needed**: `tests/performance/stress-tests.test.js`

---

## 5. Edge Case Tests (Low-Medium Priority)

### 5.1 Data Consistency
**Missing Tests**:
1. Orphaned edges after node deletion
2. Invalid parentGroupId references
3. Duplicate node IDs
4. Edge with same source and target
5. Group containing itself
6. Circular group hierarchies
7. Node positions outside canvas bounds
8. Negative node dimensions
9. Invalid React Flow node types

**Files Needed**: `tests/integration/data-consistency.test.js`

---

### 5.2 LLM Service Edge Cases
**Current Coverage**: Good for parsing
**Missing Coverage**: ~40%

**Missing Tests**:
1. LLM response timeout handling
2. Partial XML parsing (incomplete tags)
3. Extremely large responses (>10MB)
4. Unicode and emoji handling in tool calls
5. Malformed JSON in tool parameters
6. Context window overflow (>100k tokens)
7. Groq API rate limiting
8. Cerebras failover scenarios (detailed)
9. LLM response streaming interruption
10. Token count validation

**Files Needed**: `tests/llm/llmService-edge-cases.test.js`

---

### 5.3 Theme and Styling
**Current Coverage**: None
**Missing Coverage**: 100%

**Missing Tests**:
1. THEME object structure validation
2. Design token consistency
3. CSS variable application
4. Dark mode compatibility
5. Invalid theme values handling
6. Theme token override behavior

**Files Needed**: `tests/unit/frontend/theme.test.js`

---

## 6. Security Tests (Good Coverage, Minor Gaps)

### 6.1 XSS Prevention
**Current Coverage**: Good
**Missing Coverage**: ~10%

**Additional Tests**:
1. SVG-based XSS attacks
2. CSS injection via inline styles
3. Event handler injection
4. Data URI schemes in labels

**Files Needed**: Extend `tests/security/xss-prevention.test.js`

---

### 6.2 Input Validation
**Current Coverage**: Partial
**Missing Coverage**: ~50%

**Missing Tests**:
1. SQL injection attempts in conversation messages
2. Path traversal in API endpoints
3. Prototype pollution via JSON payloads
4. Command injection in LLM prompts
5. CORS bypass attempts
6. CSRF token validation (if implemented)

**Files Needed**: `tests/security/input-validation.test.js`

---

## 7. Accessibility Tests (Not Implemented)

### 7.1 WCAG Compliance
**Current Coverage**: None
**Missing Coverage**: 100%

**Missing Tests**:
1. Keyboard navigation without mouse
2. Screen reader compatibility
3. Focus management
4. ARIA labels and roles
5. Color contrast ratios
6. Text resizing (200%)
7. Focus indicators

**Files Needed**: `tests/accessibility/wcag.test.js`

---

## 8. Regression Tests (Risk Areas)

### 8.1 Known Bug Patterns
**Missing Tests**:
1. Ungroup operation with nested groups (recent fix)
2. Depth-based padding with extreme nesting
3. Synthetic edge generation with mixed visibility
4. Autosave race conditions (covered partially)
5. History snapshot deduplication

**Files Needed**: `tests/regression/known-bugs.test.js`

---

## 9. Documentation Tests

### 9.1 Code Examples
**Current Coverage**: None
**Missing Coverage**: 100%

**Missing Tests**:
1. README examples run without errors
2. API documentation accuracy
3. JSDoc comment accuracy
4. Tutorial completeness

**Files Needed**: `tests/documentation/examples.test.js`

---

## Priority Matrix

| Category | Priority | Estimated Tests | Impact |
|----------|----------|-----------------|--------|
| App.jsx component | **High** | 18 | Critical user flows |
| useFlowLayout hook | **High** | 14 | Layout stability |
| Server endpoints | **High** | 15 | API reliability |
| ChatInterface | **Medium** | 14 | UX quality |
| groupUtils edge cases | **Medium** | 9 | Feature robustness |
| E2E workflows | **Medium** | 9 | User experience |
| Database edge cases | **Medium** | 12 | Data integrity |
| Performance tests | **Low** | 8 | Scalability |
| Security (additional) | **Medium** | 10 | Security posture |
| Accessibility | **Low** | 7 | Compliance |

---

## Total Missing Tests: ~150+

**Current Coverage**: ~317 tests
**Recommended Total**: ~470+ tests
**Gap**: ~150 tests (32% increase)

---

## Next Steps

1. **Immediate (Sprint 1)**: App.jsx, useFlowLayout, Server endpoints
2. **Short-term (Sprint 2)**: ChatInterface, groupUtils edge cases, E2E workflows
3. **Medium-term (Sprint 3)**: Database edge cases, LLM edge cases, Security
4. **Long-term (Sprint 4+)**: Performance, Accessibility, Documentation

---

## Test Quality Guidelines

When writing the missing tests:
1. **Use TDD**: Write failing test first
2. **Test behavior, not implementation**: Focus on what, not how
3. **Avoid mocking what you test**: Only mock external dependencies
4. **Test edge cases**: Empty arrays, null values, extreme inputs
5. **Test error paths**: Don't just test happy paths
6. **Make tests independent**: No shared state between tests
7. **Use descriptive names**: Test names should document behavior
8. **Keep tests fast**: Unit tests <100ms, integration tests <1s

---

## Conclusion

The project has a strong foundation of tests covering core functionality, but lacks coverage in:
- Complex UI interactions (App.jsx)
- Layout algorithm edge cases
- Error handling paths
- End-to-end user workflows
- Performance characteristics

Addressing these gaps will significantly improve confidence in refactoring, catch regressions earlier, and ensure production stability.
