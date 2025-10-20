# Auto-Layout Refactor Implementation Checklist

## Phase 1: Shared Infrastructure

- [ ] Create `shared/` directory at project root
- [ ] Create `shared/constants/nodeDimensions.js` as **single source of truth** with width/height/radius exports
- [ ] Update `src/constants/theme.js` to import from `shared/constants/nodeDimensions.js` and re-export (theme becomes a thin re-export layer, not the source)
- [ ] Verify frontend still works with re-exported constants
- [ ] Create `shared/layout/applyDagreLayout.js` with pure layout helper
  - [ ] Accept `{ nodes, edges, direction = 'LR', nodeDimensions }` parameters
  - [ ] Return updated nodes array with positioned coordinates
  - [ ] No React dependencies, pure function
- [ ] Write unit tests for `applyDagreLayout`:
  - [ ] Deterministic positioning (same input → same output)
  - [ ] Direction parameter support (LR, TB, etc.)
  - [ ] Idempotence (running twice produces same positions)
  - [ ] Uses shared nodeDimensions constants

## Phase 2: Backend Tool

- [ ] Add `executeAutoLayout` function in `server/tools/executor.js`:
  - [ ] Fetch latest flow data
  - [ ] Call shared layout helper with flow nodes/edges
  - [ ] Compare new positions with current positions
  - [ ] If changed: call `writeFlow()` and return `{ tool: 'autoLayout', success: true, updatedFlow }`
  - [ ] If unchanged: skip write and return `{ tool: 'autoLayout', success: true, updatedFlow: flow, didChange: false }`
- [ ] Update all existing tool executors to include `tool` field in return value
- [ ] Add auto-layout route in `server/routes/flowRoutes.js`:
  - [ ] Use existing `toolEndpoint` helper
  - [ ] Register `POST /api/flow/auto-layout`
  - [ ] Return `{ success, flow, tool: 'autoLayout', didChange }`
- [ ] Write unit tests for `executeAutoLayout`:
  - [ ] Writes flow when positions change
  - [ ] Skips write when positions unchanged
  - [ ] Returns correct `tool` and `didChange` flags
  - [ ] Handles empty flows gracefully

## Phase 3: LLM Integration

- [ ] Add `autoLayout` tool definition in `server/llm/tools.js`:
  - [ ] Description: "Use after building or significantly editing a portion of the graph, or when the human explicitly requests layout."
  - [ ] Empty parameter schema (no args needed)
- [ ] Verify tool appears in LLM system prompt
- [ ] Update `executeToolCalls` to handle `autoLayout` tool name

## Phase 4: Frontend Updates

- [ ] Update `handleFlowUpdate` in `src/App.jsx`:
  - [ ] Add `options = { animateLayout: false }` parameter
  - [ ] Always apply flow nodes/edges
  - [ ] Only call `applyLayoutWithAnimation` when `options.animateLayout === true`
  - [ ] Remove unconditional layout call and `setTimeout`
- [ ] Update `useFlowLayout` hook:
  - [ ] Import shared layout helper
  - [ ] Remove Dagre computation logic (delegate to helper)
  - [ ] Keep only animation/timer coordination
- [ ] Update all `handleFlowUpdate` call sites:
  - [ ] Undo/redo: use default options
  - [ ] Tool mutations: use default options
  - [ ] AutoLayout tool: use `{ animateLayout: true }`
- [ ] Update `ChatInterface.jsx`:
  - [ ] Detect `execution.some(result => result.tool === 'autoLayout')`
  - [ ] Call `onFlowUpdate(flow, { animateLayout: true })` for auto-layout
  - [ ] Call `onFlowUpdate(flow)` for other tools (default behavior)

## Phase 5: Testing

- [ ] Run all existing unit tests to verify no regressions
- [ ] Update `tests/integration/workflow-state-sync.test.js`:
  - [ ] Replace frontend Dagre simulation with tool endpoint calls
  - [ ] Adjust snapshot count expectations
- [ ] Add history regression test:
  - [ ] Create node → autoLayout → undo → redo
  - [ ] Verify positions correct at each step
  - [ ] Verify redo stack intact after undo
- [ ] Run full test suite: `npm test`

## Phase 6: Manual Validation

- [ ] Test via UI:
  - [ ] Create nodes manually
  - [ ] Trigger auto-layout via chat
  - [ ] Verify animated transition
  - [ ] Perform undo/redo
  - [ ] Confirm redo stack survives
- [ ] Test via REST endpoint:
  - [ ] POST to `/api/flow/auto-layout` directly
  - [ ] Verify response shape includes `tool` and `didChange`
  - [ ] Confirm positions persisted correctly
- [ ] Test LLM workflow:
  - [ ] Ask LLM to create a complex flow
  - [ ] Verify it calls `autoLayout` at appropriate times
  - [ ] Confirm animation triggers in UI
- [ ] Test autosave interaction:
  - [ ] Trigger auto-layout via tool
  - [ ] Wait for autosave to fire
  - [ ] Check database: should only have 1 snapshot (deduped)
- [ ] Test idempotence:
  - [ ] Run auto-layout twice in a row
  - [ ] Verify second call returns `didChange: false`
  - [ ] Confirm no extra snapshots created

## Phase 7: Cleanup & Documentation

- [ ] Remove old layout code from `handleFlowUpdate` if not already done
- [ ] Update `.agent/system/` docs to reflect new architecture
- [ ] Update any prompt engineering docs mentioning layout behavior
- [ ] Add comments documenting the `tool` metadata pattern for future tool authors
- [ ] Verify no console warnings or errors in browser
- [ ] Check for any lingering `setTimeout` calls related to layout

## Rollout

- [ ] Commit changes with clear message
- [ ] Push to feature branch
- [ ] Create PR with link to this plan
- [ ] Deploy to staging/test environment
- [ ] Validate in production-like setting
- [ ] Merge to main
- [ ] Communicate new tool availability to team
