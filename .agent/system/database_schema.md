# Database Schema

Visual Scaffolding uses SQLite with Better-SQLite3 for synchronous database operations. The database file is located at `server/data/flow.db`.

## Database Configuration

- **Mode**: WAL (Write-Ahead Logging) for better concurrency
- **Foreign Keys**: Enabled
- **Migrations**: Located in `server/migrations/`
- **Test Mode**: Uses `:memory:` database via `DB_PATH` env var

## Tables (4 total)

The database contains 4 tables after the removal of `visual_settings` in migration 002.

### flows

Stores flow graph data (nodes and edges) as JSON.

```sql
CREATE TABLE flows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL DEFAULT 'main',
  data JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

CREATE INDEX idx_flows_user_name ON flows(user_id, name);
```

**Fields:**
- `id` - Auto-incrementing primary key
- `user_id` - User identifier (currently always 'default')
- `name` - Flow name (currently always 'main')
- `data` - JSON object containing `{nodes: [], edges: []}`
- `created_at` - Timestamp of first creation
- `updated_at` - Timestamp of last update

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
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tool_calls JSON,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Fields:**
- `id` - Auto-incrementing primary key
- `role` - Either 'user' or 'assistant'
- `content` - Message text (user request or LLM response)
- `tool_calls` - JSON array of tool calls (for assistant messages only)
- `timestamp` - Message timestamp

**API Functions:**
- `addConversationMessage(role, content, toolCalls)` - Add message
- `getConversationHistory(limit)` - Get last N interaction pairs (limit * 2 messages)
- `clearConversationHistory()` - Delete all messages

**Usage Notes:**
- When building LLM context, only last 6 interactions are included
- Debug endpoint returns full history
- Retry messages are added as 'user' role

### undo_history

Stores flow snapshots for undo/redo functionality.

```sql
CREATE TABLE undo_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Fields:**
- `id` - Auto-incrementing primary key (used as snapshot index)
- `snapshot` - Complete flow state JSON (same format as `flows.data`)
- `created_at` - Snapshot timestamp

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
  current_snapshot_time TIMESTAMPTZ DEFAULT NULL
);

INSERT OR IGNORE INTO undo_state (id, current_snapshot_time) VALUES (1, NULL);
```

**Fields:**
- `id` - Always 1 (enforced by CHECK constraint)
- `current_snapshot_time` - Timestamp of current snapshot in `undo_history`, or NULL if no snapshots

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

### 001_initial.sql
- Initial schema creation
- Migrated from JSON file storage (`server/data/flow-data.json`)
- Created all tables including flows, conversation_history, undo_history, undo_state, visual_settings
- Established indexes and constraints

### 002_remove_visual_settings.sql
- Removed visual_settings table (simplified from dynamic customization to hardcoded theme)
- Theme constants now maintained in frontend (`src/constants/theme.js`)
- Reduced table count from 5 to 4

**Migrations applied automatically on server startup** via `db.js`:
```javascript
// Migrations run in order on every server start
const migration001 = readFileSync(join(__dirname, 'migrations', '001_initial.sql'), 'utf-8');
db.exec(migration001);

const migration002 = readFileSync(join(__dirname, 'migrations', '002_remove_visual_settings.sql'), 'utf-8');
db.exec(migration002);
```

## Performance Considerations

- **WAL Mode**: Allows concurrent reads during writes
- **Index on flows(user_id, name)**: Fast flow lookups
- **UNIQUE constraint**: Prevents duplicate flows
- **Snapshot limit**: Prevents unbounded growth of undo history
- **Conversation limit**: Only last 6 interactions sent to LLM (but all stored)
- **Synchronous operations**: Better-SQLite3 uses sync API, simpler than async
- **Deduplication**: Reduces redundant snapshots

## Testing

All tests use in-memory database:
```javascript
process.env.DB_PATH = ':memory:';
```

Each test file:
1. Imports `closeDb` from `db.js`
2. Calls `closeDb()` in `afterEach` to ensure clean state
3. Schema automatically re-created on next `getDb()` call

See `tests/db.test.js` for comprehensive database layer tests.
