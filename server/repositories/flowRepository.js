// ABOUTME: Flow database repository for CRUD operations
// ABOUTME: Handles persistence of flow data (nodes and edges) in Supabase

import { supabase } from '../supabase-client.js';

/**
 * Sanitize flow data to ensure valid structure
 * Returns default empty flow if invalid
 */
function sanitizeFlowData(flowData) {
  if (!flowData || typeof flowData !== 'object') {
    return { nodes: [], edges: [] };
  }

  const { nodes = [], edges = [] } = flowData;
  return { nodes, edges };
}

/**
 * Get flow by user_id and name
 * Returns default empty flow if not found
 */
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
