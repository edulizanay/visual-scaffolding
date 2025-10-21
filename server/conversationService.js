// ABOUTME: Service for managing conversation history
// ABOUTME: Handles CRUD operations for conversation database storage
import {
  addConversationMessage,
  getConversationHistory,
  clearConversationHistory
} from './db.js';

/**
 * Add user message to conversation history
 * Returns updated history
 */
export async function addUserMessage(content) {
  await addConversationMessage('user', content);
  return await getConversationHistory();
}

/**
 * Add assistant message to conversation history
 * Returns updated history
 */
export async function addAssistantMessage(content, toolCalls = []) {
  await addConversationMessage('assistant', content, toolCalls);
  return await getConversationHistory();
}

/**
 * Get conversation history
 * If limit is provided, returns last N interactions (2N messages)
 */
export async function getHistory(limit) {
  return await getConversationHistory(limit);
}

/**
 * Clear all conversation history
 */
export async function clearHistory() {
  await clearConversationHistory();
}
