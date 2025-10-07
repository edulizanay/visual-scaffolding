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

export async function pushSnapshot(flowState) {
  pushUndoSnapshot(flowState);
}

export async function undo() {
  return dbUndo();
}

export async function redo() {
  return dbRedo();
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
