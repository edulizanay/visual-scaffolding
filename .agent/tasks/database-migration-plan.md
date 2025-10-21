# SQLite → Supabase Migration Plan

## TL;DR

**What:** Convert from synchronous SQLite to async PostgreSQL (Supabase)
**Why:** Better scalability, cloud-native, already have MCP connection
**Main Challenge:** Converting sync code to async across 50+ files
**Time:** 8-11 hours (mostly mechanical async conversion work)
**Risk:** Low (minimal data, good test coverage, easy rollback)
**Approach:** Direct cutover with SQLite backup for rollback

---

## Current State

```
Database: SQLite (server/data/flow.db, ~0.5MB, 5 records)
Driver: better-sqlite3 (synchronous)
Tables: 4 (flows, conversation_history, undo_history, undo_state)
Code: 15 DB helpers, 39 test files, ~15 API endpoints (all synchronous)
```

## Target State

```
Database: PostgreSQL via Supabase (already connected via MCP)
Driver: @supabase/supabase-js (asynchronous)
Tables: Same 4 tables, different types (JSONB, BIGSERIAL, TIMESTAMPTZ)
Code: Everything needs async/await
```

---

## Strategy: Direct Cutover (Single Switch)

**Replace the SQLite adapter in place while keeping the `.db` file for rollback.**

### Why?
- Only 5 records to migrate—duplicating the adapter adds complexity with little benefit.
- Keeps the codebase simpler (no conditional imports, no runtime toggles).
- Rollback remains easy: restore the backup file and revert the Git changes.

### How?
```
server/
  db.js              → Replace SQLite logic with Supabase client + async helpers
  supabase-client.js → Supabase connection setup (new)
```

Environment must provide:
```bash
SUPABASE_URL=<project url>
SUPABASE_ANON_KEY=<anon key for app + tests>
SUPABASE_SERVICE_ROLE_KEY=<service role for data migration + cleanup>
```

---

## The Work (9 Phases)

### Phase 1: Schema Migration (15 min)
**What:** Create PostgreSQL tables in Supabase via MCP

**How:** Ask Claude to use `apply_migration` MCP tool with the schema SQL (provided in plan)

**Key differences:**
- `INTEGER AUTOINCREMENT` → `BIGSERIAL`
- `JSON` text → `JSONB` binary
- `DATETIME` → `TIMESTAMPTZ`
- Add GIN indexes for JSONB

**Verify:** Use `list_tables` MCP tool

---

### Phase 2: Data Migration (15 min)
**What:** Export SQLite data, import to Supabase

**How:**
1. Write quick export script (e.g. `scripts/export-sqlite.js`) to dump all four tables to `migration-data.json`
2. Run the script to generate `migration-data.json`
3. Ask Claude to import via MCP `execute_sql` tool
4. Verify row counts match

**Note:** Only 5 rows to migrate across all tables—very safe

---

### Phase 3: Supabase Adapter (1-2 hours)
**What:** Convert the existing database helpers to Supabase (no runtime toggle).

**How:**
1. Add `server/supabase-client.js` that exports a singleton Supabase client using env vars.
2. Refactor every export in `server/db.js` to call Supabase APIs instead of `better-sqlite3`.
3. Ensure helpers return plain JS objects (Supabase already gives JSON) and throw on unexpected errors.
4. Remove synchronous logic (transactions, `.prepare()`, `.run()`) and replace with async equivalents.
5. Update all call sites (`server/app.js`, `server/historyService.js`, `server/conversationService.js`, `server/tools/executor.js`, tests, etc.) to `await` the new async helpers.

**Key conversion pattern:**
```javascript
// Before (SQLite sync)
export function getFlow(userId = 'default', name = 'main') {
  const row = db.prepare('SELECT data FROM flows WHERE user_id = ? AND name = ?').get(userId, name);
  return row ? JSON.parse(row.data) : null;
}

// After (Supabase async)
export async function getFlow(userId = 'default', name = 'main') {
  const { data, error } = await supabase
    .from('flows')
    .select('data')
    .eq('user_id', userId)
    .eq('name', name)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') throw error;
  return data?.data ?? null;
}
```

---

### Phase 4: Test Infrastructure (1 hour)
**What:** Make the test suite Supabase-aware

**How:**
1. Create new `tests/test-db-setup.js` helper (doesn't exist yet)
2. Use service-role key to implement truncate helpers for all four tables
3. Ensure `beforeEach`/`afterEach` hooks await cleanup
4. Provide a shared factory for seeding minimal flow/conversation data

**Key point:** Tests should run reliably against Supabase without lingering data

---

### Phase 5: Unit Test Migration (2-3 hours)
**What:** Convert 39 test files to async/await

**Pattern:**
```javascript
// Before
it('should save flow', () => {
  saveFlow(data);
  const result = getFlow();
  expect(result).toBeDefined();
});

// After
it('should save flow', async () => {
  await saveFlow(data);
  const result = await getFlow();
  expect(result).toBeDefined();
});
```

**Strategy:**
1. Start with `tests/db.test.js` (core DB layer)
2. Then API tests
3. Then integration tests
4. Finally unit tests

**Common mistakes:**
- Forgetting `await` (causes silent failures)
- Async forEach (use Promise.all instead)
- Not awaiting in beforeEach/afterEach

**Verify:** Run `npm test` (with Supabase client configured)

---

### Phase 6: API Endpoint Updates (1-2 hours)
**What:** Make all Express routes async

**Pattern:**
```javascript
// Before
app.post('/api/flow/save', (req, res) => {
  saveFlow(req.body);
  res.json({ success: true });
});

// After
app.post('/api/flow/save', async (req, res) => {
  try {
    await saveFlow(req.body);
    res.json({ success: true });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

**Key points:**
- Add try/catch to every async endpoint
- Handle Supabase error codes (PGRST116 = not found)
- Boot app with Supabase credentials loaded (`npm run server`)

---

### Phase 7: Integration Testing (1-2 hours)
**What:** Verify the application works end-to-end on Supabase

**Tests:**
- Unit tests pass (`npm test`) ✓
- API tests hit Supabase successfully ✓
- Integration tests cover critical flows ✓
- Manual testing (create/edit/delete/undo) ✓
- Performance acceptable ✓

---

### Phase 8: Documentation (1 hour)
**What:** Update .agent docs and README

**Files:**
- `.agent/system/database_schema.md` - Update to PostgreSQL
- `.agent/system/project_architecture.md` - Add Supabase section
- `.agent/SOP/adding-persistence-actions.md` - Async patterns
- `README.md` - Setup instructions + env vars
- Mark this migration plan complete

---

### Phase 9: Cutover & Cleanup (30 min)
**What:** Switch to Supabase, remove SQLite

**Steps:**
1. Verify all tests pass with Supabase credentials loaded
2. Archive `server/data/flow.db` (retain `.backup` copy)
3. Remove unused SQLite helpers (migrate scripts, sync-only utils)
4. Uninstall: `npm uninstall better-sqlite3`
5. Ensure `.env` / `.env.example` list required Supabase variables
6. Commit migration

---

## Critical Gotchas

### 1. Async Propagation
Every function that calls a DB function must become async. This ripples up through the entire call stack.

### 2. JSON Handling
SQLite stores JSON as TEXT strings. Supabase JSONB expects objects. Already handled in export script.

### 3. Sequence Reset
After importing data with explicit IDs, call `reset_sequences()` function (included in schema migration).

### 4. Error Codes
Map Supabase errors to SQLite behavior:
- `PGRST116` → return `null` (not found)
- Other errors → throw

### 5. Test Cleanup
Supabase isn't in-memory. Use helper to delete all rows before/after tests.

### 6. Timestamps
Use `new Date().toISOString()` everywhere for timezone consistency.

---

## Rollback Plan

### During Migration (Phases 1-8)
```bash
# Restore SQLite adapter (if changes not committed)
git checkout -- server/db.js server/supabase-client.js

# Restore local database
cp server/data/flow.db.backup server/data/flow.db

# Ensure dependencies installed
npm install
```

### After Cutover (Phase 9)
```bash
# Restore archived SQLite files
cp server/data/flow.db.backup server/data/flow.db

# Reinstall SQLite driver
npm install better-sqlite3

# Revert code
git revert HEAD
```

**Data is safe:** Keep the SQLite backup and Supabase export so either path can be restored quickly.

---

## Success Criteria

- [ ] All 4 tables exist in Supabase
- [ ] All data migrated (counts match)
- [ ] Automated tests pass with Supabase backend
- [ ] Manual verification (create/edit/delete/undo) succeeds
- [ ] Documentation updated
- [ ] Rollback procedure verified (SQLite backup + reinstall instructions)

---

## Getting Started

### Prerequisites
1. Backup database: `cp server/data/flow.db server/data/flow.db.backup`
2. Create feature branch: `git checkout -b feat/migrate-to-supabase`
3. Get Supabase service role key (for SUPABASE_SERVICE_ROLE_KEY env var)

### First Step
Say to Claude: **"Start Phase 1: Apply the schema migration to Supabase via MCP"**

### During Migration
- Test frequently: `npm test`
- Commit after each phase
- Keep the SQLite backup (`flow.db.backup`) untouched until cutover completes


---

## Resources

**MCP Tools:** `apply_migration`, `execute_sql`, `list_tables`, `get_project_url`, `get_anon_key`

**Supabase Connection:**
- URL: https://wcmiprucvjrjhfnrtfas.supabase.co
- Already authenticated via MCP

**Code References:**
- Schema: `.agent/system/database_schema.md`
- Database adapter: `server/db.js`
- Supabase client (new): `server/supabase-client.js`
- Tests: `tests/db.test.js` (start here)
