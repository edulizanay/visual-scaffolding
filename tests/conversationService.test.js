// ABOUTME: Unit tests for conversation service
// ABOUTME: Tests conversation CRUD operations and history management
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  loadConversation,
  addUserMessage,
  addAssistantMessage,
  getHistory,
  clearHistory,
} from '../server/conversationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_CONVERSATION_PATH = join(__dirname, 'test-conversation.json');

// Override the conversation path for testing
process.env.CONVERSATION_DATA_PATH = TEST_CONVERSATION_PATH;

describe('conversationService', () => {
  beforeEach(async () => {
    // Ensure file is deleted AND cleared
    try {
      await fs.unlink(TEST_CONVERSATION_PATH);
    } catch (error) {
      // File doesn't exist, that's fine
    }
    // Force write empty conversation
    await fs.writeFile(TEST_CONVERSATION_PATH, JSON.stringify({ history: [] }));
  });

  afterAll(async () => {
    // Clean up test file after all tests
    try {
      await fs.unlink(TEST_CONVERSATION_PATH);
    } catch (error) {
      // Ignore
    }
  });

  describe('loadConversation', () => {
    test('creates empty conversation if file does not exist', async () => {
      const conversation = await loadConversation();
      expect(conversation).toEqual({ history: [] });
    });

    test('loads existing conversation from file', async () => {
      const testData = { history: [{ role: 'user', content: 'test' }] };
      await fs.writeFile(TEST_CONVERSATION_PATH, JSON.stringify(testData));

      const conversation = await loadConversation();
      expect(conversation).toEqual(testData);
    });

    test('handles corrupted JSON gracefully', async () => {
      await fs.writeFile(TEST_CONVERSATION_PATH, 'invalid json{');

      const conversation = await loadConversation();
      expect(conversation).toEqual({ history: [] });
    });
  });

  describe('addUserMessage', () => {
    test('appends user message with timestamp', async () => {
      const beforeTime = new Date().toISOString();
      const history = await addUserMessage('Hello AI');
      const afterTime = new Date().toISOString();

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        role: 'user',
        content: 'Hello AI',
      });
      expect(history[0].timestamp).toBeDefined();
      expect(history[0].timestamp >= beforeTime).toBe(true);
      expect(history[0].timestamp <= afterTime).toBe(true);
    });

    test('persists message to file', async () => {
      await addUserMessage('test message');

      const fileContent = await fs.readFile(TEST_CONVERSATION_PATH, 'utf-8');
      const data = JSON.parse(fileContent);

      expect(data.history).toHaveLength(1);
      expect(data.history[0].content).toBe('test message');
    });

    test('appends to existing history', async () => {
      await addUserMessage('first message');
      const history = await addUserMessage('second message');

      expect(history).toHaveLength(2);
      expect(history[0].content).toBe('first message');
      expect(history[1].content).toBe('second message');
    });
  });

  describe('addAssistantMessage', () => {
    test('appends assistant message with tool calls', async () => {
      const toolCalls = [{ name: 'addNode', params: { label: 'Test' } }];
      const history = await addAssistantMessage('Created node', toolCalls);

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        role: 'assistant',
        content: 'Created node',
        toolCalls,
      });
      expect(history[0].timestamp).toBeDefined();
    });

    test('works without tool calls', async () => {
      const history = await addAssistantMessage('Just a response');

      expect(history[0]).toMatchObject({
        role: 'assistant',
        content: 'Just a response',
        toolCalls: [],
      });
    });

    test('does not include flow.json in message', async () => {
      const history = await addAssistantMessage('response', []);

      expect(history[0]).not.toHaveProperty('flowState');
      expect(history[0]).not.toHaveProperty('nodes');
      expect(history[0]).not.toHaveProperty('edges');
    });
  });

  describe('getHistory', () => {
    test('returns all messages when no limit specified', async () => {
      await addUserMessage('msg1');
      await addAssistantMessage('resp1');
      await addUserMessage('msg2');
      await addAssistantMessage('resp2');

      const history = await getHistory();
      expect(history).toHaveLength(4);
    });

    test('returns last N interactions (2N messages)', async () => {
      // Add 10 messages (5 interactions)
      for (let i = 0; i < 5; i++) {
        await addUserMessage(`user ${i}`);
        await addAssistantMessage(`assistant ${i}`);
      }

      // Get last 3 interactions (6 messages)
      const history = await getHistory(3);
      expect(history).toHaveLength(6);
      expect(history[0].content).toBe('user 2');
      expect(history[5].content).toBe('assistant 4');
    });

    test('returns all messages if limit exceeds history length', async () => {
      await addUserMessage('only message');

      const history = await getHistory(10);
      expect(history).toHaveLength(1);
    });
  });

  describe('clearHistory', () => {
    test('empties conversation history', async () => {
      await addUserMessage('test');
      await addAssistantMessage('response');

      await clearHistory();

      const history = await getHistory();
      expect(history).toHaveLength(0);
    });

    test('persists empty history to file', async () => {
      await addUserMessage('test');
      await clearHistory();

      const fileContent = await fs.readFile(TEST_CONVERSATION_PATH, 'utf-8');
      const data = JSON.parse(fileContent);

      expect(data.history).toEqual([]);
    });
  });
});
