-- Convert undo_state from ID-based to timestamp-based navigation
-- Eliminates dependency on consecutive auto-increment IDs

-- Step 1: Add new column
ALTER TABLE undo_state ADD COLUMN current_snapshot_time TEXT DEFAULT NULL;

-- Step 2: Backfill existing state to most recent snapshot timestamp (if any)
UPDATE undo_state
SET current_snapshot_time = (
  SELECT created_at FROM undo_history
  ORDER BY created_at DESC
  LIMIT 1
)
WHERE id = 1 AND current_index > 0;

-- Step 3: Drop old column (SQLite doesn't support DROP COLUMN before 3.35.0)
-- We'll keep current_index for backwards compatibility but stop using it
-- Mark it as deprecated by setting to NULL
UPDATE undo_state SET current_index = NULL WHERE id = 1;

-- Note: In production, the old current_index column remains but is unused
-- This allows gradual migration of any external tools that might read it
