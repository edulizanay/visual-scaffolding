# Undo/Redo Feature Implementation Plan

## Phase 1: History Service (Backend Core)
- [ ] Create server/historyService.js with snapshot management
  - pushSnapshot(flowState) - add new state
  - undo() - go back one state
  - redo() - go forward one state
  - canUndo() / canRedo() - check availability
  - Max 50 snapshots (configurable)
- [ ] Write tests/historyService.test.js
  - Test snapshot creation
  - Test undo/redo operations
  - Test limits (max snapshots, boundary conditions)
  - Test persistence (load/save history.json)

## Phase 2: Server Integration
- [ ] Modify writeFlow() in server.js to call pushSnapshot()
- [ ] Add POST /api/flow/undo endpoint
- [ ] Add POST /api/flow/redo endpoint
- [ ] Add GET /api/flow/history-status endpoint
- [ ] Update tests/toolExecution.test.js if needed

## Phase 3: Frontend Integration
- [ ] Add undo/redo/getHistoryStatus functions to src/api.js
- [ ] Add undo/redo button handlers to App.jsx
- [ ] Add UI buttons in top-right corner
- [ ] Poll history status to enable/disable buttons

## Phase 4: Testing & Validation
- [ ] Run all existing tests (npm test)
- [ ] Manual E2E testing:
  - Add nodes via LLM
  - Undo/redo LLM actions
  - Make manual edits
  - Undo/redo manual edits
  - Verify state consistency
