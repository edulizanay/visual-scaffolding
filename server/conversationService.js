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
  addConversationMessage('user', content);
  return getConversationHistory();
}

/**
 * Add assistant message to conversation history
 * Returns updated history
 */
export async function addAssistantMessage(content, toolCalls = []) {
  addConversationMessage('assistant', content, toolCalls);
  return getConversationHistory();
}

/**
 * Get conversation history
 * If limit is provided, returns last N interactions (2N messages)
 */
export async function getHistory(limit) {
  return getConversationHistory(limit);
}

/**
 * Clear all conversation history
 */
export async function clearHistory() {
  clearConversationHistory();
}
