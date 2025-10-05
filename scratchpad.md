# Scratchpad

## 2025-10-05

### 12:45 PM
- Created plan.md with full implementation checklist
- Creating scratchpad.md for development logging
- Starting Phase 1: Update flowTools.js to add position parameter

### 12:50 PM
- Updated updateNode tool schema to include position {x, y}
- Phase 1 complete, moving to Phase 2: conversationService
- Writing tests for conversationService.js

### 12:55 PM
- Created tests/conversationService.test.js with 8 test cases
- Tests cover: load, add user/assistant messages, history limits, clear, corrupted JSON
- Implemented conversationService.js with all 5 functions

### 1:00 PM
- Running tests - jest.config.js ES module issues
- Fixed jest.config.js (changed module.exports to export default)
- Need NODE_OPTIONS=--experimental-vm-modules flag

### 1:05 PM
- Tests running but 10/14 failing
- Issue: Test isolation problem - data bleeding between tests
- beforeEach creates empty file but tests still see old data
- Looking at error: first test expects empty history but sees [{"content": "Hello AI", ...}]
- This "Hello AI" message appears in EVERY failing test

### 1:10 PM
- ROOT CAUSE ANALYSIS IN PROGRESS
- Need to understand: Why is "Hello AI" persisting across tests?
- Checking if file path is correct and beforeEach is actually running

### 1:15 PM
- ROOT CAUSE FOUND!
- conversationService.js caches CONVERSATION_DATA_PATH as a constant on module load
- Test sets process.env.CONVERSATION_DATA_PATH but module already loaded with old path
- Solution: Change CONVERSATION_DATA_PATH from constant to function getConversationPath()
- Updated conversationService.js to call getConversationPath() dynamically
- Now testing to see if this fixes the issue

### 1:20 PM
- SUCCESS! All 14 tests passing
- conversationService.js fully tested and working
- Moving to Phase 2 plan.md checklist updates

### 1:25 PM
- User wants to test from frontend immediately
- Revising plan: Skip full contextBuilder, build minimal API first
- Creating POST /api/conversation/message endpoint
- Creating GET /api/conversation/debug endpoint for easy viewing

### 1:30 PM
- Added conversation endpoints to server.js
- POST /api/conversation/message - saves user message
- GET /api/conversation/debug - returns conversation with metadata
- DELETE /api/conversation/history - clears history
- Server auto-restarted, now updating frontend API client

### 1:35 PM
- Updated src/api.js with sendMessage, getConversationDebug, clearConversation functions
- Updated ChatInterface.jsx to call backend API instead of local logging
- Frontend now sends messages to backend which saves to conversation.json
- Ready for testing

### 1:40 PM
- ✅ USER TESTED - WORKING!
- Messages successfully saving to conversation.json
- Frontend → Backend → File storage confirmed working
- Next: Build contextBuilder to format full LLM request

### 1:45 PM
- Planning Phase 3: LLM Service Layer
- Decision: Create server/llm/ folder for all LLM logic
- Rationale: Clean separation, easy to find/maintain LLM-specific code
- Decision: Combine contextBuilder + responseParser into single llmService.js
- Rationale: Not complex enough to warrant separate files
- Decision: Move tools from src/ to server/llm/tools.js
- Rationale: Backend is source of truth for tool definitions
- Decision: Skip "clean exports" index.js - overkill for small project
- Decision: LLM response format includes <thinking> and <response> tags
- Updated plan.md to reflect Phase 3 architecture

### 1:50 PM
- Created server/llm/ and tests/llm/ folders
- Created server/llm/prompts.js with SYSTEM_PROMPT
- Copied src/flowTools.js to server/llm/tools.js
- Now checking which frontend files need import updates

### 2:00 PM
- Created tests/llm/llmService.test.js with 14 comprehensive test cases
- Tests cover buildLLMContext and parseToolCalls functions
- Implemented server/llm/llmService.js with both functions
- Updated server.js POST /api/conversation/message to use buildLLMContext()
- Now seeing complete LLM context logged to server console

### 2:10 PM
- Fixed parseToolCalls bug: quoted strings being converted to numbers
- Issue: parentNodeId="1" was becoming number 1 instead of string "1"
- Solution: Keep quoted strings as strings, only parse unquoted values as JSON types
- All 14 tests now passing

### 2:15 PM
- Deleted old src/flowTools.js (moved to server/llm/tools.js)
- Updated plan.md to mark Phase 3 complete
- TESTING: Sent "create a login node" via curl
- ✅ LLM context appears correctly in server console with:
  - systemPrompt (from prompts.js)
  - userMessage ("create a login node")
  - flowState (empty nodes/edges array)
  - conversationHistory (3 previous messages)
  - availableTools (all 8 tool definitions)
- ✅ conversation.json updated with new user message
- Phase 3 complete and tested!

### 2:30 PM
- DECISION: Tool execution logic stays in server.js (not separate toolExecutor.js)
- Rationale: Keeping it simple, avoiding over-engineering for current scope
- Note: May revisit if tool execution becomes complex or needs reuse elsewhere
- Writing tests for tool execution functions within server.js

### 2:45 PM
- Created tests/toolExecution.test.js with 17 comprehensive test cases
- Tests cover all 8 tools: addNode, updateNode, deleteNode, addEdge, updateEdge, deleteEdge, undo, redo
- Implemented tool execution functions in server.js:
  - executeTool(toolName, params) - executes single tool
  - executeToolCalls(toolCalls) - batch execution
  - 6 helper functions for each tool operation
- Fixed FLOW_DATA_PATH constant issue (same as conversationService fix)
- Changed to getFlowPath() function for dynamic path resolution
- Fixed server.listen() to only run when NODE_ENV !== 'test'
- ✅ All 17 tests passing!
- Tools are now fully tested and ready for LLM integration

### 3:00 PM
- DECISION: Session management approach
  - Type "/resume" in chat to continue previous conversation history -- add a placeholder in the chatbar to guide the user
  - Otherwise, start fresh (clear history on each new session)
  - Simple approach: no session IDs, just manual control via command
- DECISION: LLM response format (researched Claude API docs)
  - Claude returns tool calls as array of content blocks
  - Each block: `{type: "tool_use", id: "toolu_1", name: "toolName", input: {...}}`
  - Will update our format to match Claude's standard
- DECISION: Error handling for malformed JSON
  - Show parse errors in frontend so user can debug
  - Don't fail silently - surface issues clearly
- DECISION: Code organization
  - Move SYSTEM_PROMPT from prompts.js into llmService.js (simpler)
  - Simplify parseToolCalls to just extract and parse JSON

### 3:15 PM
- IMPLEMENTATION: Updated to Claude API format
  - Moved SYSTEM_PROMPT from server/llm/prompts.js into llmService.js
  - Deleted prompts.js (no longer needed)
  - Updated SYSTEM_PROMPT with Claude tool_use format example
  - Simplified parseToolCalls() to just extract and parse JSON
  - Added parseError field to return parse failures to frontend
  - Updated all 16 tests in llmService.test.js (16/16 passing)
- IMPLEMENTATION: Mock testing endpoint
  - Created POST /api/test/mock-llm endpoint
  - Takes llmResponse string (with <thinking> and <response> tags)
  - Parses using parseToolCalls()
  - Executes using executeToolCalls()
  - Returns: parsed data, execution results, updated flow state
  - ✅ Tested with test-mock.sh script - works perfectly!
  - Returns parse errors to frontend when JSON is malformed

### 3:30 PM
- IMPLEMENTATION: Session management with /resume command
  - Updated ChatInterface.jsx to clear history on mount (start fresh)
  - Added /resume command detection - keeps existing history
  - Updated placeholder text to guide users
  - Simple implementation: no session IDs, just manual control
  - ✅ Phase 5 complete - ready for real LLM integration!

### 3:45 PM
- BUG FIX: Session management logic was backwards
  - Problem: History was cleared on mount, so /resume couldn't access it
  - Solution: Only clear on first message IF it's not /resume
  - Logic now:
    - First message = "/resume" → Keep history, continue conversation
    - First message = anything else → Clear history, start fresh
  - Updated ChatInterface.jsx to track isFirstMessage instead of clearing on mount

### 4:00 PM
- DECISION: Use Groq instead of Anthropic Claude
  - Model: `openai/gpt-oss-120b`
  - Reason: Edu's preference for this specific model
  - Will keep Groq client code in llmService.js (not separate file)
- IMPLEMENTATION: Phase 6 setup started
  - Created .env file with GROQ_API_KEY placeholder
  - Updated .gitignore to exclude:
    - .env files
    - server/data/conversation.json
    - tests/test-data/
  - Installed groq-sdk package (npm install groq-sdk)
  - Simplified ChatInterface placeholder text
- NEXT: Add callGroqAPI() function to llmService.js
- NEXT: Test basic Groq connection
- NEXT: Wire Groq to POST /api/conversation/message endpoint

### [Session Continued - 2025-10-05]

### Edge Label Bug Fix
- **PROBLEM DISCOVERED**: Edge labels not rendering in UI despite backend storing them
- **ROOT CAUSE**: Backend stored labels as `edge.label`, but ReactFlow expects `edge.data.label`
  - ReactFlow convention: All custom data goes in `.data` object (like `node.data.label`)
  - Frontend already followed this convention (App.jsx:81, Edge.jsx:17,91)
  - Backend was breaking the convention in 3 places
- **INVESTIGATION**:
  - First test: LLM didn't use new `edgeLabel` parameter (still trying old updateEdge approach)
  - Realized server hadn't restarted after adding `edgeLabel` parameter
  - After restart, tested with curl - edge created but label didn't render
  - Checked Edge.jsx - confirmed it reads from `data.label` not direct `.label`
  - Checked App.jsx - confirmed updateEdgeLabel uses `edge.data.label`
  - Confirmed this is ReactFlow's documented best practice
- **FIX APPLIED**:
  1. executeAddNode (server.js:293): Changed `newEdge.label = edgeLabel` → `newEdge.data = { label: edgeLabel }`
  2. executeAddEdge (server.js:376): Changed `newEdge.label = label` → `newEdge.data = { label }`
  3. executeUpdateEdge (server.js:403): Changed `edge.label = label` → `edge.data.label = label` (with safety check for missing data object)
  4. Updated tests (toolExecution.test.js:72,167): Changed assertions from `edge.label` → `edge.data.label`
- **RESULT**: ✅ All 18 tests passing, server restarted, edge labels now follow ReactFlow convention
- **KEY LEARNING**: Backend data structure must match frontend expectations - ReactFlow uses `.data` for custom properties

### [Undo/Redo Feature - 2025-10-05]

### Feature Implementation - Undo/Redo
- **BRANCH**: feature/undo-redo
- **GOAL**: Add undo/redo buttons that work for ALL flow changes (LLM + manual)
- **APPROACH**: Snapshot-based history system (max 50 states)

### Implementation Complete
1. ✅ Created server/historyService.js
   - pushSnapshot(), undo(), redo(), canUndo(), canRedo(), getHistoryStatus()
   - Stores in server/data/history.json
   - Max 50 snapshots, truncates future on new action after undo
2. ✅ All 14 historyService tests passing
3. ✅ Modified server.js:
   - writeFlow() now calls pushSnapshot() (with skipSnapshot flag to avoid loops)
   - Added 3 endpoints: POST /api/flow/undo, POST /api/flow/redo, GET /api/flow/history-status
4. ✅ Added 3 API functions to src/api.js: undoFlow(), redoFlow(), getHistoryStatus()
5. ✅ Added UI to App.jsx:
   - Two buttons in top-right corner (← Undo, Redo →)
   - Auto-disable when can't undo/redo
   - Poll status every 1s to update button states
6. ✅ All toolExecution tests still pass (18/18)
7. ⏳ Ready for E2E testing

