// ABOUTME: Unit tests for LLM service
// ABOUTME: Tests context building and response parsing
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { promises as fs } from 'fs';
import { buildLLMContext, parseToolCalls } from '../../server/llm/llmService.js';
import { clearHistory, addUserMessage, addAssistantMessage } from '../../server/conversationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const TEST_CONVERSATION_PATH = join(__dirname, '../test-conversation.json');
const TEST_FLOW_PATH = join(__dirname, '../test-flow.json');

// Set test paths
process.env.CONVERSATION_DATA_PATH = TEST_CONVERSATION_PATH;
process.env.FLOW_DATA_PATH = TEST_FLOW_PATH;

describe('llmService', () => {
  beforeEach(async () => {
    // Clean up test files
    try {
      await fs.unlink(TEST_CONVERSATION_PATH);
    } catch (error) {
      // File doesn't exist, that's fine
    }
    try {
      await fs.unlink(TEST_FLOW_PATH);
    } catch (error) {
      // File doesn't exist, that's fine
    }

    // Create empty conversation
    await fs.writeFile(TEST_CONVERSATION_PATH, JSON.stringify({ history: [] }));

    // Create test flow
    await fs.writeFile(TEST_FLOW_PATH, JSON.stringify({
      nodes: [
        { id: '1', data: { label: 'Start', description: 'Initial node' }, position: { x: 0, y: 0 } }
      ],
      edges: []
    }));
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.unlink(TEST_CONVERSATION_PATH);
      await fs.unlink(TEST_FLOW_PATH);
    } catch (error) {
      // Ignore
    }
  });

  describe('buildLLMContext', () => {
    test('includes systemPrompt', async () => {
      const context = await buildLLMContext('test message');

      expect(context.systemPrompt).toBeDefined();
      expect(typeof context.systemPrompt).toBe('string');
      expect(context.systemPrompt).toContain('React Flow');
    });

    test('includes user message', async () => {
      const userMessage = 'create a login node';
      const context = await buildLLMContext(userMessage);

      expect(context.userMessage).toBe(userMessage);
    });

    test('includes fresh flow.json', async () => {
      const context = await buildLLMContext('test');

      expect(context.flowState).toBeDefined();
      expect(context.flowState.nodes).toHaveLength(1);
      expect(context.flowState.nodes[0].data.label).toBe('Start');
      expect(context.flowState.edges).toEqual([]);
    });

    test('includes conversation history', async () => {
      await addUserMessage('first message');
      await addAssistantMessage('first response', []);
      await addUserMessage('second message');

      const context = await buildLLMContext('third message');

      expect(context.conversationHistory).toBeDefined();
      expect(context.conversationHistory).toHaveLength(3); // 2 user + 1 assistant
    });

    test('limits conversation history to last 6 interactions (12 messages)', async () => {
      // Add 10 interactions (20 messages)
      for (let i = 0; i < 10; i++) {
        await addUserMessage(`user ${i}`);
        await addAssistantMessage(`assistant ${i}`, []);
      }

      const context = await buildLLMContext('new message');

      // Should only include last 6 interactions = 12 messages
      expect(context.conversationHistory.length).toBeLessThanOrEqual(12);
    });

    test('flow.json appears only in flowState, not duplicated in conversationHistory', async () => {
      await addUserMessage('test');
      const context = await buildLLMContext('another test');

      // Check conversationHistory doesn't have flowState or nodes/edges
      context.conversationHistory.forEach(msg => {
        expect(msg).not.toHaveProperty('flowState');
        expect(msg).not.toHaveProperty('nodes');
        expect(msg).not.toHaveProperty('edges');
      });

      // But flowState should exist at top level
      expect(context.flowState).toBeDefined();
      expect(context.flowState.nodes).toBeDefined();
    });

    test('includes tool definitions', async () => {
      const context = await buildLLMContext('test');

      expect(context.availableTools).toBeDefined();
      expect(Array.isArray(context.availableTools)).toBe(true);
      expect(context.availableTools.length).toBeGreaterThan(0);

      // Check first tool has required fields
      const firstTool = context.availableTools[0];
      expect(firstTool).toHaveProperty('name');
      expect(firstTool).toHaveProperty('description');
      expect(firstTool).toHaveProperty('parameters');
    });
  });

  describe('parseToolCalls', () => {
    test('extracts thinking from <thinking> tags', () => {
      const llmResponse = `
<thinking>
User wants a login node. I'll use addNode.
</thinking>
<response>
addNode(label="Login")
</response>
      `;

      const result = parseToolCalls(llmResponse);

      expect(result.thinking).toBeDefined();
      expect(result.thinking).toContain('User wants a login node');
    });

    test('extracts content from <response> tags', () => {
      const llmResponse = `
<thinking>
Creating a node
</thinking>
<response>
addNode(label="Login", description="User authentication")
</response>
      `;

      const result = parseToolCalls(llmResponse);

      expect(result.content).toBeDefined();
      expect(result.content).toContain('addNode');
    });

    test('parses single tool call correctly', () => {
      const llmResponse = `
<thinking>Test</thinking>
<response>
addNode(label="Login", description="Auth page")
</response>
      `;

      const result = parseToolCalls(llmResponse);

      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls[0].name).toBe('addNode');
      expect(result.toolCalls[0].params).toEqual({
        label: 'Login',
        description: 'Auth page'
      });
    });

    test('parses multiple tool calls', () => {
      const llmResponse = `
<thinking>Creating two nodes</thinking>
<response>
addNode(label="Login")
addNode(label="Dashboard", parentNodeId="1")
</response>
      `;

      const result = parseToolCalls(llmResponse);

      expect(result.toolCalls).toHaveLength(2);
      expect(result.toolCalls[0].name).toBe('addNode');
      expect(result.toolCalls[1].name).toBe('addNode');
      expect(result.toolCalls[1].params.parentNodeId).toBe('1');
    });

    test('handles malformed response gracefully', () => {
      const llmResponse = 'This is not properly formatted';

      const result = parseToolCalls(llmResponse);

      // Should not throw, should return empty or default structure
      expect(result).toBeDefined();
      expect(result.thinking).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.toolCalls).toBeDefined();
    });

    test('handles missing thinking tags', () => {
      const llmResponse = `
<response>
addNode(label="Test")
</response>
      `;

      const result = parseToolCalls(llmResponse);

      expect(result.thinking).toBe('');
      expect(result.toolCalls).toHaveLength(1);
    });

    test('handles missing response tags', () => {
      const llmResponse = `
<thinking>
Just thinking, no action
</thinking>
      `;

      const result = parseToolCalls(llmResponse);

      expect(result.thinking).toContain('Just thinking');
      expect(result.content).toBe('');
      expect(result.toolCalls).toHaveLength(0);
    });
  });
});
