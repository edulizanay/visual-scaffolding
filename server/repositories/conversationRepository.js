// ABOUTME: Conversation database repository for message history
// ABOUTME: Handles persistence of LLM conversation messages in Supabase

import { supabase } from '../supabase-client.js';

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
