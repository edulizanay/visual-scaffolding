# Backend Save Funnel - Architecture Documentation

> **Status**: ✅ **COMPLETED** - Migration to backend-only persistence finished. This document describes the current architecture.

## 1. Objective
- ✅ All flow persistence goes through backend APIs - server is the single source of truth
- ✅ Frontend autosave retired - no fallback needed
- ✅ Undo/redo semantics preserved through backend snapshot history

## 2. Scope
**In scope**
- React Flow graph state: nodes, edges, group membership, subtree collapse flags.
- LLM-initiated editing workflows (ChatInterface, NotesPanel).
- Backend persistence pipeline (`server/app.js`, `server/historyService.js`, `server/tools/executor.js`, associated routes).

**Out of scope (current phase)**
- Presentation-only state (selection, viewport, layout animation).
- Multi-tenant user separation or real-time collaboration.
- Schema changes to the underlying SQLite tables beyond optional metadata fields.

## 3. Current Architecture (Backend-Only)
- **No frontend autosave** - All persistence through explicit backend API calls
- **Backend tool routes** (`server/routes/flowRoutes.js`) handle all CRUD, grouping, undo/redo, and layout operations
- **History storage** in `server/db.js` (50-snapshot window, dedupe on identical JSON payloads)
- **LLM workflows** call `executeToolCalls` exclusively via `/api/conversation/message`
- **UI actions** call dedicated endpoints: `updateNode`, `deleteNode`, `createEdge`, etc.

## 4. Design Principles (Achieved)
✅ **Explicit intent**: Every persisted mutation issues a backend API call with meaningful metadata (`origin` field)
✅ **No implicit saves**: UI actions directly call backend endpoints - no debouncing or batching
✅ **Snapshot creation**: Backend creates history snapshots with action-specific origins (`ui.node.update`, `ui.node.delete`, `ui.subtree`, `llm.tool`)
✅ **Undo/redo fidelity**: All operations create snapshots - full undo/redo support across all actions

## 5. Implementation Status
### Completed Features ✅
1. **Node position updates**: `updateNode({ position })` called per moved node on drag-end via `onNodesChange`
2. **Subtree collapse**: `toggleSubtreeCollapse` backend tool replicates full collapse behavior
3. **Node deletion**: `deleteNode` API called via React Flow's `onNodesDelete` callback
4. **Edge deletion**: `deleteEdge` API called via React Flow's `onEdgesDelete` callback
5. **Undo/redo**: Full history maintained for all structural and positional changes
6. **LLM workflows**: Operate exclusively through `executeToolCalls` via `/api/conversation/message`
7. **Snapshot metadata**: All snapshots include `origin` field (`ui.node.update`, `ui.node.delete`, `ui.edge.delete`, `ui.subtree`, `llm.tool`)
8. **Testing**: 703 automated tests covering all persistence paths
9. **Error handling**: Failed operations revert local state and alert user

## 6. Architecture Decisions
- **Visual-only state**: Selection, viewport position, and layout animation are ephemeral (client memory only). Only structural changes (collapse, position, content) persist.
- **Drag-end error handling**: Original positions captured at drag start. On `updateNode` failure, positions revert and user sees alert. Simple and predictable UX.
- **Undo granularity**: Each moved node creates one snapshot. React Flow reports all moves in single `onNodesChange` event; we call `updateNode` for each. Undo steps through individually.
- **Subtree collapse**: Single atomic operation - updates parent's `data.collapsed` AND toggles all descendant `hidden`/`subtreeHidden` flags, plus hides affected edges.
- **Snapshot metadata**: Every snapshot includes `origin` field (`ui.node.update`, `ui.node.delete`, `ui.edge.delete`, `ui.subtree`, `llm.tool`) for debugging and analysis.
- **Shared utilities**: Edge-based `getAllDescendants` in `shared/flowUtils/`; group-specific `getGroupDescendants` for group workflows.
- **API call pattern**: One request per entity (no batching) - mirrors user action semantics, keeps implementation simple.
- **Concurrency**: Last-write-wins. Single-user application - no conflict resolution needed.
- **Position detection**: Extract position from React Flow's change payload (not stale refs) to avoid async state issues.

## 7. UI Mutation Inventory
| User action | UI trigger / source | Current persistence path | Backend coverage |
| --- | --- | --- | --- |
| Node label / description edit | Inline edit (`App.jsx:151-170`, `Node.jsx`) | `handleMutation` → `PUT /api/node/:id` | ✅ `executeUpdateNode` |
| Node creation (child / chat) | Cmd+Double-click, LLM tools | `POST /api/node` | ✅ `executeAddNode` |
| Edge creation | React Flow connect | `POST /api/edge` | ✅ `executeAddEdge` |
| Edge label edit | Inline edit (`App.jsx:167-173`) | `PUT /api/edge/:id` | ✅ `executeUpdateEdge` |
| Group create | ⌘ + G | `POST /api/group` | ✅ `executeCreateGroup` |
| Group ungroup | ⌘ + ⇧ + G | `DELETE /api/group/:id` | ✅ `executeUngroup` |
| Group expand / collapse | Double-click group / halo | `PUT /api/group/:id/expand` | ✅ `executeToggleGroupExpansion` |
| Node drag / position update | React Flow drag events | Local `useNodesState`; autosave persists drop | ⚠️ Add drag-end `updateNode` |
| Subtree collapse / expand | Alt+Click node | Local `collapseSubtreeByHandles` + autosave | ❌ Add `toggleSubtreeCollapse` tool |
| Undo / Redo | Hotkeys / toolbar | `/api/flow/undo|redo` | ✅ `executeUndo/Redo` |
| LLM / notes-driven edits | ChatInterface, NotesPanel | `sendMessage` → `executeToolCalls` | ✅ |

Legend: ✅ exists today; ⚠️ backend tool exists but UI change pending; ❌ missing backend tool.

## 8. Backend Tooling & Gaps
- **Existing**: node/edge CRUD, group operations, undo/redo, auto layout.
- **Required additions**:
  - `toggleSubtreeCollapse`: move `collapseSubtreeByHandles` and `getAllDescendants` into `shared/`, create executor function + route (likely `PUT /api/flow/subtree`). This executor must replicate the full collapse behavior: parent flag + descendant visibility + edge hiding.
  - `updateNode` drag-end pathway: no new tool code needed; add frontend handler to call existing `updateNode` endpoint on drag stop (one call per moved node). No batch endpoint required initially.
- **Instrumentation**: add structured logs for tool execution (`tool`, `origin`, `duration`, `result`) to observe behaviour during dual-run. Include `origin` field in snapshot metadata from day one.

## 9. Execution Plan
1. **Shared utilities extraction**
   - Move `collapseSubtreeByHandles` and `getAllDescendants` into `shared/`.
   - Export required helpers for both frontend and backend.
2. **Backend tooling**
   - Implement `toggleSubtreeCollapse` in `server/tools/executor.js` (reusing shared collapse logic).
   - Expose endpoint (`PUT /api/flow/subtree`) wired to the executor.
   - Add structured logging with `origin` field to all snapshot creation.
   - Update snapshot creation to include `origin` metadata (`ui.drag`, `ui.subtree`, `llm.tool`).
3. **Frontend dual-run prep**
   - Add config flags: `ENABLE_BACKEND_DRAG_SAVE`, `ENABLE_BACKEND_SUBTREE`.
   - Update drag handlers: on drag stop, call `updateNode({ position })` for each moved node (one call per node from `onNodesChange`).
   - Add `lastChangeWasPositional` flag; set it on drag stop, check it in autosave debounce to skip duplicate saves.
   - Route Alt+collapse to new backend `toggleSubtreeCollapse` endpoint under `ENABLE_BACKEND_SUBTREE` flag.
   - On drag-end `updateNode` failure: revert node position in React Flow state + show error toast.
   - Keep debounced autosave active during dual-run with positional short-circuit logic.
4. **Testing**
   - Add one integration test for drag-end → `updateNode` → snapshot creation.
   - Reuse existing test suites for coverage.
   - Defer network failure and concurrency tests unless production issues emerge.
5. **Rollout**
   - Enable flags in staging, monitor logs for failures/latency.
   - Roll out to production once metrics stabilise.
6. **Retire autosave fallback**
   - Remove debounced autosave and `/api/flow` save path.
   - Remove `lastChangeWasPositional` flag and related short-circuit logic.
   - Clean up redundant `skipSnapshot` handling where duplicate writes no longer occur.

## 10. Success Metrics & Rollout Criteria
- Drag-end `updateNode` calls succeed >99% (5xx/4xx tracked over multiple sessions).
- No unexpected duplicate snapshots during dual-run (verify `lastChangeWasPositional` short-circuit works).
- Automated regression suite (unit + integration) passes with flags on and off.
- Manual smoke tests confirm: dragging, subtree collapse, undo/redo, LLM edits produce consistent state with autosave disabled.
- Snapshot metadata shows correct `origin` tagging (`ui.drag`, `ui.subtree`, `llm.tool`) in structured logs.

## 11. Testing & Verification
- Add one integration test: drag-end → `updateNode` → snapshot creation with correct `origin` metadata.
- Reuse existing test suites for regression coverage.
- Defer network failure simulation and concurrent user simulation tests unless production issues emerge.
- Frontend unit tests for drag handler (mocking `updateNode` API calls) and subtree collapse flow.
- CI gating: ensure new tests run in both flag configurations where practical.

## 12. Risks & Mitigations
- **Missed drag-end events** → add logging; autosave remains active during dual-run as fallback.
- **Snapshot noise from frequent drags** → accept initially; each drag-end creates one snapshot per moved node. Can add debouncing or batch endpoint later if telemetry shows issues.
- **Dual-run race conditions** → `lastChangeWasPositional` flag prevents autosave from creating duplicate positional snapshots. Monitor logs to verify.
- **Regression in LLM workflows** → maintain `onFlushPendingSave` during dual-run; add integration coverage.
- **User confusion if autosave removed prematurely** → communicate change after criteria met; ensure manual QA sign-off.

## 13. Future Enhancements (Deferred)
- Batch position updates (`updateNodePositions`) if telemetry shows call volume issues.
- Network failure and concurrency stress tests if production data warrants.
- Optimistic versioning / conflict detection if multi-user support becomes a priority.
