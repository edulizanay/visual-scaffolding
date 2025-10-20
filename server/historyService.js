// ABOUTME: Manages flow state history for undo/redo functionality
// ABOUTME: Stores snapshots in database with configurable max limit
import {
  pushUndoSnapshot,
  undo as dbUndo,
  redo as dbRedo,
  getUndoStatus,
  clearUndoHistory,
  initializeUndoHistory
} from './db.js';

/**
 * Push a new snapshot to the undo history.
 *
 * @param {Object} flowState - Flow state {nodes, edges}
 * @param {string} origin - Optional origin metadata (e.g., 'ui.drag', 'ui.subtree', 'llm.tool')
 */
export async function pushSnapshot(flowState, origin = null) {
  // Embed origin metadata inside the snapshot JSON if provided
  // Note: No timestamp to preserve deduplication (identical states should dedupe)
  const snapshotData = origin
    ? { ...flowState, _meta: { origin } }
    : flowState;

  pushUndoSnapshot(snapshotData);
}

/**
 * Strip internal metadata from snapshot before returning to client.
 * Preserves backward compatibility with existing snapshots.
 */
function stripMetadata(snapshot) {
  if (!snapshot) return snapshot;
  const { _meta, ...flowState } = snapshot;
  return flowState;
}

export async function undo() {
  const snapshot = dbUndo();
  return stripMetadata(snapshot);
}

export async function redo() {
  const snapshot = dbRedo();
  return stripMetadata(snapshot);
}

export async function canUndo() {
  const status = getUndoStatus();
  return status.canUndo;
}

export async function canRedo() {
  const status = getUndoStatus();
  return status.canRedo;
}

export async function getHistoryStatus() {
  return getUndoStatus();
}

export async function clearHistory() {
  clearUndoHistory();
}

export async function initializeHistory(currentFlow) {
  initializeUndoHistory(currentFlow);
}
