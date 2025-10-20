# Auto-Layout Tool Refactor Plan

This document outlines the work required to move Dagre layout computation off the frontend animation path and expose it as an explicit tool that can be invoked by the LLM or other clients.

## 1. Shared Layout Utility
- Extract a pure helper that applies Dagre positions without React dependencies.
- Accept inputs `{ nodes, edges, direction, nodeDimensions }` so backend and frontend can share it.
- Create a top-level `shared/` directory (e.g., `shared/layout/applyDagreLayout.js`). Add `shared/constants/nodeDimensions.js` as the single source for node width/height/radius.
- Update `src/constants/theme.js` to import those shared constants and re-export them so existing frontend code keeps working.
- Update `useFlowLayout` to import the shared helper and focus solely on animation/timer work.

## 2. Backend Tooling
- **Tool executor**:  
  - In `server/tools/executor.js`, add an `executeAutoLayout` branch.  
  - The function should pull the latest flow, call the shared layout helper, and compare the resulting node positions with the current flow.
  - If positions changed, persist the result with `writeFlow(flow)` (allowing normal snapshot creation) and return `{ tool: 'autoLayout', success: true, updatedFlow }`.
  - If nothing changed, skip the write and return `{ tool: 'autoLayout', success: true, updatedFlow: flow, didChange: false }`.
- **Route exposure**:  
  - Register a legacy-accessible endpoint (e.g., `POST /api/flow/auto-layout`) using the existing `toolEndpoint` helper so non-LLM clients can invoke it.
- **History safety**:  
  - Skipping the write when positions are identical avoids redundant history entries.
  - When a write does occur, the frontend autosave may still post the same flow; `pushUndoSnapshot` already deduplicates identical snapshots, so redo stacks stay intact even with that second save.

## 3. LLM Tool Definition
- Extend `server/llm/tools.js` with `autoLayout` including:
  - Description nudging: “Use after building or significantly editing a portion of the graph, or when the human explicitly requests layout.”
  - Empty parameter schema (no args needed initially).
- Confirm `llmService` automatically exports the new tool definition into the system prompt so the LLM knows it exists.

## 4. Frontend Flow Update Flow
- Modify `handleFlowUpdate` in `src/App.jsx` to accept an options object:
  - `{ animateLayout?: boolean }` defaulting to `false`.
  - Always set nodes/edges from the normalized flow; only schedule `applyLayoutWithAnimation` when the flag is true.
- Update all call sites:
  - Undo/redo and mutation responses call with default options (no auto-layout).
  - When the UI receives flow results from the `autoLayout` tool, call `handleFlowUpdate(flow, { animateLayout: true })`.
- Remove the unconditional layout inside `handleFlowUpdate` (and the lingering `setTimeout`).
- Keep autosave logic unchanged; it will now persist whatever the backend sends without triggering new positions.

## 5. Chat & Tool Response Handling
- Ensure each tool executor returns a `{ tool: '<name>', success, ... }` payload so callers can tell which tool ran.
- In `ChatInterface`, inspect the `execution` array from the conversation response; if any entry has `tool === 'autoLayout'` and `success`, call `onFlowUpdate(flow, { animateLayout: true })`.
- Other tool responses should continue calling `onFlowUpdate` with default options so undo/redo remains a direct snapshot swap.
- For direct REST usage of `/api/flow/auto-layout`, return the same shape `{ success, flow, tool: 'autoLayout', didChange }` so clients can reuse the detection logic.

## 6. Testing Strategy
- **New unit tests**:
  - Add tests for the shared layout helper verifying deterministic positioning, orientation support, and idempotence (using the shared node-dimension constants).
  - Test the new executor branch to ensure it writes the flow when positions change, skips database writes when layout is already settled, and sets the `tool`/`didChange` flags correctly.
- **Integration updates** (`tests/integration/workflow-state-sync.test.js`):
  - Replace front-end simulated Dagre calls with requests to the new endpoint or executor tool.
  - Adjust expectations around snapshot counts to reflect tool-driven saves.
- **History regression checks**:
  - Add a scenario: create node → autoLayout → undo → redo and ensure positions/redo stack remain intact.

## 7. Manual Validation Checklist
- Create nodes via UI, trigger auto-layout (using the new tool via chat or manual endpoint), confirm redo stack survives undo/redo.
- Verify autosave persists layouted positions without spawning extra history entries.
- Use prompted LLM workflow to ensure it calls `autoLayout` only when appropriate and the animation occurs on the client.
- Run `npm test` and targeted manual tests after implementation.

## 8. Rollout Notes
- Communicate the new tool availability to collaborators; update any prompt engineering docs.
- Ensure production deployment seeds include the shared helper (no bundler issues) and migration is not required.
