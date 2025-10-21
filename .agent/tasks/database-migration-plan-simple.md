# SQLite → Supabase Migration Plan

## TL;DR

**What:** Convert from synchronous SQLite to async PostgreSQL (Supabase)
**Why:** Better scalability, cloud-native, already have MCP connection
**Main Challenge:** Converting sync code to async across 50+ files
**Time:** 8-11 hours (mostly mechanical async conversion work)
**Risk:** Low (minimal data, good test coverage, easy rollback)

---

## Current State

```
Database: SQLite (server/data/flow.db, ~4.4MB, 4 records)
Driver: better-sqlite3 (synchronous)
Tables: 4 (flows, conversation_history, undo_history, undo_state)
Code: 15 DB functions, 42 test files, ~15 API endpoints (all synchronous)
```

## Target State

```
Database: PostgreSQL via Supabase (already connected via MCP)
Driver: @supabase/supabase-js (asynchronous)
Tables: Same 4 tables, different types (JSONB, BIGSERIAL, TIMESTAMPTZ)
Code: Everything needs async/await
```

---

## Strategy: Dual-Database Approach

**Don't replace SQLite immediately. Run both in parallel.**

### Why?
- Instant rollback (flip one environment variable)
- Can verify both return identical results
- Test Supabase while keeping SQLite working
- Much safer than big-bang cutover

### How?
```
server/
  db.js              → Router: checks USE_SUPABASE env var
  db-sqlite.js       → Current SQLite code (rename current db.js)
  db-supabase.js     → New Supabase implementation
  supabase-client.js → Supabase connection setup
```

Environment variable controls which database:
```bash
USE_SUPABASE=false  → SQLite (default, safe)
USE_SUPABASE=true   → Supabase (test mode)
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

**Note:** Only 4 records to migrate, very safe

---

### Phase 3: Dual-DB Layer (1-2 hours)
**What:** Create abstraction layer supporting both databases

**How:**
1. Rename `server/db.js` → `server/db-sqlite.js`
2. Create `server/supabase-client.js` (connection)
3. Create `server/db-supabase.js` (async versions of all 15 functions)
4. Create new `server/db.js` (router based on `USE_SUPABASE`)
5. Audit every `./db.js` import and make callers await the helpers (`server/app.js`, `server/conversationService.js`, `server/historyService.js`, `server/tools/executor.js`, LLM services, ~40 test files)
6. Update service wrappers that already use `async` (`historyService`, `conversationService`, Express routes) to `await` DB calls so errors propagate properly

**Pattern:**
```javascript
// db.js (router)
const USE_SUPABASE = process.env.USE_SUPABASE === 'true';
const dbModule = USE_SUPABASE
  ? await import('./db-supabase.js')
  : await import('./db-sqlite.js');
export const { getFlow, saveFlow, ... } = dbModule;
```

**Key conversion pattern:**
```javascript
// SQLite (sync)
export function getFlow(userId, name) {
  const row = db.prepare('SELECT...').get(userId, name);
  return row ? JSON.parse(row.data) : null;
}

// Supabase (async)
export async function getFlow(userId, name) {
  const { data, error } = await supabase
    .from('flows')
    .select('data')
    .eq('user_id', userId)
    .eq('name', name)
    .single();

  if (error?.code === 'PGRST116') return null; // Not found
  if (error) throw error;
  return data?.data || null;
}
```

---

### Phase 4: Test Infrastructure (1 hour)
**What:** Make tests work with both databases

**How:**
1. Create new `tests/test-db-setup.js` helper (doesn't exist yet)
2. For SQLite: keep using `:memory:` (existing behavior)
3. For Supabase: implement truncate helper using service-role key and call it in beforeEach/afterEach
4. Add npm scripts: `test:supabase`, `test:both`

**Key point:** Tests can run against either database to verify equivalence

---

### Phase 5: Unit Test Migration (2-3 hours)
**What:** Convert 42 test files to async/await

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

**Verify:** Run `npm test` (SQLite) and `npm run test:supabase` (Supabase)

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
- Test with `USE_SUPABASE=true npm run server`

---

### Phase 7: Integration Testing (1-2 hours)
**What:** Verify both databases return identical results

**Tests:**
- Unit tests pass on both ✓
- API tests pass on both ✓
- Integration tests pass on both ✓
- Manual testing (create/edit/delete/undo) ✓
- Performance acceptable ✓

**Create comparison test:**
```javascript
// Save same data to both, verify results match
const sqliteResult = saveFlow(data); // sync
const supabaseResult = await saveFlow(data); // async
expect(sqliteResult).toEqual(supabaseResult);
```

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
1. Verify all tests pass with `USE_SUPABASE=true`
2. Update `.env`: `USE_SUPABASE=true`
3. Archive SQLite files for rollback safety
4. Simplify: rename `db-supabase.js` → `db.js`, remove router
5. Uninstall: `npm uninstall better-sqlite3`
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
# Switch back to SQLite
USE_SUPABASE=false

# Tests still pass with SQLite
npm test
```

### After Cutover (Phase 9)
```bash
# Restore archived SQLite files
cp -r archive/sqlite-backup-*/. server/

# Reinstall
npm install better-sqlite3

# Revert code
git revert HEAD

# Switch env
USE_SUPABASE=false
```

**Data is safe:** Both databases have same data, can restore from either.

---

## Success Criteria

- [ ] All 4 tables exist in Supabase
- [ ] All data migrated (counts match)
- [ ] All tests pass on both SQLite and Supabase
- [ ] Both databases return identical results
- [ ] Manual testing shows no regressions
- [ ] Documentation updated
- [ ] Rollback procedure works

---

## Getting Started

### Prerequisites
1. Backup database: `cp server/data/flow.db server/data/flow.db.backup`
2. Create feature branch: `git checkout -b feat/migrate-to-supabase`
3. Get Supabase service role key (for SUPABASE_SERVICE_ROLE_KEY env var)

### First Step
Say to Claude: **"Start Phase 1: Apply the schema migration to Supabase via MCP"**

### During Migration
- Test frequently: `npm test` and `npm run test:supabase`
- Commit after each phase
- Keep SQLite working until Phase 9


---

## Resources

**MCP Tools:** `apply_migration`, `execute_sql`, `list_tables`, `get_project_url`, `get_anon_key`

**Supabase Connection:**
- URL: https://wcmiprucvjrjhfnrtfas.supabase.co
- Already authenticated via MCP

**Code References:**
- Schema: `.agent/system/database_schema.md`
- Current DB: `server/db.js` (will become `db-sqlite.js`)
- Tests: `tests/db.test.js` (start here)
