# Backend Save Funnel – Checklist Plan

> Updated: 2025‑10‑20  
> Source PRD: [.agent/analysis/saving-logic-analysis.md](../analysis/saving-logic-analysis.md)

Use this checklist to drive the migration. Work through phases in order, on a dedicated branch per phase. Leave all feature flags defaulted to `false` on `main`. Do not merge a phase until every item in that phase is checked and its success criteria are met.

---

## 0. Working Agreements
- [ ] Create feature branch `feature/backend-save-phase-1` from `main`.
- [ ] Confirm `ENABLE_BACKEND_DRAG_SAVE` and `ENABLE_BACKEND_SUBTREE` default to `false`.
- [ ] Define rollback: set flags to `false` and redeploy.
- [ ] Ensure CI commands (`npm test`, `npm run lint`, integration suites) run green before each merge.

---

## Phase 1 – Shared Utilities Lift & Shift
**Goal**: make subtree helpers reusable.

### Implementation
- [ ] Move the edge-based `getAllDescendants` (from `useFlowLayout`) into `shared/flowUtils/` (pure function, JSdoc); leave the parentGroupId variant in `groupUtils`.
- [ ] Move `collapseSubtreeByHandles` into `shared/flowUtils/`, returning `{ nodes, edges }` (no React state); keep frontend wrapper calling `commitFlow(result)`.
- [ ] Update frontend imports to use shared helpers.
- [ ] Add/adjust unit tests for shared functions (happy path + edge cases).

### Success
- [ ] Manual QA: Alt+collapse behaves exactly as before.
- [ ] `npm test` + `npm run lint` pass on branch.
- [ ] Merge branch back to `main` (flags still `false`).

---

## Phase 2 – Backend Plumbing
**Goal**: backend can collapse subtrees and record snapshot origin.

### Implementation
- [ ] Add `server/config.js` with environment flags (default `false`, env overridable).
- [ ] Extend history persistence to accept `origin` metadata inside the snapshot JSON payload (no schema migration required); ensure writes remain backward compatible.
- [ ] Tag existing executor outputs with appropriate origins (`llm.tool`, etc.).
- [ ] Implement `toggleSubtreeCollapse` executor using shared helper.
- [ ] Expose `PUT /api/flow/subtree`; frontend checks the flag to decide between local vs. backend path (route stays live).
- [ ] Add structured logging (tool, origin, nodeIds involved, duration, success/failure, error message/stack on failure).
- [ ] Add automated tests for new executor + route (success + failure).

### Success
- [ ] Manual API test: backend subtree collapse matches current frontend output.
- [ ] Database snapshot row shows `origin` column populated.
- [ ] CI suite passes.
- [ ] Merge to `main` (flags still `false`).

---

## Phase 3 – Frontend Dual-Run (Feature Flagged)
**Goal**: wire UI to backend while keeping autosave fallback.

### Implementation
- [ ] Under `ENABLE_BACKEND_DRAG_SAVE`, listen to `onNodesChange` entries where `change.type === 'position' && change.dragging === false`; call `updateNode({ position })` for each moved node.
- [ ] Capture original node positions at drag start (e.g., `onNodeDragStart` + `useRef`) so you can revert if the API fails.
- [ ] Use a `useRef` flag: set `lastChangeWasPositionalRef.current = true` immediately when the drag-end handler fires; clear it inside the autosave debounce once it runs so autosave skips only the matching positional change.
- [ ] Under `ENABLE_BACKEND_SUBTREE`, replace local Alt+collapse with backend endpoint call.
- [ ] On backend failure, revert **all** nodes involved in the gesture (even if only one call failed) or restore collapse state, and surface a toast; log the affected node IDs in the error.
- [ ] Tag drag-end snapshots with `origin: 'ui.drag'`.
- [ ] Add new integration test (e.g., `tests/integration/drag-end-save.test.js`) covering drag-end → API call → snapshot metadata.
- [ ] Add/adjust unit tests (drag handler, subtree action).

### Success
- [ ] Local/staging test with flags **off**: behaviour identical to pre-change.
- [ ] Local/staging test with flags **on**: drag-end & subtree persist correctly; logs show expected origin tags.
- [ ] No duplicate snapshots detected in DB/logs during testing; multi-node drags either succeed completely or revert.
- [ ] CI suite passes.
- [ ] Merge back to `main` (flags default `false`).

---

## Phase 4 – Validation & Monitoring
**Goal**: prove dual-run configuration is stable.

### Implementation
- [ ] Capture baseline metrics in staging with flags **off** (success %, latency, snapshot counts).
- [ ] Deploy to staging with both flags **on** (via env vars).
- [ ] Collect metrics ≥2 days: drag-end success %, latency; subtree success %.
- [ ] Run integration tests covering drag, collapse, LLM edits interleaved.
- [ ] Execute manual QA script (single/multi-node drag, collapse/expand, undo/redo, LLM edit).
- [ ] Document metrics + QA results.

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
