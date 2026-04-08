// ABOUTME: Undo/redo database repository for history management
// ABOUTME: Handles snapshot persistence, deduplication, and navigation in Supabase

import { supabase } from '../supabase-client.js';

/**
 * Stable JSON stringify for comparing JSONB objects
 * PostgreSQL JSONB stores properties in alphabetical order,
 * so we sort keys recursively before stringifying
 */
function stableStringify(obj) {
  if (obj === null) return 'null';
  if (typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    return '[' + obj.map(item => stableStringify(item)).join(',') + ']';
  }
  const sorted = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = stableStringify(obj[key]);
  });
  return JSON.stringify(sorted);
}

/**
 * Push snapshot to undo history
 * Handles deduplication and truncation
 */
export async function pushUndoSnapshot(flowData) {
  const cleanState = flowData;

  // Get current state
  const { data: stateRow, error: stateError } = await supabase
    .from('undo_state')
    .select('current_snapshot_time')
    .eq('id', 1)
    .single();

  if (stateError) {
    throw stateError;
  }

  const currentTime = stateRow.current_snapshot_time;

  // Get last snapshot if exists
  let lastSnapshot = null;
  if (currentTime !== null) {
    const { data: lastRow, error: lastError } = await supabase
      .from('undo_history')
      .select('snapshot')
      .eq('created_at', currentTime)
      .maybeSingle();

    if (lastError && lastError.code !== 'PGRST116') {
      throw lastError;
    }

    lastSnapshot = lastRow ? lastRow.snapshot : null;
  }

  // Skip if identical to last snapshot (compare flow state, not metadata)
  if (lastSnapshot) {
    const lastData = lastSnapshot;
    const currentData = flowData;

    // Remove metadata for comparison
    const { _meta: lastMeta, ...lastFlow } = lastData;
    const { _meta: currentMeta, ...currentFlow } = currentData;

    // Use stable JSON stringify to handle JSONB property reordering
    const lastStr = stableStringify(lastFlow);
    const currentStr = stableStringify(currentFlow);

    if (lastStr === currentStr) {
      return;
    }
  }

  // If we're not at the end, truncate future states
  if (currentTime !== null) {
    // Check if there are any snapshots after current time
    const { data: futureSnapshots, error: futureError } = await supabase
      .from('undo_history')
      .select('id')
      .gt('created_at', currentTime)
      .limit(1);

    if (futureError) {
      throw futureError;
    }

    if (futureSnapshots && futureSnapshots.length > 0) {
      const { error: deleteError } = await supabase
        .from('undo_history')
        .delete()
        .gt('created_at', currentTime);

      if (deleteError) {
        throw deleteError;
      }
    }
  }

  // Add new snapshot
  const { data: insertResult, error: insertError } = await supabase
    .from('undo_history')
    .insert({ snapshot: cleanState })
    .select('id, created_at')
    .single();

  if (insertError) {
    throw insertError;
  }

  const newTimestamp = insertResult.created_at;

  // Update current snapshot time
  const { error: updateError } = await supabase
    .from('undo_state')
    .update({ current_snapshot_time: newTimestamp })
    .eq('id', 1)
    .select();

  if (updateError) {
    throw updateError;
  }

  // Limit to 50 snapshots
  const { count, error: countError } = await supabase
    .from('undo_history')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    throw countError;
  }

  if (count > 50) {
    // Get timestamps to keep (last 50 by time)
    const { data: keepRows, error: keepError } = await supabase
      .from('undo_history')
      .select('created_at, id')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(50);

    if (keepError) {
      throw keepError;
    }

    const keepIds = keepRows.map(row => row.id);

    // Delete snapshots not in keep list
    const { error: deleteOldError } = await supabase
      .from('undo_history')
      .delete()
      .not('id', 'in', `(${keepIds.join(',')})`);

    if (deleteOldError) {
      throw deleteOldError;
    }
  }
}

/**
 * Undo to previous state
 */
export async function undo() {
  const { data: stateRow, error: stateError } = await supabase
    .from('undo_state')
    .select('current_snapshot_time')
    .eq('id', 1)
    .single();

  if (stateError) {
    throw stateError;
  }

  const currentTime = stateRow.current_snapshot_time;

  if (currentTime === null) return null; // Can't undo if no current state

  // Find previous snapshot by timestamp (with ID tie-breaker)
  const { data: prevSnapshot, error: snapshotError } = await supabase
    .from('undo_history')
    .select('snapshot, created_at, id')
    .lt('created_at', currentTime)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (snapshotError && snapshotError.code !== 'PGRST116') {
    throw snapshotError;
  }

  if (!prevSnapshot) return null; // At first snapshot

  // Update current time to previous snapshot's time
  const { error: updateError } = await supabase
    .from('undo_state')
    .update({ current_snapshot_time: prevSnapshot.created_at })
    .eq('id', 1)
    .select();

  if (updateError) {
    throw updateError;
  }

  return prevSnapshot.snapshot;
}

/**
 * Redo to next state
 */
export async function redo() {
  const { data: stateRow, error: stateError } = await supabase
    .from('undo_state')
    .select('current_snapshot_time')
    .eq('id', 1)
    .single();

  if (stateError) {
    throw stateError;
  }

  const currentTime = stateRow.current_snapshot_time;

  if (currentTime === null) return null; // Can't redo if no current state

  // Find next snapshot by timestamp (with ID tie-breaker)
  const { data: nextSnapshot, error: snapshotError } = await supabase
    .from('undo_history')
    .select('snapshot, created_at, id')
    .gt('created_at', currentTime)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (snapshotError && snapshotError.code !== 'PGRST116') {
    throw snapshotError;
  }

  if (!nextSnapshot) return null; // At last snapshot

  // Update current time to next snapshot's time
  const { error: updateError } = await supabase
    .from('undo_state')
    .update({ current_snapshot_time: nextSnapshot.created_at })
    .eq('id', 1)
    .select();

  if (updateError) {
    throw updateError;
  }

  return nextSnapshot.snapshot;
}

/**
 * Get undo/redo status
 */
export async function getUndoStatus() {
  const { data: stateRow, error: stateError } = await supabase
    .from('undo_state')
    .select('current_snapshot_time')
    .eq('id', 1)
    .single();

  if (stateError) {
    throw stateError;
  }

  const currentTime = stateRow.current_snapshot_time;

  const { count: totalSnapshots, error: countError } = await supabase
    .from('undo_history')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    throw countError;
  }

  // Check if we can undo (any snapshots before current time)
  let canUndo = false;
  if (currentTime !== null) {
    const { data: prevExists, error: prevError } = await supabase
      .from('undo_history')
      .select('id')
      .lt('created_at', currentTime)
      .limit(1);

    if (prevError) {
      throw prevError;
    }

    canUndo = prevExists && prevExists.length > 0;
  }

  // Check if we can redo (any snapshots after current time)
  let canRedo = false;
  if (currentTime !== null) {
    const { data: nextExists, error: nextError } = await supabase
      .from('undo_history')
      .select('id')
      .gt('created_at', currentTime)
      .limit(1);

    if (nextError) {
      throw nextError;
    }

    canRedo = nextExists && nextExists.length > 0;
  }

  // Compute backwards-compatible currentIndex (1-based position in history)
  // This maintains API compatibility with existing tests/consumers
  let currentIndex = -1;
  if (currentTime !== null) {
    // Count snapshots up to and including current time
    const { count: positionCount, error: positionError } = await supabase
      .from('undo_history')
      .select('*', { count: 'exact', head: true })
      .lte('created_at', currentTime);

    if (positionError) {
      throw positionError;
    }

    currentIndex = positionCount || 0;
  }

  return {
    canUndo,
    canRedo,
    snapshotCount: totalSnapshots,
    currentTimestamp: currentTime,
    currentIndex // Backwards compatible: position in history (1-based)
  };
}

/**
 * Clear all undo history
 */
export async function clearUndoHistory() {
  const { error: deleteError } = await supabase
    .from('undo_history')
    .delete()
    .neq('id', 0); // Delete all rows

  if (deleteError) {
    throw deleteError;
  }

  const { error: updateError } = await supabase
    .from('undo_state')
    .update({ current_snapshot_time: null })
    .eq('id', 1)
    .select();

  if (updateError) {
    throw updateError;
  }
}

/**
 * Initialize undo history with initial flow state
 */
export async function initializeUndoHistory(flowData) {
  await clearUndoHistory();
  await pushUndoSnapshot(flowData);
}
