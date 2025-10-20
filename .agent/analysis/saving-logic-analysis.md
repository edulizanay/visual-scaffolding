# Backend Save Funnel PRD & Execution Plan

## 1. Objective
- Consolidate all flow persistence through backend tooling so the server remains the single source of truth.
- Retire the frontend autosave fallback once drag-end and subtree operations have reliable server coverage.
- Preserve undo/redo semantics and minimise user-visible regressions during the migration.

## 2. Scope
**In scope**
- React Flow graph state: nodes, edges, group membership, subtree collapse flags.
- LLM-initiated editing workflows (ChatInterface, NotesPanel).
- Backend persistence pipeline (`server/app.js`, `server/historyService.js`, `server/tools/executor.js`, associated routes).

**Out of scope (current phase)**
- Presentation-only state (selection, viewport, layout animation).
- Multi-tenant user separation or real-time collaboration.
- Schema changes to the underlying SQLite tables beyond optional metadata fields.

## 3. Current Architecture Snapshot
- **Frontend autosave** (`src/App.jsx:96-107`) debounces every node/edge change and posts `/api/flow`, creating history snapshots.
- **Backend tool routes** (`server/routes/flowRoutes.js`) wrap `executeToolCalls` for CRUD, grouping, undo/redo, and layout operations.
- **History storage** lives in `server/db.js` (50-snapshot window, dedupe on identical JSON payloads).
- **LLM workflows** already call `executeToolCalls` exclusively, flushing autosave first (`ChatInterface.jsx:122-143`).

## 4. Problems & Goals
Problems:
- Autosave hides intent; every local drag posts full flow state and creates implicit history entries.
- Some UI actions (Alt+collapse) mutate state purely on the client, relying on autosave for persistence.
- Double-write patterns (`executeToolCalls` + route-level `writeFlow`) depend on dedupe heuristics.

Goals:
- Every persisted mutation issues an explicit backend tool call with meaningful metadata.
- Subtree collapse and drag-end updates have first-class server endpoints.
- Autosave is removed without losing undo/redo fidelity or user confidence.

## 5. Requirements
### Functional
1. Persist node position updates via drag-end: fire one `updateNode({ position })` call per node that moved in the React Flow `onNodesChange` event. No batching or debouncing initially.
2. Add a backend tool/route for subtree collapse (`toggleSubtreeCollapse`) that replicates the full `collapseSubtreeByHandles` behavior: setting `data.collapsed` on the parent, toggling `hidden`/`subtreeHidden` flags on all descendants, and hiding affected edges.
3. Maintain undo/redo history for all structural and positional changes.
4. Ensure LLM tool execution continues to operate exclusively through `executeToolCalls`.
5. Store snapshot metadata (e.g., `origin`) inside the snapshot JSON payload; no schema migration required.

### Non-Functional
1. Dual-run period where autosave remains enabled as fallback, but short-circuits when `lastChangeWasPositional` flag is set (avoiding duplicate snapshots).
2. Instrumentation for drag-end calls, subtree toggles, and error rates.
3. Automated tests covering drag-end persistence, subtree collapse, and interleaved LLM/manual edits.
4. Record mutation `origin` (`ui.drag`, `ui.subtree`, `llm.tool`) on all new snapshots from day one for debugging and analysis.

## 6. Decisions & Policies
- **Visual-only state**: Keep selection, viewport position, and layout animation flags *ephemeral* (client memory only, reset on reload). Persist collapses that alter logical graph structure.
- **Drag-end error handling**: Capture original node positions at drag start (e.g., via `onNodeDragStart` and a ref). On `updateNode` failure, revert all nodes involved in the gesture back to those positions and show a toast. Simple and predictable UX.
- **Undo granularity**: Each node movement creates one snapshot. React Flow reports all moved nodes in a single `onNodesChange` event; we call `updateNode` for each. Undo steps through them individually—acceptable tradeoff.
- **Subtree collapse scope**: `toggleSubtreeCollapse` updates the parent node's `data.collapsed` flag AND walks all descendants to toggle their `hidden`/`subtreeHidden` flags, plus hides affected edges. This is a single atomic operation from the user's perspective.
- **Autosave coexistence**: During dual-run, set a `lastChangeWasPositional` flag on drag stop. Debounced autosave checks this flag and skips if true, preventing duplicate snapshots without complex coordination.
- **Feature flags**: Two environment boolean flags in config—`ENABLE_BACKEND_DRAG_SAVE` and `ENABLE_BACKEND_SUBTREE`. Deploy to toggle; no runtime or per-user complexity.
- **Snapshot metadata**: Include `origin` field (`ui.drag`, `ui.subtree`, `llm.tool`) inside the snapshot JSON payload on all snapshots from initial implementation. Tiny change, invaluable for debugging; parse the JSON when analysing history (JSON-only change keeps migrations unnecessary).
- **Shared descendants helper**: Move the edge-based `getAllDescendants` (from `useFlowLayout`) into `shared/`; keep the parentGroupId helper (`getGroupDescendants`) in place for group-only workflows.
- **Drag gesture grouping**: When multiple nodes move in a single drag gesture, invoke `updateNode` for each moved node using the same `origin` (e.g., `ui.drag`) and reuse the pre-drag snapshot for potential reverts so history stays readable.
- **API call volume**: Start with one `updateNode` request per moved node (mirrors current gesture semantics); revisit batching only if telemetry shows noisy behaviour.
- **Concurrency**: Accept last-write-wins. Instrument drag-end calls so we can revisit if real multi-user workflows emerge.
- **Autosave retirement criteria**: Logs show drag-end updates succeeding with negligible errors, regression tests pass, and manual smoke tests verify no stale flow once autosave is disabled.

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
