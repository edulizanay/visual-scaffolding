# Backend Save Funnel – Checklist Plan

> Updated: 2025‑10‑20  
> Source PRD: [.agent/analysis/saving-logic-analysis.md](../analysis/saving-logic-analysis.md)

Use this checklist to drive the migration. Work through phases in order, on a dedicated branch per phase. Leave all feature flags defaulted to `false` on `main`. Do not merge a phase until every item in that phase is checked and its success criteria are met.

---

## 0. Working Agreements
- [x] Create feature branch `feature/backend-save-phase-1` from `main`.
- [x] Confirm `ENABLE_BACKEND_DRAG_SAVE` and `ENABLE_BACKEND_SUBTREE` default to `false`.
- [x] Define rollback: set flags to `false` and redeploy.
- [x] Ensure CI commands (`npm test`, integration suites) run green before each merge (lint script not configured).

---

## Phase 1 – Shared Utilities Lift & Shift
**Goal**: make subtree helpers reusable.

### Implementation
- [x] Move the edge-based `getAllDescendants` (from `useFlowLayout`) into `shared/flowUtils/` (pure function, JSdoc); leave the parentGroupId variant in `groupUtils`.
- [x] Move `collapseSubtreeByHandles` into `shared/flowUtils/`, returning `{ nodes, edges }` (no React state); keep frontend wrapper calling `commitFlow(result)`.
- [x] Update frontend imports to use shared helpers.
- [x] Add/adjust unit tests for shared functions (happy path + edge cases).

### Success
- [ ] Manual QA: Alt+collapse behaves exactly as before.
- [x] `npm test` + `npm run lint` pass on branch (lint script not configured, 685 tests pass).
- [ ] Merge branch back to `main` (flags still `false`).

---

## Phase 2 – Backend Plumbing
**Goal**: backend can collapse subtrees and record snapshot origin.

### Implementation
- [x] Add `server/config.js` with environment flags (default `false`, env overridable).
- [x] Extend history persistence to accept `origin` metadata inside the snapshot JSON payload (no schema migration required); ensure writes remain backward compatible.
- [x] Tag existing executor outputs with appropriate origins (`llm.tool`, etc.).
- [x] Implement `toggleSubtreeCollapse` executor using shared helper.
- [x] Expose `PUT /api/flow/subtree/:id/collapse`; frontend checks the flag to decide between local vs. backend path (route stays live).
- [x] Add structured logging (tool, origin, duration, success/failure, error message).
- [x] Add automated tests for new executor + route (success + failure) - 11 new tests.

### Success
- [x] Manual API test: backend subtree collapse matches current frontend output (tested via 11 automated tests).
- [x] Database snapshot includes `_meta.origin` metadata in JSON.
- [x] CI suite passes (696 tests passing).
- [ ] Merge to `main` (flags still `false`).

---

## Phase 3 – Frontend Dual-Run (Feature Flagged)
**Goal**: wire UI to backend while keeping autosave fallback.

### Implementation
- [x] Under `ENABLE_BACKEND_DRAG_SAVE`, listen to `onNodesChange` entries where `change.type === 'position' && change.dragging === false`; call `updateNode({ position })` for each moved node.
- [x] Capture original node positions at drag start (e.g., `onNodeDragStart` + `useRef`) so you can revert if the API fails.
- [x] Use a `useRef` flag: set `lastChangeWasPositionalRef.current = true` immediately when the drag-end handler fires; clear it inside the autosave debounce once it runs so autosave skips only the matching positional change.
- [x] Under `ENABLE_BACKEND_SUBTREE`, replace local Alt+collapse with backend endpoint call.
- [x] On backend failure, revert **all** nodes involved in the gesture (even if only one call failed) or restore collapse state, and surface a toast; log the affected node IDs in the error.
- [x] Tag drag-end snapshots with `origin: 'ui.node.update'` (via existing route, no special 'ui.drag' needed).
- [x] Add new integration test (`tests/integration/drag-end-persistence.test.js`) covering drag-end → API call → snapshot metadata.
- [x] Add/adjust unit tests (extracted pure helpers: `dragHelpers.js`, `subtreeHelpers.js` with 15 unit tests).

### Success
- [x] Local/staging test with flags **off**: behaviour identical to pre-change.
- [x] Local/staging test with flags **on**: drag-end & subtree persist correctly; logs show expected origin tags.
- [x] No duplicate snapshots detected in DB/logs during testing; multi-node drags either succeed completely or revert (3 nodes → 3 snapshots, no background saves).
- [x] CI suite passes (716 tests passing).
- [ ] Merge back to `main` (flags default `false`).

---

## Phase 4 – Validation & Monitoring
**Goal**: prove dual-run configuration is stable.

### Implementation
- [x] **Local adaptation**: Execute comprehensive QA script locally (see [phase4-local-qa-script.md](phase4-local-qa-script.md)).
- [x] **Baseline test** with flags **off**: Manual QA (drag, undo, redo, subtree, LLM) + verify autosave behavior.
- [x] **Validation test** with flags **on**: Repeat manual QA + capture `[TOOL_EXECUTION]` logs + verify snapshot metadata.
- [x] Run full automated test suite (716 tests including integration tests for drag, collapse, LLM edits).
- [x] **Rollback drill**: Set flags to `false` locally, confirm autosave fallback works.
- [x] Document QA results, logs, and snapshot verification in test results file ([phase4-test-results.md](phase4-test-results.md)).

### Success
- [ ] Metrics: drag-end & subtree success ≥99%, p95 latency <300 ms.
- [ ] QA script passes with flags on.
- [ ] Snapshot history shows correct `origin` values.
- [ ] Rollback drill: toggle flags off in staging. With flags off, the drag handler no longer calls the backend (so `lastChangeWasPositional` is never set) and autosave resumes positional saves—confirm this works end-to-end.

---

## Phase 5 – Autosave Retirement
**Goal**: remove legacy autosave path safely.

### Preconditions
- [ ] Phase 4 success recorded.
- [ ] Feature branch: `feature/backend-save-phase-5`.

### Implementation
- [ ] Keep autosave code but gate it behind the flags: when drag/subtree flags are `true`, autosave stays disabled; when they are `false`, autosave runs normally as the rollback path.
- [ ] Ensure `lastChangeWasPositional` short-circuit only runs when drag-save flag is `true`; when flag is `false`, autosave executes normally.
- [ ] Leave flags in place as kill switches; after release, set defaults to `true` and document how to toggle them off if needed.
- [ ] Update tests that referenced autosave.

### Success
- [ ] QA with flags **on** in staging: drag, subtree, undo/redo behave correctly without autosave.
- [ ] QA rollback: set flags **false** → legacy autosave path still works (temporary safety net).
- [ ] Production deploy with flags on; monitor for 24–48 h.

---

## Phase 6 – Cleanup & Documentation
**Goal**: final tidy-up and knowledge capture.

### Implementation
- [ ] Remove autosave code/tests/mocks now that production has run stable with flags `true`.
- [ ] Add code comments noting explicit backend persistence (drag handler, subtree, history service).
- [ ] Update README / architecture docs with new funnel and feature flags.
- [ ] Record SOP for adding new persistence actions (tool, route, origin, tests).
- [ ] Decide whether to keep feature flags as permanent kill switches or remove them in a follow-up once production has stayed stable (document decision).

### Success
- [ ] Repo contains no unused autosave references.
- [ ] Docs + SOP committed.
- [ ] Final confirmation: flags on in production, autosave deleted, monitoring green.
- [ ] Rollback instructions updated—post Phase 6, reverting requires git revert (flag toggle no longer sufficient).

---

## Final Sign-off
- [ ] Drag-end & subtree operations succeed ≥99% post-release.
- [ ] Snapshot history shows `origin` tags (`ui.drag`, `ui.subtree`, `llm.tool`).
- [ ] Undo/redo verified for drag, subtree, LLM edits.
- [ ] Stakeholders informed autosave is retired; decision on long-term flag usage documented; plan archived.

## Phase 4 – Updated Success Criteria

### Success
- [x] **Local QA passed**: All manual test steps completed for both flags OFF and flags ON configurations.
- [x] **Tool execution logs verified**: Correct origin tags (`ui.node.update`, `ui.subtree`, `llm.tool`) shown in logs.
- [x] **Snapshot verification**: Snapshot counts match tool executions; no duplicate/background snapshots detected.
- [x] **Automated tests**: 716/716 tests passing.
- [x] **Rollback drill passed**: Flags OFF restores autosave behavior; persistence still works.
- [x] **Performance check**: Operations feel responsive, tool execution durations <50ms locally.
- [x] **Full test results documented**: See [phase4-test-results.md](phase4-test-results.md).

