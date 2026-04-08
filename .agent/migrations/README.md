# Supabase Migrations

This directory documents the Supabase migrations applied via MCP.

## Applied Migrations

### 20251021070648 - create_flows_table
- Created `flows` table with BIGSERIAL id, JSONB data column
- Added index: idx_flows_user_name
- UNIQUE constraint on (user_id, name)

### 20251021070701 - create_undo_history_table
- Created `undo_history` table with BIGSERIAL id, JSONB snapshot
- Added GIN index on snapshot

### 20251021070712 - create_undo_state_table
- Created `undo_state` table with CHECK constraint (id = 1)
- Singleton table for undo state tracking

### 20251021070725 - create_conversation_history_table
- Created `conversation_history` table with role CHECK constraint
- JSONB tool_calls column (nullable)
- Indexes on timestamp and tool_calls (GIN)

### 20251021191600 - create_notes_table
- Created `notes` table with INTEGER PRIMARY KEY (singleton pattern, CHECK id = 1)
- JSONB columns for bullets and conversation_history
- Seeded with empty arrays
- RLS enabled with allow-all policy (matches existing table security)

## Notes

Migrations are managed directly in Supabase via MCP tools. This file documents what was applied for reference.
