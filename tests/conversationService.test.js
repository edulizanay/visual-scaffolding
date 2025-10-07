// ABOUTME: Unit tests for conversation service
// ABOUTME: Tests conversation CRUD operations and history management
import {
  addUserMessage,
  addAssistantMessage,
  getHistory,
  clearHistory,
} from '../server/conversationService.js';
import { closeDb } from '../server/db.js';

describe('conversationService', () => {
  beforeEach(() => {
    process.env.DB_PATH = ':memory:';
  });

  afterEach(() => {
    closeDb();
  });

  describe('addUserMessage', () => {
    test('appends user message with timestamp', async () => {
      const history = await addUserMessage('Hello AI');

      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        role: 'user',
        content: 'Hello AI',
      });
      expect(history[0].timestamp).toBeDefined();
      expect(typeof history[0].timestamp).toBe('string');
      // SQLite CURRENT_TIMESTAMP format is like "2025-10-07 12:05:42"
      expect(history[0].timestamp).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    });

    test('stores message in database', async () => {
      await addUserMessage('test message');

      const history = await getHistory();
      expect(history).toHaveLength(1);
      expect(history[0].content).toBe('test message');
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

    test('clears history in database', async () => {
      await addUserMessage('test');
      await clearHistory();

      const history = await getHistory();
      expect(history).toEqual([]);
    });
  });
});
