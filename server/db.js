// ABOUTME: SQLite database connection and query helpers
// ABOUTME: Provides sync wrappers around better-sqlite3 for flow persistence

import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let db = null;

/**
 * Get or create database connection
 * Supports :memory: for tests via DB_PATH env var
 */
export function getDb() {
  if (!db) {
    const dbPath = process.env.DB_PATH || join(__dirname, 'data', 'flow.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL'); // Better concurrency
    db.pragma('foreign_keys = ON');

    // Run migrations
    const schema = readFileSync(join(__dirname, 'migrations', '001_initial.sql'), 'utf-8');
    db.exec(schema);
  }
  return db;
}

/**
 * Close database connection (for tests)
 */
export function closeDb() {
  if (db) {
    db.close();
    db = null;
  }
}

// ==================== Flow Operations ====================

/**
 * Get flow by user_id and name
 * Returns default empty flow if not found
 */
export function getFlow(userId = 'default', name = 'main') {
  const row = getDb()
    .prepare('SELECT data FROM flows WHERE user_id = ? AND name = ?')
    .get(userId, name);

  return row ? JSON.parse(row.data) : { nodes: [], edges: [] };
}

/**
 * Save flow data (upsert)
 * Creates new flow or updates existing one
 */
export function saveFlow(flowData, userId = 'default', name = 'main') {
  const data = JSON.stringify(flowData);

  getDb()
    .prepare(`
      INSERT INTO flows (user_id, name, data, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, name)
      DO UPDATE SET data = excluded.data, updated_at = CURRENT_TIMESTAMP
    `)
    .run(userId, name, data);
}

/**
 * Get flow ID for user+name (used by undo/redo)
 */
export function getFlowId(userId = 'default', name = 'main') {
  const row = getDb()
    .prepare('SELECT id FROM flows WHERE user_id = ? AND name = ?')
    .get(userId, name);

  return row ? row.id : null;
}

// ==================== Conversation Operations ====================

/**
 * Add message to conversation history
 */
export function addConversationMessage(role, content, toolCalls = null) {
  getDb()
    .prepare('INSERT INTO conversation_history (role, content, tool_calls) VALUES (?, ?, ?)')
    .run(role, content, toolCalls ? JSON.stringify(toolCalls) : null);
}

/**
 * Get conversation history
 * If limit provided, returns last N interaction pairs (limit * 2 messages)
 */
export function getConversationHistory(limit = null) {
  let query = 'SELECT * FROM conversation_history ORDER BY id ASC';

  const allRows = getDb().prepare(query).all();

  // Apply limit (limit is interaction pairs, so multiply by 2 for messages)
  let rows = allRows;
  if (limit) {
    const messageLimit = limit * 2;
    if (allRows.length > messageLimit) {
      rows = allRows.slice(-messageLimit);
    }
  }

  return rows.map(row => ({
    role: row.role,
    content: row.content,
    toolCalls: row.tool_calls ? JSON.parse(row.tool_calls) : [],
    timestamp: row.timestamp
  }));
}

/**
 * Clear all conversation history
 */
export function clearConversationHistory() {
  getDb().prepare('DELETE FROM conversation_history').run();
}

// ==================== Undo/Redo Operations ====================

/**
 * Push snapshot to undo history
 * Handles deduplication and truncation
 */
export function pushUndoSnapshot(flowData) {
  const db = getDb();
  const cleanState = JSON.stringify(flowData);

  // Get current state
  const stateRow = db.prepare('SELECT current_index FROM undo_state WHERE id = 1').get();
  const currentIndex = stateRow.current_index;

  // Get last snapshot if exists
  let lastSnapshot = null;
  if (currentIndex > 0) {
    const lastRow = db.prepare('SELECT snapshot FROM undo_history WHERE id = ?').get(currentIndex);
    lastSnapshot = lastRow ? lastRow.snapshot : null;
  }

  // Skip if identical to last snapshot
  if (lastSnapshot && lastSnapshot === cleanState) {
    return;
  }

  // Check if identical except positions
  if (lastSnapshot && compareSnapshotsIgnoringPositions(cleanState, lastSnapshot)) {
    // Update last snapshot's positions
    db.prepare('UPDATE undo_history SET snapshot = ? WHERE id = ?').run(cleanState, currentIndex);
    return;
  }

  // If we're not at the end, truncate future states
  if (currentIndex > 0) {
    const maxRow = db.prepare('SELECT MAX(id) as maxId FROM undo_history').get();
    if (maxRow.maxId && currentIndex < maxRow.maxId) {
      db.prepare('DELETE FROM undo_history WHERE id > ?').run(currentIndex);
    }
  }

  // Add new snapshot
  const result = db.prepare('INSERT INTO undo_history (snapshot) VALUES (?)').run(cleanState);
  const newId = result.lastInsertRowid;

  // Update current index
  db.prepare('UPDATE undo_state SET current_index = ? WHERE id = 1').run(newId);

  // Limit to 50 snapshots
  const countRow = db.prepare('SELECT COUNT(*) as count FROM undo_history').get();
  if (countRow.count > 50) {
    db.prepare(`
      DELETE FROM undo_history
      WHERE id NOT IN (
        SELECT id FROM undo_history ORDER BY id DESC LIMIT 50
      )
    `).run();
  }
}

/**
 * Compare snapshots ignoring position changes
 */
function compareSnapshotsIgnoringPositions(state1Str, state2Str) {
  try {
    const s1 = JSON.parse(state1Str);
    const s2 = JSON.parse(state2Str);

    if (!s1 || !s2) return false;

    const strip = (state) => ({
      nodes: state.nodes.map(({ id, data }) => ({ id, data })),
      edges: state.edges.map(({ id, source, target, data }) => ({ id, source, target, data }))
    });

    return JSON.stringify(strip(s1)) === JSON.stringify(strip(s2));
  } catch (error) {
    return false;
  }
}

/**
 * Undo to previous state
 */
export function undo() {
  const db = getDb();
  const stateRow = db.prepare('SELECT current_index FROM undo_state WHERE id = 1').get();
  const currentIndex = stateRow.current_index;

  if (currentIndex <= 1) return null; // Can't undo first snapshot or empty

  const newIndex = currentIndex - 1;
  const snapshotRow = db.prepare('SELECT snapshot FROM undo_history WHERE id = ?').get(newIndex);

  if (!snapshotRow) return null;

  db.prepare('UPDATE undo_state SET current_index = ? WHERE id = 1').run(newIndex);

  return JSON.parse(snapshotRow.snapshot);
}

/**
 * Redo to next state
 */
export function redo() {
  const db = getDb();
  const stateRow = db.prepare('SELECT current_index FROM undo_state WHERE id = 1').get();
  const currentIndex = stateRow.current_index;

  const maxRow = db.prepare('SELECT MAX(id) as maxId FROM undo_history').get();

  if (!maxRow.maxId || currentIndex >= maxRow.maxId) return null; // Can't redo

  const newIndex = currentIndex + 1;
  const snapshotRow = db.prepare('SELECT snapshot FROM undo_history WHERE id = ?').get(newIndex);

  if (!snapshotRow) return null;

  db.prepare('UPDATE undo_state SET current_index = ? WHERE id = 1').run(newIndex);

  return JSON.parse(snapshotRow.snapshot);
}

/**
 * Get undo/redo status
 */
export function getUndoStatus() {
  const db = getDb();
  const stateRow = db.prepare('SELECT current_index FROM undo_state WHERE id = 1').get();
  const currentIndex = stateRow.current_index;

  const countRow = db.prepare('SELECT COUNT(*) as count FROM undo_history').get();
  const totalSnapshots = countRow.count;

  const maxRow = db.prepare('SELECT MAX(id) as maxId FROM undo_history').get();
  const maxId = maxRow.maxId || 0;

  return {
    canUndo: currentIndex > 1,
    canRedo: currentIndex < maxId,
    snapshotCount: totalSnapshots,
    currentIndex
  };
}

/**
 * Clear all undo history
 */
export function clearUndoHistory() {
  const db = getDb();
  db.prepare('DELETE FROM undo_history').run();
  db.prepare('UPDATE undo_state SET current_index = -1 WHERE id = 1').run();
}

/**
 * Initialize undo history with initial flow state
 */
export function initializeUndoHistory(flowData) {
  clearUndoHistory();
  pushUndoSnapshot(flowData);
}
