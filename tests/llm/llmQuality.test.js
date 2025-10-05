// ABOUTME: Tests for LLM output quality using real Groq API
// ABOUTME: Verifies the LLM generates correct tool calls for each operation

import { buildLLMContext, callGroqAPI, parseToolCalls } from '../../server/llm/llmService.js';
import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Helper function to create test flow.json
async function setupTestFlow(flowData) {
  const testFlowPath = join(__dirname, '..', 'test-data', 'test-flow.json');
  await fs.mkdir(join(__dirname, '..', 'test-data'), { recursive: true });
  await fs.writeFile(testFlowPath, JSON.stringify(flowData, null, 2));
  process.env.FLOW_DATA_PATH = testFlowPath;
}

// Helper function to create test conversation.json
async function setupTestConversation(conversationData) {
  const testConvPath = join(__dirname, '..', 'test-data', 'test-conversation.json');
  await fs.mkdir(join(__dirname, '..', 'test-data'), { recursive: true });
  await fs.writeFile(testConvPath, JSON.stringify(conversationData, null, 2));
  process.env.CONVERSATION_DATA_PATH = testConvPath;
}

// Helper to call LLM and parse response
async function callAndParse(userMessage, flowState = { nodes: [], edges: [] }) {
  await setupTestFlow(flowState);
  await setupTestConversation({ history: [] });

  const context = await buildLLMContext(userMessage);
  const llmResponse = await callGroqAPI(context);
  const parsed = parseToolCalls(llmResponse);

  return { llmResponse, parsed };
}

describe('LLM Output Quality Tests', () => {
  // Test timeout - LLM calls can take time (set on individual tests)

  describe('addNode tool', () => {
    test('should generate addNode for simple node creation request', async () => {
      const { parsed } = await callAndParse('create a login node');

      expect(parsed.parseError).toBeNull();
      expect(parsed.toolCalls).toHaveLength(1);
      expect(parsed.toolCalls[0].name).toBe('addNode');
      expect(parsed.toolCalls[0].params).toHaveProperty('label');
      expect(parsed.toolCalls[0].params.label.toLowerCase()).toContain('login');
    });

    test('should generate multiple addNode calls for multi-node request', async () => {
      const { parsed } = await callAndParse('create login, home, and dashboard nodes');

      expect(parsed.parseError).toBeNull();
      expect(parsed.toolCalls.length).toBeGreaterThanOrEqual(3);

      const nodeNames = parsed.toolCalls.map(call => call.params.label?.toLowerCase());
      expect(nodeNames.some(name => name?.includes('login'))).toBe(true);
      expect(nodeNames.some(name => name?.includes('home'))).toBe(true);
      expect(nodeNames.some(name => name?.includes('dashboard'))).toBe(true);
    });
  });

  describe('updateNode tool', () => {
    test('should generate updateNode for label change request', async () => {
      const flowState = {
        nodes: [{ id: '1', data: { label: 'Login' }, position: { x: 0, y: 0 } }],
        edges: []
      };

      const { parsed } = await callAndParse('rename the Login node to Authentication', flowState);

      expect(parsed.parseError).toBeNull();
      expect(parsed.toolCalls.length).toBeGreaterThan(0);
      expect(parsed.toolCalls[0].name).toBe('updateNode');
      expect(parsed.toolCalls[0].params.nodeId).toBe('1');
      expect(parsed.toolCalls[0].params.label.toLowerCase()).toContain('auth');
    });

    test('should generate updateNode with position for move request', async () => {
      const flowState = {
        nodes: [{ id: '1', data: { label: 'Login' }, position: { x: 0, y: 0 } }],
        edges: []
      };

      const { parsed } = await callAndParse('move the Login node to position x: 100, y: 200', flowState);

      expect(parsed.parseError).toBeNull();
      expect(parsed.toolCalls.length).toBeGreaterThan(0);
      expect(parsed.toolCalls[0].name).toBe('updateNode');
      expect(parsed.toolCalls[0].params.nodeId).toBe('1');
      expect(parsed.toolCalls[0].params.position).toEqual({ x: 100, y: 200 });
    });
  });

  describe('deleteNode tool', () => {
    test('should generate deleteNode for deletion request', async () => {
      const flowState = {
        nodes: [
          { id: '1', data: { label: 'Login' }, position: { x: 0, y: 0 } },
          { id: '2', data: { label: 'Home' }, position: { x: 200, y: 0 } }
        ],
        edges: []
      };

      const { parsed } = await callAndParse('delete the Login node', flowState);

      expect(parsed.parseError).toBeNull();
      expect(parsed.toolCalls.length).toBeGreaterThan(0);
      expect(parsed.toolCalls[0].name).toBe('deleteNode');
      expect(parsed.toolCalls[0].params.nodeId).toBe('1');
    });
  });

  describe('addEdge tool', () => {
    test('should generate addEdge for connection request', async () => {
      const flowState = {
        nodes: [
          { id: '1', data: { label: 'Login' }, position: { x: 0, y: 0 } },
          { id: '2', data: { label: 'Home' }, position: { x: 200, y: 0 } }
        ],
        edges: []
      };

      const { parsed } = await callAndParse('connect Login to Home', flowState);

      expect(parsed.parseError).toBeNull();
      expect(parsed.toolCalls.length).toBeGreaterThan(0);
      expect(parsed.toolCalls[0].name).toBe('addEdge');
      expect(parsed.toolCalls[0].params.sourceNodeId).toBe('1');
      expect(parsed.toolCalls[0].params.targetNodeId).toBe('2');
    });

    test('should generate addEdge with label for labeled connection', async () => {
      const flowState = {
        nodes: [
          { id: '1', data: { label: 'Login' }, position: { x: 0, y: 0 } },
          { id: '2', data: { label: 'Home' }, position: { x: 200, y: 0 } }
        ],
        edges: []
      };

      const { parsed } = await callAndParse('connect Login to Home with label "success"', flowState);

      expect(parsed.parseError).toBeNull();
      expect(parsed.toolCalls.length).toBeGreaterThan(0);
      expect(parsed.toolCalls[0].name).toBe('addEdge');
      expect(parsed.toolCalls[0].params.label).toBeDefined();
    });
  });

  describe('updateEdge tool', () => {
    test('should generate updateEdge for edge label change', async () => {
      const flowState = {
        nodes: [
          { id: '1', data: { label: 'Login' }, position: { x: 0, y: 0 } },
          { id: '2', data: { label: 'Home' }, position: { x: 200, y: 0 } }
        ],
        edges: [
          { id: 'e1-2', source: '1', target: '2', data: { label: 'success' } }
        ]
      };

      const { parsed } = await callAndParse('change the edge label to "authenticated"', flowState);

      expect(parsed.parseError).toBeNull();
      expect(parsed.toolCalls.length).toBeGreaterThan(0);
      expect(parsed.toolCalls[0].name).toBe('updateEdge');
      expect(parsed.toolCalls[0].params.edgeId).toBe('e1-2');
      expect(parsed.toolCalls[0].params.label).toBeDefined();
    });
  });

  describe('deleteEdge tool', () => {
    test('should generate deleteEdge for edge removal', async () => {
      const flowState = {
        nodes: [
          { id: '1', data: { label: 'Login' }, position: { x: 0, y: 0 } },
          { id: '2', data: { label: 'Home' }, position: { x: 200, y: 0 } }
        ],
        edges: [
          { id: 'e1-2', source: '1', target: '2', data: {} }
        ]
      };

      const { parsed } = await callAndParse('remove the edge between Login and Home', flowState);

      expect(parsed.parseError).toBeNull();
      expect(parsed.toolCalls.length).toBeGreaterThan(0);
      expect(parsed.toolCalls[0].name).toBe('deleteEdge');
      expect(parsed.toolCalls[0].params.edgeId).toBe('e1-2');
    });
  });

  describe('undo/redo tools', () => {
    test('should generate undo for undo request', async () => {
      const { parsed } = await callAndParse('undo the last change');

      expect(parsed.parseError).toBeNull();
      expect(parsed.toolCalls.length).toBeGreaterThan(0);
      expect(parsed.toolCalls[0].name).toBe('undo');
    });

    test('should generate redo for redo request', async () => {
      const { parsed } = await callAndParse('redo');

      expect(parsed.parseError).toBeNull();
      expect(parsed.toolCalls.length).toBeGreaterThan(0);
      expect(parsed.toolCalls[0].name).toBe('redo');
    });
  });

  describe('Invalid/Ambiguous requests', () => {
    test('should not generate tool calls for pure question', async () => {
      const { parsed } = await callAndParse('what nodes are in the flow?');

      // LLM might respond with explanation but no tool calls
      expect(parsed.parseError).toBeNull();
      expect(parsed.toolCalls).toHaveLength(0);
    });

    test('should not generate tool calls for greeting', async () => {
      const { parsed } = await callAndParse('hello');

      expect(parsed.parseError).toBeNull();
      expect(parsed.toolCalls).toHaveLength(0);
    });

    test('should not generate tool calls for ambiguous request without context', async () => {
      const { parsed } = await callAndParse('delete it');

      // Without context about what "it" is, LLM should not make assumptions
      expect(parsed.parseError).toBeNull();
      // Either no tool calls, or LLM asks for clarification
      const hasNoToolCalls = parsed.toolCalls.length === 0;
      const hasNoDeleteNode = !parsed.toolCalls.some(call => call.name === 'deleteNode');
      expect(hasNoToolCalls || hasNoDeleteNode).toBe(true);
    });
  });

  describe('Response format validation', () => {
    test('should always include <thinking> tags', async () => {
      const { llmResponse } = await callAndParse('create a test node');

      expect(llmResponse).toContain('<thinking>');
      expect(llmResponse).toContain('</thinking>');
    });

    test('should always include <response> tags when outputting tools', async () => {
      const { llmResponse } = await callAndParse('create a test node');

      if (llmResponse.includes('"type": "tool_use"')) {
        expect(llmResponse).toContain('<response>');
        expect(llmResponse).toContain('</response>');
      }
    });

    test('should generate valid JSON in response tags', async () => {
      const { parsed } = await callAndParse('create a test node');

      // If there's a response, it should be valid JSON
      if (parsed.content) {
        expect(parsed.parseError).toBeNull();
        expect(() => JSON.parse(parsed.content)).not.toThrow();
      }
    });

    test('should include required fields in tool calls', async () => {
      const { parsed } = await callAndParse('create a login node');

      if (parsed.toolCalls.length > 0) {
        const toolCall = parsed.toolCalls[0];
        expect(toolCall).toHaveProperty('id');
        expect(toolCall).toHaveProperty('name');
        expect(toolCall).toHaveProperty('params');
        expect(typeof toolCall.id).toBe('string');
        expect(typeof toolCall.name).toBe('string');
        expect(typeof toolCall.params).toBe('object');
      }
    });
  });
});
