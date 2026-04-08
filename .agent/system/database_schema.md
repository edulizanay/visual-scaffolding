# Database Schema

Visual Scaffolding uses **Supabase (PostgreSQL)** for all database operations.

## Database Configuration

- **Database**: PostgreSQL 15+ via Supabase
- **Client**: `@supabase/supabase-js` SDK (async)
- **Connection**: Configured via environment variables (see `.env`)
- **Migrations**: Applied via Supabase MCP tools (documented in `.agent/migrations/README.md`)
- **Test Mode**: Uses dedicated Supabase test project with `setupTestDb()/cleanupTestDb()` helpers from `tests/test-db-setup.js`

## Tables (5 total)

The database contains 5 tables: flows, conversation_history, notes, undo_history, and undo_state.

### flows

Stores flow graph data (nodes and edges) as JSONB.

```sql
CREATE TABLE flows (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL DEFAULT 'main',
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

CREATE INDEX idx_flows_user_name ON flows(user_id, name);
```

**Fields:**
- `id` - Auto-incrementing primary key (BIGSERIAL)
- `user_id` - User identifier (currently always 'default')
- `name` - Flow name (currently always 'main')
- `data` - JSONB object containing `{nodes: [], edges: []}`
- `created_at` - Timestamp of first creation (TIMESTAMPTZ)
- `updated_at` - Timestamp of last update (TIMESTAMPTZ)

**Data Structure:**
```json
{
  "nodes": [
    {"id": "login", "type": "default", "position": {"x": 0, "y": 0}, "data": {"label": "Login"}},
    {"id": "auth_group", "type": "group", "isCollapsed": true, "data": {"label": "Auth"}},
    {"id": "signup", "type": "default", "parentGroupId": "auth_group", "data": {"label": "Signup"}}
  ],
  "edges": [
    {"id": "e1", "source": "login", "target": "home", "data": {"label": "success"}}
  ]
}
```

**Node Types:**
- `type: "default"` - Regular flow node
- `type: "group"` - Group container node (can contain other nodes via `parentGroupId`)

**Group-Related Fields:**
- `parentGroupId` - (Optional) ID of parent group node. If present, this node is a member of that group
- `isCollapsed` - (Optional, group nodes only) Boolean indicating if group is collapsed (true) or expanded (false)
- `hidden` - (Optional) Boolean indicating if node should be hidden (computed during visibility processing)
- `groupHidden` - (Optional) Boolean indicating if node is hidden because an ancestor group is collapsed

**API Functions:**
- `getFlow(userId, name)` - Retrieve flow data
- `saveFlow(flowData, userId, name)` - Upsert flow data
- `getFlowId(userId, name)` - Get flow ID

### conversation_history

Stores all LLM interactions (user messages and assistant responses).

```sql
CREATE TABLE conversation_history (
  id BIGSERIAL PRIMARY KEY,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tool_calls JSONB,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

**Fields:**
- `id` - Auto-incrementing primary key (BIGSERIAL)
- `role` - Either 'user' or 'assistant'
- `content` - Message text (user request or LLM response)
- `tool_calls` - JSONB array of tool calls (for assistant messages only)
- `timestamp` - Message timestamp (TIMESTAMPTZ)

**API Functions:**
- `addConversationMessage(role, content, toolCalls)` - Add message
- `getConversationHistory(limit)` - Get last N interaction pairs (limit * 2 messages)
- `clearConversationHistory()` - Delete all messages

**Usage Notes:**
- When building LLM context, only last 6 interactions are included
- Debug endpoint returns full history
- Retry messages are added as 'user' role

### notes

Stores notes panel data (bullets and conversation history) in a singleton pattern.

```sql
CREATE TABLE notes (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  bullets JSONB NOT NULL DEFAULT '[]',
  conversation_history JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO notes (id, bullets, conversation_history)
VALUES (1, '[]', '[]')
ON CONFLICT DO NOTHING;

ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all operations on notes"
  ON notes FOR ALL
  USING (true) WITH CHECK (true);
```

**Fields:**
- `id` - Always 1 (singleton table enforced by CHECK constraint)
- `bullets` - JSONB array of note strings
- `conversation_history` - JSONB array of LLM interactions (same format as conversation_history table)
- `created_at` - Timestamp of first creation (TIMESTAMPTZ)
- `updated_at` - Timestamp of last update (TIMESTAMPTZ)

**Data Structure:**
```json
{
  "bullets": [
    "Build authentication system",
    "Create user registration flow",
    "Add password reset functionality"
  ],
  "conversation_history": [
    {
      "role": "user",
      "content": "I want to build a login system",
      "timestamp": "2025-10-21T10:00:00Z"
    },
    {
      "role": "assistant",
      "content": "Here are the key steps...",
      "timestamp": "2025-10-21T10:00:01Z"
    }
  ]
}
```

**API Functions:**
- `getNotes()` - Retrieve notes with graceful empty state fallback
- `saveNotes(bullets, conversationHistory)` - Upsert notes data
- `updateBullets(bullets)` - Update bullets while preserving conversation history

**Usage Notes:**
- Singleton pattern ensures only one notes record exists
- Upsert operations handle first-run scenarios gracefully
- Conversation history stored separately from main conversation_history table
- RLS policy allows all operations (single-user application)

### undo_history

Stores flow snapshots for undo/redo functionality.

```sql
CREATE TABLE undo_history (
  id BIGSERIAL PRIMARY KEY,
  snapshot JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_undo_history_created_at ON undo_history(created_at);
```

**Fields:**
- `id` - Auto-incrementing primary key (BIGSERIAL; note: may have gaps after deletions)
- `snapshot` - Complete flow state JSONB (same format as `flows.data`)
- `created_at` - Snapshot timestamp (TIMESTAMPTZ; used for timestamp-based navigation)

**Snapshot Management:**
- Maximum 50 snapshots retained
- Oldest snapshots deleted when limit exceeded
- Snapshots deduplicated (identical states skipped)
- Position-only changes update existing snapshot instead of creating new one

**API Functions:**
- `pushUndoSnapshot(flowData)` - Add snapshot with deduplication
- `undo()` - Return previous snapshot
- `redo()` - Return next snapshot
- `getUndoStatus()` - Get availability and counts
- `clearUndoHistory()` - Delete all snapshots
- `initializeUndoHistory(flowData)` - Clear and set initial state

### undo_state

Single-row table tracking current position in undo history.

```sql
CREATE TABLE undo_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_snapshot_time TIMESTAMPTZ DEFAULT NULL,
  current_index BIGINT DEFAULT NULL  -- DEPRECATED: Use current_snapshot_time instead
);

INSERT INTO undo_state (id, current_snapshot_time, current_index)
VALUES (1, NULL, NULL)
ON CONFLICT DO NOTHING;
```

**Fields:**
- `id` - Always 1 (enforced by CHECK constraint)
- `current_snapshot_time` - Timestamp of current snapshot in `undo_history`, or NULL if no snapshots
- `current_index` - **DEPRECATED** (kept for backwards compatibility, always NULL)

**State Management:**
- `NULL` = No snapshots exist yet
- `<timestamp>` = Currently at snapshot with `undo_history.created_at = <timestamp>`
- When new snapshot added, `current_snapshot_time` updated to new snapshot's `created_at`
- On undo, set to previous snapshot's `created_at` (found via `WHERE created_at < current_snapshot_time ORDER BY created_at DESC LIMIT 1`)
- On redo, set to next snapshot's `created_at` (found via `WHERE created_at > current_snapshot_time ORDER BY created_at ASC LIMIT 1`)
- On truncate (new change after undo), snapshots with `created_at > current_snapshot_time` are deleted

**Undo/Redo Logic:**
- Can undo if there exists a snapshot with `created_at < current_snapshot_time`
- Can redo if there exists a snapshot with `created_at > current_snapshot_time`
- Uses timestamp-based navigation instead of sequential IDs to handle PostgreSQL auto-increment gaps

## Data Flow

**Save**: User changes → Debounce 500ms → `saveFlow()` upserts → `pushSnapshot()` creates undo snapshot

**Load**: `getFlow()` reads flows → Frontend applies theme → `applyGroupVisibility()` computes synthetic edges

**LLM**: User message → Save to conversation_history → Build context (last 6 interactions + flow + tools) → Execute tools → Update flows → Save response

**Undo/Redo**: Read `undo_state.current_index` → Fetch snapshot from `undo_history` → Restore to flows

## Migration History

All migrations applied via Supabase MCP tools. See [.agent/migrations/README.md](../migrations/README.md) for details.

**Applied Migrations:**
- **20251021070648** - create_flows_table (JSONB data, indexes)
- **20251021070701** - create_undo_history_table (JSONB snapshot, GIN index)
- **20251021070712** - create_undo_state_table (singleton with CHECK constraint)
- **20251021070725** - create_conversation_history_table (role CHECK, JSONB tool_calls)
- **20251021191600** - create_notes_table (singleton pattern, RLS enabled)

## Performance Considerations

- **JSONB storage**: Native PostgreSQL indexing and querying for complex data
- **GIN indexes**: Fast queries on JSONB fields (`data`, `snapshot`, `tool_calls`)
- **Index on flows(user_id, name)**: Fast flow lookups via composite key
- **UNIQUE constraint**: Prevents duplicate flows
- **Snapshot limit**: Prevents unbounded growth of undo history (50 max)
- **Conversation limit**: Only last 6 interactions sent to LLM (but all stored)
- **Timestamp-based navigation**: Handles BIGSERIAL gaps in undo/redo operations
- **Deduplication**: Reduces redundant snapshots via `stableStringify()` comparison

## Testing

See [test_suite.md](./test_suite.md) and [writing-tests.md](../SOP/writing-tests.md) for testing details.
