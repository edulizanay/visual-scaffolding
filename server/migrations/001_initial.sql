-- Initial schema for SQLite database
-- Migrates from JSON file storage to relational tables

-- Flows table: Stores flow graphs (nodes + edges as JSON)
-- Supports multiple flows per user for future multi-graph feature
CREATE TABLE IF NOT EXISTS flows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL DEFAULT 'default',
  name TEXT NOT NULL DEFAULT 'main',
  data JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, name)
);

-- Index for fast user+name lookups
CREATE INDEX IF NOT EXISTS idx_flows_user_name ON flows(user_id, name);

-- Conversation history: Stores all LLM interactions
CREATE TABLE IF NOT EXISTS conversation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tool_calls JSON,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Undo history: Stores flow snapshots for undo/redo
CREATE TABLE IF NOT EXISTS undo_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  snapshot JSON NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Undo state: Tracks current position in undo history
-- Single-row table (id=1) to store current index
CREATE TABLE IF NOT EXISTS undo_state (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  current_index INTEGER NOT NULL DEFAULT -1
);

-- Initialize undo_state with default row
INSERT OR IGNORE INTO undo_state (id, current_index) VALUES (1, -1);

-- Visual settings: Stores persisted styling & layout configuration
CREATE TABLE IF NOT EXISTS visual_settings (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  data JSON NOT NULL DEFAULT '{}',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Initialize visual_settings with empty overrides
INSERT OR IGNORE INTO visual_settings (id, data) VALUES (1, '{}');
