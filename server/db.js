// ABOUTME: Supabase database connection and query helpers
// ABOUTME: Provides async wrappers around Supabase client for flow persistence

import { supabase } from './supabase-client.js';

// ==================== Flow Operations ====================

/**
 * Get flow by user_id and name
 * Returns default empty flow if not found
 */
function sanitizeFlowData(flowData) {
  if (!flowData || typeof flowData !== 'object') {
    return { nodes: [], edges: [] };
  }

  const { nodes = [], edges = [] } = flowData;
  return { nodes, edges };
}

export async function getFlow(userId = 'default', name = 'main') {
  const { data, error } = await supabase
    .from('flows')
    .select('data')
    .eq('user_id', userId)
    .eq('name', name)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  if (!data) {
    return { nodes: [], edges: [] };
  }

  return sanitizeFlowData(data.data);
}

/**
 * Save flow data (upsert)
 * Creates new flow or updates existing one
 */
export async function saveFlow(flowData, userId = 'default', name = 'main') {
  const sanitized = sanitizeFlowData(flowData);

  const { error } = await supabase
    .from('flows')
    .upsert(
      {
        user_id: userId,
        name: name,
        data: sanitized,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: 'user_id,name'
      }
    );

  if (error) {
    throw error;
  }
}

/**
 * Get flow ID for user+name (used by undo/redo)
 */
export async function getFlowId(userId = 'default', name = 'main') {
  const { data, error } = await supabase
    .from('flows')
    .select('id')
    .eq('user_id', userId)
    .eq('name', name)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return data ? data.id : null;
}

// ==================== Conversation Operations ====================

/**
 * Add message to conversation history
 */
export async function addConversationMessage(role, content, toolCalls = null) {
  const { error } = await supabase
    .from('conversation_history')
    .insert({
      role,
      content,
      tool_calls: toolCalls || null
    });

  if (error) {
    throw error;
  }
}

/**
 * Get conversation history
 * If limit provided, returns last N interaction pairs (limit * 2 messages)
 */
export async function getConversationHistory(limit = null) {
  const { data: allRows, error } = await supabase
    .from('conversation_history')
    .select('*')
    .order('id', { ascending: true });

  if (error) {
    throw error;
  }

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
    toolCalls: row.tool_calls || [],
    timestamp: row.timestamp
  }));
}

/**
 * Clear all conversation history
 */
export async function clearConversationHistory() {
  const { error } = await supabase
    .from('conversation_history')
    .delete()
    .neq('id', 0); // Delete all rows

  if (error) {
    throw error;
  }
}

// ==================== Undo/Redo Operations ====================

/**
 * Push snapshot to undo history
 * Handles deduplication and truncation
 */
export async function pushUndoSnapshot(flowData) {
  const cleanState = flowData;

  // Get current state
  const { data: stateRow, error: stateError } = await supabase
    .from('undo_state')
    .select('current_index')
    .eq('id', 1)
    .single();

  if (stateError) {
    throw stateError;
  }

  const currentIndex = stateRow.current_index;

  // Get last snapshot if exists
  let lastSnapshot = null;
  if (currentIndex > 0) {
    const { data: lastRow, error: lastError } = await supabase
      .from('undo_history')
      .select('snapshot')
      .eq('id', currentIndex)
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

    if (JSON.stringify(lastFlow) === JSON.stringify(currentFlow)) {
      return;
    }
  }

  // If we're not at the end, truncate future states
  if (currentIndex > 0) {
    const { data: maxRow, error: maxError } = await supabase
      .from('undo_history')
      .select('id')
      .order('id', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (maxError && maxError.code !== 'PGRST116') {
      throw maxError;
    }

    const maxId = maxRow ? maxRow.id : 0;

    if (maxId && currentIndex < maxId) {
      const { error: deleteError } = await supabase
        .from('undo_history')
        .delete()
        .gt('id', currentIndex);

      if (deleteError) {
        throw deleteError;
      }
    }
  }

  // Add new snapshot
  const { data: insertResult, error: insertError } = await supabase
    .from('undo_history')
    .insert({ snapshot: cleanState })
    .select('id')
    .single();

  if (insertError) {
    throw insertError;
  }

  const newId = insertResult.id;

  // Update current index
  const { error: updateError } = await supabase
    .from('undo_state')
    .update({ current_index: newId })
    .eq('id', 1);

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
    // Get IDs to keep (last 50)
    const { data: keepRows, error: keepError } = await supabase
      .from('undo_history')
      .select('id')
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
    .select('current_index')
    .eq('id', 1)
    .single();

  if (stateError) {
    throw stateError;
  }

  const currentIndex = stateRow.current_index;

  if (currentIndex <= 1) return null; // Can't undo first snapshot or empty

  const newIndex = currentIndex - 1;
  const { data: snapshotRow, error: snapshotError } = await supabase
    .from('undo_history')
    .select('snapshot')
    .eq('id', newIndex)
    .maybeSingle();

  if (snapshotError && snapshotError.code !== 'PGRST116') {
    throw snapshotError;
  }

  if (!snapshotRow) return null;

  const { error: updateError } = await supabase
    .from('undo_state')
    .update({ current_index: newIndex })
    .eq('id', 1);

  if (updateError) {
    throw updateError;
  }

  return snapshotRow.snapshot;
}

/**
 * Redo to next state
 */
export async function redo() {
  const { data: stateRow, error: stateError } = await supabase
    .from('undo_state')
    .select('current_index')
    .eq('id', 1)
    .single();

  if (stateError) {
    throw stateError;
  }

  const currentIndex = stateRow.current_index;

  const { data: maxRow, error: maxError } = await supabase
    .from('undo_history')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxError && maxError.code !== 'PGRST116') {
    throw maxError;
  }

  const maxId = maxRow ? maxRow.id : 0;

  if (!maxId || currentIndex >= maxId) return null; // Can't redo

  const newIndex = currentIndex + 1;
  const { data: snapshotRow, error: snapshotError } = await supabase
    .from('undo_history')
    .select('snapshot')
    .eq('id', newIndex)
    .maybeSingle();

  if (snapshotError && snapshotError.code !== 'PGRST116') {
    throw snapshotError;
  }

  if (!snapshotRow) return null;

  const { error: updateError } = await supabase
    .from('undo_state')
    .update({ current_index: newIndex })
    .eq('id', 1);

  if (updateError) {
    throw updateError;
  }

  return snapshotRow.snapshot;
}

/**
 * Get undo/redo status
 */
export async function getUndoStatus() {
  const { data: stateRow, error: stateError } = await supabase
    .from('undo_state')
    .select('current_index')
    .eq('id', 1)
    .single();

  if (stateError) {
    throw stateError;
  }

  const currentIndex = stateRow.current_index;

  const { count: totalSnapshots, error: countError } = await supabase
    .from('undo_history')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    throw countError;
  }

  const { data: maxRow, error: maxError } = await supabase
    .from('undo_history')
    .select('id')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (maxError && maxError.code !== 'PGRST116') {
    throw maxError;
  }

  const maxId = maxRow ? maxRow.id : 0;

  return {
    canUndo: currentIndex > 1,
    canRedo: totalSnapshots > 0 && currentIndex < maxId,
    snapshotCount: totalSnapshots,
    currentIndex
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
    .update({ current_index: -1 })
    .eq('id', 1);

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

// ==================== Legacy Exports (for test compatibility) ====================

/**
 * Legacy export for tests that use in-memory SQLite
 * Supabase doesn't need a db connection object
 * @deprecated - Remove after migrating tests to Supabase
 */
export function getDb() {
  throw new Error('getDb() is deprecated - Supabase migration in progress. Tests need to be updated.');
}

/**
 * Legacy export for tests that close db connections
 * Supabase manages connections automatically
 * @deprecated - Remove after migrating tests to Supabase
 */
export function closeDb() {
  // No-op: Supabase manages connections automatically
}
