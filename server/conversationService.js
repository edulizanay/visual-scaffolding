// ABOUTME: Service for managing conversation history
// ABOUTME: Handles CRUD operations for conversation.json storage
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Get conversation file path
 * Must be a function to support dynamic env var changes in tests
 */
function getConversationPath() {
  return process.env.CONVERSATION_DATA_PATH || join(__dirname, 'data', 'conversation.json');
}

const DEFAULT_CONVERSATION = {
  history: [],
};

/**
 * Load conversation history from file
 * Creates empty conversation if file doesn't exist
 * Returns empty conversation if file is corrupted
 */
export async function loadConversation() {
  try {
    const data = await fs.readFile(getConversationPath(), 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return DEFAULT_CONVERSATION;
    }
    // Handle corrupted JSON
    if (error instanceof SyntaxError) {
      console.error('Corrupted conversation.json, returning empty conversation');
      return DEFAULT_CONVERSATION;
    }
    throw error;
  }
}

/**
 * Save conversation history to file
 */
async function saveConversation(conversation) {
  const conversationPath = getConversationPath();
  const dataDir = dirname(conversationPath);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(conversationPath, JSON.stringify(conversation, null, 2));
}

/**
 * Add user message to conversation history
 * Returns updated history
 */
export async function addUserMessage(content) {
  const conversation = await loadConversation();
  const message = {
    role: 'user',
    content,
    timestamp: new Date().toISOString(),
  };
  conversation.history.push(message);
  await saveConversation(conversation);
  return conversation.history;
}

/**
 * Add assistant message to conversation history
 * Returns updated history
 */
export async function addAssistantMessage(content, toolCalls = []) {
  const conversation = await loadConversation();
  const message = {
    role: 'assistant',
    content,
    toolCalls,
    timestamp: new Date().toISOString(),
  };
  conversation.history.push(message);
  await saveConversation(conversation);
  return conversation.history;
}

/**
 * Get conversation history
 * If limit is provided, returns last N interactions (2N messages)
 */
export async function getHistory(limit) {
  const conversation = await loadConversation();

  if (!limit) {
    return conversation.history;
  }

  // Limit is number of interactions (user + assistant pairs)
  // So we need to return last (limit * 2) messages
  const messageLimit = limit * 2;
  const history = conversation.history;

  if (history.length <= messageLimit) {
    return history;
  }

  return history.slice(-messageLimit);
}

/**
 * Clear all conversation history
 */
export async function clearHistory() {
  await saveConversation(DEFAULT_CONVERSATION);
}
