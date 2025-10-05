# Implementation Plan: LLM Conversation Backend

## Summary
Build backend-driven conversation management with TDD approach. Backend handles all conversation history, context building, and (eventually) LLM API calls. Frontend is just UI for input/output.

---

## Phase 1: Update Tool Definitions
**Goal:** Add position support to updateNode tool

- [x] Update `src/flowTools.js` - add `position: {x, y}` parameter to updateNode tool schema

---

## Phase 2: Backend Conversation Storage (TDD)
**Goal:** Create conversation persistence layer

### Files to Create:
- [x] `server/conversationService.js` - Service for conversation CRUD operations
- [x] `server/data/conversation.json` - Storage file (created on first use)
- [x] `tests/conversationService.test.js` - Unit tests (14/14 passing)

### Files to Modify:
- [x] `server/server.js` - Added POST /api/conversation/message, GET /api/conversation/debug, DELETE /api/conversation/history
- [x] `src/api.js` - Added sendMessage(), getConversationDebug(), clearConversation()
- [x] `src/ChatInterface.jsx` - Updated to call backend API

### Test Cases:
- [x] All 14 test cases passing
- [x] Frontend → Backend → conversation.json flow working

---

## Phase 3: LLM Service Layer (TDD)
**Goal:** Build complete LLM integration layer with organized structure

### New Folder Structure:
```
server/
  llm/                       # NEW - All LLM-related logic
    prompts.js              # System prompts
    llmService.js           # Context builder + response parser
    tools.js                # Tool definitions (moved from src/)
```

### Files to Create:
- [x] `server/llm/prompts.js` - SYSTEM_PROMPT for instructing LLM
- [x] `server/llm/llmService.js` - buildLLMContext() + parseToolCalls()
- [x] `server/llm/tools.js` - Move tool definitions from src/flowTools.js
- [x] `tests/llm/llmService.test.js` - Unit tests (14/14 passing)

### Files to Modify:
- [x] `server/server.js` - Updated POST /api/conversation/message to use buildLLMContext()

### Files Deleted:
- [x] `src/flowTools.js` - Moved to server/llm/tools.js

### Test Cases:
- [x] All 14 tests passing
- [x] `buildLLMContext()` includes systemPrompt from prompts.js
- [x] `buildLLMContext()` includes fresh flow.json
- [x] `buildLLMContext()` includes conversation history (last 6 interactions)
- [x] `buildLLMContext()` includes tool definitions
- [x] `buildLLMContext()` includes user message
- [x] flow.json appears ONLY in `flowState`, NOT duplicated in history
- [x] `parseToolCalls()` extracts thinking from <thinking> tags
- [x] `parseToolCalls()` extracts tool calls from <response> tags
- [x] `parseToolCalls()` handles multiple tool calls
- [x] `parseToolCalls()` handles malformed responses gracefully

### llmService.js API:
```javascript
- buildLLMContext(userMessage) → {systemPrompt, userMessage, flowState, conversationHistory, availableTools}
- parseToolCalls(llmResponse) → {thinking, content, toolCalls}
```

---

## Phase 4: Tool Execution Layer (TDD)
**Goal:** Execute parsed tool calls against flow.json

### Files Modified:
- [x] `server/server.js` - Added tool execution functions
  - executeTool(toolName, params) - Main dispatcher
  - executeToolCalls(toolCalls) - Batch executor
  - 6 helper functions for each tool operation
- [x] `tests/toolExecution.test.js` - 17 comprehensive tests (17/17 passing)

### Decision Log:
- [x] Keep tool execution in server.js instead of separate toolExecutor.js (avoid over-engineering)
- [x] Changed FLOW_DATA_PATH to getFlowPath() for dynamic resolution (same fix as conversationService)
- [x] Made server.listen() conditional on NODE_ENV !== 'test'

---

## Phase 5: Session Management & LLM Response Format ✅
**Goal:** Handle conversation sessions and align with Claude API format

### Session Management:
- [x] Detect "/resume" command in chat to load previous history
- [x] Otherwise, start fresh (clear history on new session)
- [x] Update ChatInterface.jsx to handle "/resume" command
- [x] Updated placeholder text to guide users

### LLM Response Format Update:
**Claude API format (implemented):**
```json
[
  {
    "type": "tool_use",
    "id": "toolu_01A09q90qw90lq917835lq9",
    "name": "addNode",
    "input": {
      "label": "Login",
      "description": "Auth page"
    }
  },
  {
    "type": "tool_use",
    "id": "toolu_01B12r91rw91mr928946mr0",
    "name": "addNode",
    "input": {
      "label": "Home"
    }
  }
]
```

### Files Modified:
- [x] Moved SYSTEM_PROMPT from `server/llm/prompts.js` into `server/llm/llmService.js`
- [x] Deleted `server/llm/prompts.js`
- [x] Updated SYSTEM_PROMPT to match Claude's tool_use format
- [x] Simplified `parseToolCalls()` to extract and parse JSON
- [x] Updated all 16 tests (16/16 passing)
- [x] Added `parseError` field - shows parse errors in frontend
- [x] Updated ChatInterface.jsx for session management

### Mock Testing Endpoint:
- [x] Created `POST /api/test/mock-llm` endpoint
- [x] Takes mock LLM response with `<thinking>` and `<response>` tags
- [x] Parses using parseToolCalls()
- [x] Executes using executeToolCalls()
- [x] Returns: parsed data + execution results + updated flow state
- [x] Tested with test-mock.sh script - working perfectly

---

## Phase 6: Future Work (Not Yet)

### LLM API Integration:
- [ ] Integrate Anthropic Claude API
- [ ] Send buildLLMContext() output to LLM
- [ ] Receive and parse LLM response
- [ ] Save assistant message to conversation.json

### E2E Testing:
- [ ] Full conversation flow tests with real LLM
- [ ] Error handling tests

---

## What We're NOT Building (Yet):

- ❌ Actual LLM API integration (OpenAI/Anthropic calls)
- ❌ Tool execution (functions that modify the graph)
- ❌ Auto-layout/positioning logic
- ❌ UI display of conversation history

## What We ARE Building:

- ✅ Backend conversation persistence
- ✅ Context building (what gets sent to LLM)
- ✅ API endpoints for conversation management
- ✅ Comprehensive test coverage
- ✅ Visibility into conversation history via conversation.json file + debug endpoint
