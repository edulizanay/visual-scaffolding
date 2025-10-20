# Structure Migration TODO

Track these items as individual PRs where possible. Keep PR scope to a single domain or feature to minimize conflicts.

---

## Phase 0 – Prep

- [x] Share `STRUCTURE_REVIEW.md` and this TODO with the team.
- [x] Align on branch etiquette (short-lived feature branches, single-domain PRs).
- [x] Confirm CI runs `npm test` for every PR.
- [ ] Optional: add an ESLint rule or checklist entry to enforce unit tests for new shared hooks.

Exit Check:
- [x] Team acknowledges plan and Safety Practices.
- [x] CI configuration confirmed (all 327 tests passing).
- [x] Commit (if needed): "chore: prepare structure migration".

---

## Phase 1 – Backend Foundations

### Step 1 – Extract `server/app.js`
- [x] Read `server/server.js` and copy the Express app creation + middleware into a new `server/app.js`.
- [x] Export the configured app from `server/app.js`.
- [x] Update `server/server.js` to import the app and keep only startup concerns (`listen`, logging, shutdown hooks).
- [x] Run tests: `npm test`.
- [x] Manual smoke: `npm start` to ensure the server boots.

Success Criteria
- ✅ `server/app.js` exists and configures middleware, JSON parsing, CORS, etc.
- ✅ `server/server.js` 31 LOC (< 100) and only handles lifecycle.
- ✅ `npm test` is green (327 tests passing).
- ✅ Server starts without errors.

### Step 2 – Introduce `server/routes/index.js`
- [ ] Move all route registrations from `server/server.js` (or wherever they now live) into `server/routes/index.js`.
- [ ] Import and register that router from `server/app.js`.
- [ ] Verify there are no remaining `app.get/post/...` definitions in `server/server.js`.
- [ ] Run tests: `npm test`.

Success Criteria
- `server/routes/index.js` mounts every REST endpoint.
- `server/app.js` wires `routes/index.js`.
- `server/server.js` contains no routes or middleware.
- `npm test` is green.

### Step 3 – Split domain routers (can run in parallel)
Assign engineers by domain (`flow`, `notes`, `conversation`):
- [ ] Create `server/routes/<domain>Routes.js` per domain and move matching endpoints.
- [ ] Add lightweight service modules when logic exceeds ~100 LOC (e.g., `server/services/<domain>Service.js`).
- [ ] Ensure `server/routes/index.js` mounts the new router (`app.use('/api/flow', flowRoutes)` etc.).
- [ ] Run tests: `npm test` after each domain refactor.

Success Criteria
- Domain routers live under `server/routes/`.
- Business logic remains isolated to the same file hierarchy (no leaks back to `server/server.js`).
- `npm test` passes after each domain move.

### Phase 1 Exit Check
- [ ] `server/app.js` + `server/routes/index.js` exist and are in use.
- [ ] All domain routes live under `server/routes/<domain>Routes.js`.
- [ ] `server/server.js` contains only startup/shutdown code.
- [ ] `npm test` passes.
- [ ] Commit: “refactor: reorganize express app and routes”.

---

## Phase 2 – Frontend Feature Modules

### Step 0 – Extract shared hooks (foundation)
- [ ] Compare inline edit logic in `src/Node.jsx` and `src/Edge.jsx`.
- [ ] Move shared behavior into `src/shared/hooks/useInlineEdit.js`.
- [ ] Add tests at `src/shared/hooks/__tests__/useInlineEdit.test.js`.
- [ ] Update Node/Edge to consume the hook.
- [ ] Compare debounce logic in `src/App.jsx` and `src/NotesPanel.jsx`; extract `src/shared/hooks/useDebouncedCallback.js` with tests.
- [ ] Update consuming components to use shared hook.
- [ ] Optional: export `HOTKEYS` from `src/hooks/useHotkeys.jsx` and reuse in tests to remove duplication.
- [ ] Run tests: `npm test`.

Success Criteria
- Shared hooks live in `src/shared/hooks/` with unit tests (target >80% coverage).
- Inline edit & debounce logic no longer duplicated.
- `npm test` passes.

### Step 1 – Move flow canvas feature
- [ ] Create `src/features/flow-canvas/` with sub-folders (`components/`, `hooks/`, `utils/` as needed).
- [ ] Move Flow-specific components (Node, Edge, GroupHaloOverlay, React Flow container pieces).
- [ ] Add an `index.js` barrel to re-export public API.
- [ ] Update imports in the app/tests to use the new paths.
- [ ] Run targeted tests: `npm test -- --run tests/unit/frontend/Flow*.test.*` (or whole `npm test`).

Success Criteria
- No flow-specific components remain at `src/` root.
- Imports use `src/features/flow-canvas/...`.
- Tests pass.

### Step 2 – Move chat and notes features (parallelizable)
- [ ] Create `src/features/chat/` and move ChatInterface, Keyboard UI, chat-specific hooks/services.
- [ ] Create `src/features/notes/` and move NotesPanel + related helpers.
- [ ] Split `src/api.js` calls as you move features: `chatApi`, `notesApi`, etc., under `src/services/api/` (or under each feature if preferred).
- [ ] Provide temporary barrels to keep import paths stable while migrating.
- [ ] Update tests/imports; run `npm test`.

Success Criteria
- Chat and notes modules live under `src/features/chat/` and `src/features/notes/`.
- Legacy `src/api.js` is only referenced via temporary re-exports.
- Tests pass.

### Step 3 – Clean up API modules
- [ ] Finish extracting domain-specific API clients (`flowApi.js`, `groupApi.js`, `notesApi.js`, etc.).
- [ ] Create `src/services/api/index.js` for shared exports if needed.
- [ ] Replace all remaining imports from `src/api.js`.
- [ ] Delete `src/api.js`.
- [ ] Run tests: `npm test`.

Success Criteria
- `src/api.js` removed.
- All API imports reference domain-specific modules.
- Tests pass.

### Phase 2 Exit Check
- [ ] Flow/chat/notes features reside under `src/features/<domain>/`.
- [ ] Shared hooks sourced from `src/shared/hooks/`.
- [ ] Legacy imports (`./api`, root-level component paths) removed.
- [ ] `npm test` passes.
- [ ] Commit(s):
  - “refactor: extract shared frontend hooks”
  - “refactor: relocate flow/chat/notes features”
  - “refactor: split API clients by domain”

---

## Phase 3 – Quality Layer

### Step 1 – Co-locate unit tests
- [ ] Move relevant unit tests alongside source files (`Component.test.jsx` or `__tests__/Component.test.jsx`).
- [ ] Update Vitest config or imports if necessary.
- [ ] Run tests: `npm test`.

### Step 2 – Align integration/API tests
- [ ] Review `tests/api-*.test.js` and `tests/integration/` to ensure imports point to the new route/service locations.
- [ ] Run `npm test`.

### Step 3 – Documentation refresh
- [ ] Update README / internal docs to describe the feature-first layout and shared hooks.
- [ ] Confirm any internal tooling (e.g., agent docs) match the new structure.

Phase 3 Exit Check
- [ ] Unit tests sit next to source (or mirrored feature folders) with no stale paths.
- [ ] Integration/API suites pass and reference new modules.
- [ ] Documentation updated.
- [ ] `npm test` passes.
- [ ] Commit: “docs: update project structure references”.

---

## Final Verification

- [ ] Full test suite: `npm test`.
- [ ] Build: `npm run build`.
- [ ] Manual smoke (via `npm run dev`): check node/edge edits, grouping, chat messaging, notes panel, keyboard shortcuts.
- [ ] Ensure shared hooks behave correctly in the browser (inline edits, debounce).
- [ ] Confirm bundle size roughly unchanged.
- [ ] Review commit history for clean, conventional messages; squash if needed.
- [ ] Final merge commit: “refactor: complete structure migration”.
