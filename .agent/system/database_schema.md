# Database Schema

Visual Scaffolding uses SQLite with Better-SQLite3 for synchronous database operations. The database file is located at `server/data/flow.db`.

## Database Configuration

- **Mode**: WAL (Write-Ahead Logging) for better concurrency
- **Foreign Keys**: Enabled
- **Migrations**: Located in `server/migrations/`
- **Test Mode**: Uses `:memory:` database via `DB_PATH` env var

## Tables

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
    {
      "id": "login",
      "type": "default",
      "position": {"x": 0, "y": 0},
      "data": {
        "label": "Login",
        "description": "User authentication page"
      }
    }
  ],
  "edges": [
    {
      "id": "1234567890_abc123",
      "source": "login",
      "target": "home",
      "data": {"label": "success"}
    }
  ]
}
```

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

**Tool Calls Structure:**
```json
[
  {
    "id": "toolu_01A09q90qw90lq917835lq9",
    "name": "addNode",
    "params": {
      "label": "Login",
      "description": "User authentication page"
    }
  }
]
```

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
  current_index INTEGER NOT NULL DEFAULT -1
);

INSERT OR IGNORE INTO undo_state (id, current_index) VALUES (1, -1);
```

**Fields:**
- `id` - Always 1 (enforced by CHECK constraint)
- `current_index` - ID of current snapshot in `undo_history`, or -1 if no snapshots

**State Management:**
- `-1` = No snapshots exist yet
- `N` = Currently at snapshot with `undo_history.id = N`
- When new snapshot added, `current_index` updated to new snapshot ID
- On undo, decremented to previous ID
- On redo, incremented to next ID
- On truncate (new change after undo), future snapshots deleted

**Undo/Redo Logic:**
```javascript
// Can undo if current_index > 1
canUndo = current_index > 1

// Can redo if current position is not at the latest snapshot
canRedo = totalSnapshots > 0 && current_index < maxId
```

## Data Flow

### Saving Flow Data
1. User modifies canvas or AI executes tools
2. Frontend debounces for 500ms
3. `POST /api/flow` called
4. `saveFlow()` upserts to `flows` table
5. `pushSnapshot()` creates undo snapshot
6. Snapshot deduplicated/truncated as needed

### Loading Flow Data
1. Frontend calls `GET /api/flow` on mount
2. `getFlow()` reads from `flows` table
3. Returns `{nodes: [], edges: []}` or empty flow if not found
4. Frontend initializes React Flow with data

### LLM Message Processing
1. User sends message via `POST /api/conversation/message`
2. `addUserMessage()` saves to `conversation_history`
3. `buildLLMContext()` loads:
   - Last 6 interactions from `conversation_history`
   - Current flow from `flows`
   - System prompt and tool definitions
4. LLM responds with tool calls
5. Tools executed, flow updated in `flows`
6. `addAssistantMessage()` saves response to `conversation_history`
7. If tools fail, retry message added and cycle repeats (max 3 times)

### Undo/Redo Flow
1. User presses ⌘Z or calls `POST /api/flow/undo`
2. `undo()` reads `undo_state.current_index`
3. Decrements index and retrieves snapshot from `undo_history`
4. `writeFlow()` restores snapshot to `flows` (with `skipSnapshot=true`)
5. Frontend receives restored flow and updates canvas
6. Redo works similarly but increments index

## Migration History

### 001_initial.sql
- Initial schema creation
- Migrated from JSON file storage (`server/data/flow-data.json`)
- Created all four tables
- Established indexes and constraints

**Migration applied automatically on server startup** via `db.js`:
```javascript
const schema = readFileSync(join(__dirname, 'migrations', '001_initial.sql'), 'utf-8');
db.exec(schema);
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
