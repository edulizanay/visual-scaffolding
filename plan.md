# Undo/Redo Feature Implementation Plan

## Phase 1: History Service (Backend Core) ✅
- [x] Create server/historyService.js with snapshot management
  - pushSnapshot(flowState) - add new state
  - undo() - go back one state
  - redo() - go forward one state
  - canUndo() / canRedo() - check availability
  - Max 50 snapshots (configurable)
- [x] Write tests/historyService.test.js
  - Test snapshot creation
  - Test undo/redo operations
  - Test limits (max snapshots, boundary conditions)
  - Test persistence (load/save history.json)

## Phase 2: Server Integration ✅
- [x] Modify writeFlow() in server.js to call pushSnapshot()
- [x] Add POST /api/flow/undo endpoint
- [x] Add POST /api/flow/redo endpoint
- [x] Add GET /api/flow/history-status endpoint
- [x] All tests/toolExecution.test.js still passing (18/18)

## Phase 3: Frontend Integration ✅
- [x] Add undo/redo/getHistoryStatus functions to src/api.js
- [x] Add undo/redo button handlers to App.jsx
- [x] Add UI buttons in top-right corner
- [x] Poll history status to enable/disable buttons

## Phase 4: Testing & Validation ⏳
- [x] Run all existing tests (historyService: 14/14 passing, toolExecution: 18/18 passing)
- [ ] Manual E2E testing:
  - Add nodes via LLM
  - Undo/redo LLM actions
  - Make manual edits (drag nodes, edit labels)
  - Undo/redo manual edits
  - Verify state consistency
