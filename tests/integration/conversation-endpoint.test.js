// ABOUTME: Integration tests for POST /api/conversation/message endpoint with retry loop
// ABOUTME: Tests full retry logic with mocked LLM responses including success, failure, and iteration limits

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';

// Mock the callConversationLLM function before importing anything that uses it
let mockCallConversationLLM;
vi.mock('../../server/llm/llmService.js', () => ({
  buildLLMContext: vi.fn(async (userMessage) => ({
    systemPrompt: 'Mock system prompt',
    userMessage,
    flowState: { nodes: [], edges: [] },
    visualSettings: {},
    conversationHistory: [],
    availableTools: []
  })),
  parseToolCalls: vi.fn((llmResponse) => {
    // Real implementation for testing
    const thinkingMatch = llmResponse.match(/<thinking>([\s\S]*?)<\/thinking>/);
    const thinking = thinkingMatch ? thinkingMatch[1].trim() : '';
    const responseMatch = llmResponse.match(/<response>([\s\S]*?)<\/response>/);
    const content = responseMatch ? responseMatch[1].trim() : '';

    let toolCalls = [];
    let parseError = null;

    if (content) {
      try {
        const cleanedContent = content.replace(/\/\/.*$/gm, '').trim();
        const parsed = JSON.parse(cleanedContent);
        const toolUseBlocks = Array.isArray(parsed) ? parsed : [parsed];
        toolCalls = toolUseBlocks.map(block => ({
          id: block.id,
          name: block.name,
          params: block.input || {}
        }));
      } catch (error) {
        parseError = `Failed to parse tool calls: ${error.message}`;
      }
    }

    return { thinking, content, toolCalls, parseError };
  }),
  callConversationLLM: vi.fn(async (...args) => {
    // Call the mock and return parsed result directly
    const llmResponse = await mockCallConversationLLM(...args);

    // Parse the response
    const thinkingMatch = llmResponse.match(/<thinking>([\s\S]*?)<\/thinking>/);
    const thinking = thinkingMatch ? thinkingMatch[1].trim() : '';
    const responseMatch = llmResponse.match(/<response>([\s\S]*?)<\/response>/);
    const content = responseMatch ? responseMatch[1].trim() : '';

    let toolCalls = [];
    let parseError = null;

    if (content) {
      try {
        const cleanedContent = content.replace(/\/\/.*$/gm, '').trim();
        const parsed = JSON.parse(cleanedContent);
        const toolUseBlocks = Array.isArray(parsed) ? parsed : [parsed];
        toolCalls = toolUseBlocks.map(block => ({
          id: block.id,
          name: block.name,
          params: block.input || {}
        }));
      } catch (error) {
        parseError = `Failed to parse tool calls: ${error.message}`;
      }
    }

    return { thinking, content, toolCalls, parseError };
  }),
  buildRetryMessage: vi.fn((executionResults, toolCalls, currentFlow) => {
    // Real implementation for testing
    const lines = ["Previous tool execution results:\n"];
    executionResults.forEach((result, i) => {
      const toolCall = toolCalls[i];
      if (result.success) {
        lines.push(`✅ ${toolCall.name}(${JSON.stringify(toolCall.params)}) → Success!`);
        if (result.nodeId) lines.push(`   Created node with ID: "${result.nodeId}"`);
        if (result.edgeId) lines.push(`   Created edge with ID: "${result.edgeId}"`);
      } else {
        lines.push(`❌ ${toolCall.name}(${JSON.stringify(toolCall.params)}) → Failed`);
        lines.push(`   Error: ${result.error}`);
      }
    });

    lines.push("\n📊 Current Flow State:");
    if (currentFlow.nodes.length === 0) {
      lines.push("  No nodes exist yet.");
    } else {
      lines.push(`  Available Nodes (${currentFlow.nodes.length} total):`);
      currentFlow.nodes.forEach(node => {
        const label = node.data.label;
        const desc = node.data.description ? ` - ${node.data.description}` : '';
        lines.push(`    • "${label}" (ID: "${node.id}")${desc}`);
      });
    }

    if (currentFlow.edges.length > 0) {
      lines.push(`\n  Existing Edges (${currentFlow.edges.length} total):`);
      currentFlow.edges.forEach(edge => {
        const label = edge.data?.label ? ` [${edge.data.label}]` : '';
        lines.push(`    • ${edge.source} → ${edge.target}${label}`);
      });
    }

    lines.push("\n🔧 Instructions:");
    lines.push("Please retry the failed operations using the correct node IDs shown above.");
    lines.push("For successful operations, no action is needed - they are already complete.");

    return lines.join('\n');
  })
}));

// Now import the modules that depend on llmService
const { default: app } = await import('../../server/server.js');
const { saveFlow } = await import('../../server/db.js');
const { setupTestDb, cleanupTestDb } = await import('../test-db-setup.js');

beforeEach(async () => {
  await setupTestDb();
  process.env.GROQ_API_KEY = 'test-api-key'; // Enable LLM for tests

  // Initialize with empty flow
  await saveFlow({ nodes: [], edges: [] });

  // Reset mock between tests
  mockCallConversationLLM = vi.fn();
});

afterEach(async () => {
  await cleanupTestDb();
  delete process.env.GROQ_API_KEY;
  vi.clearAllMocks();
});

describe('POST /api/conversation/message - Retry Loop Integration', () => {
  describe('Success scenarios', () => {
    it('should execute tool successfully on first try', async () => {
      // Mock LLM to return a valid tool call
      const mockLLMResponse = `<thinking>
I need to create a login node as requested.
</thinking>
<response>
[
  {
    "type": "tool_use",
    "id": "toolu_001",
    "name": "addNode",
    "input": {
      "label": "Login",
      "description": "User authentication page"
    }
  }
]
</response>`;

      mockCallConversationLLM.mockResolvedValue(mockLLMResponse);

      const response = await request(app)
        .post('/api/conversation/message')
        .send({ message: 'Create a login node' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.thinking).toContain('create a login node');
      expect(response.body.toolCalls).toHaveLength(1);
      expect(response.body.toolCalls[0].name).toBe('addNode');
      expect(response.body.execution).toHaveLength(1);
      expect(response.body.execution[0].success).toBe(true);
      expect(response.body.execution[0].nodeId).toBeDefined();
      expect(response.body.iterations).toBe(1);
      expect(response.body.updatedFlow).toBeDefined();
      expect(response.body.updatedFlow.nodes).toHaveLength(1);
      expect(response.body.updatedFlow.nodes[0].data.label).toBe('Login');
    });

    it('should execute multiple tools successfully on first try', async () => {
      const mockLLMResponse = `<thinking>
I need to create two nodes: Login and Dashboard, and connect them.
</thinking>
<response>
[
  {
    "type": "tool_use",
    "id": "toolu_001",
    "name": "addNode",
    "input": {
      "id": "login",
      "label": "Login"
    }
  },
  {
    "type": "tool_use",
    "id": "toolu_002",
    "name": "addNode",
    "input": {
      "id": "dashboard",
      "label": "Dashboard"
    }
  },
  {
    "type": "tool_use",
    "id": "toolu_003",
    "name": "addEdge",
    "input": {
      "sourceNodeId": "login",
      "targetNodeId": "dashboard",
      "label": "authenticated"
    }
  }
]
</response>`;

      mockCallConversationLLM.mockResolvedValue(mockLLMResponse);

      const response = await request(app)
        .post('/api/conversation/message')
        .send({ message: 'Create login and dashboard nodes with edge' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.toolCalls).toHaveLength(3);
      expect(response.body.execution).toHaveLength(3);
      expect(response.body.execution.every(r => r.success)).toBe(true);
      expect(response.body.iterations).toBe(1);
      expect(response.body.updatedFlow.nodes).toHaveLength(2);
      expect(response.body.updatedFlow.edges).toHaveLength(1);
    });
  });

  describe('Retry scenarios', () => {
    it('should retry with corrected parameters after failed tool execution', async () => {
      // First call: LLM tries to add edge with invalid node IDs
      const firstLLMResponse = `<thinking>
I'll create an edge between login and dashboard.
</thinking>
<response>
[
  {
    "type": "tool_use",
    "id": "toolu_001",
    "name": "addEdge",
    "input": {
      "sourceNodeId": "login",
      "targetNodeId": "dashboard"
    }
  }
]
</response>`;

      // Second call: LLM creates the nodes first, then the edge
      const secondLLMResponse = `<thinking>
The edge failed because the nodes don't exist. I need to create them first.
</thinking>
<response>
[
  {
    "type": "tool_use",
    "id": "toolu_002",
    "name": "addNode",
    "input": {
      "id": "login",
      "label": "Login"
    }
  },
  {
    "type": "tool_use",
    "id": "toolu_003",
    "name": "addNode",
    "input": {
      "id": "dashboard",
      "label": "Dashboard"
    }
  },
  {
    "type": "tool_use",
    "id": "toolu_004",
    "name": "addEdge",
    "input": {
      "sourceNodeId": "login",
      "targetNodeId": "dashboard"
    }
  }
]
</response>`;

      mockCallConversationLLM
        .mockResolvedValueOnce(firstLLMResponse)
        .mockResolvedValueOnce(secondLLMResponse);

      const response = await request(app)
        .post('/api/conversation/message')
        .send({ message: 'Connect login to dashboard' })
        .expect(200);

      // Verify retry occurred
      expect(mockCallConversationLLM).toHaveBeenCalledTimes(2);

      // Verify final success
      expect(response.body.success).toBe(true);
      expect(response.body.iterations).toBe(2);
      expect(response.body.updatedFlow.nodes).toHaveLength(2);
      expect(response.body.updatedFlow.edges).toHaveLength(1);

      // Verify buildRetryMessage was used correctly
      const secondCallContext = mockCallConversationLLM.mock.calls[1][0];
      expect(secondCallContext.userMessage).toContain('Previous tool execution results');
      expect(secondCallContext.userMessage).toContain('❌');
      expect(secondCallContext.userMessage).toContain('addEdge');
      expect(secondCallContext.userMessage).toContain('not found');
      expect(secondCallContext.userMessage).toContain('Current Flow State');
    });

    it('should include error details and available node IDs in retry message', async () => {
      // Setup: Create initial nodes
      saveFlow({
        nodes: [
          { id: 'home', data: { label: 'Home' }, position: { x: 0, y: 0 } },
          { id: 'about', data: { label: 'About' }, position: { x: 100, y: 0 } }
        ],
        edges: []
      });

      // First call: LLM tries to update non-existent node
      const firstLLMResponse = `<thinking>
I'll update the settings node.
</thinking>
<response>
[
  {
    "type": "tool_use",
    "id": "toolu_001",
    "name": "updateNode",
    "input": {
      "nodeId": "settings",
      "label": "User Settings"
    }
  }
]
</response>`;

      // Second call: LLM uses correct node ID
      const secondLLMResponse = `<thinking>
The settings node doesn't exist. I'll update the about node instead.
</thinking>
<response>
[
  {
    "type": "tool_use",
    "id": "toolu_002",
    "name": "updateNode",
    "input": {
      "nodeId": "about",
      "label": "About Us"
    }
  }
]
</response>`;

      mockCallConversationLLM
        .mockResolvedValueOnce(firstLLMResponse)
        .mockResolvedValueOnce(secondLLMResponse);

      const response = await request(app)
        .post('/api/conversation/message')
        .send({ message: 'Update the settings page' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.iterations).toBe(2);

      // Verify retry message format
      const retryMessage = mockCallConversationLLM.mock.calls[1][0].userMessage;
      expect(retryMessage).toContain('Previous tool execution results');
      expect(retryMessage).toContain('❌ updateNode');
      expect(retryMessage).toContain('settings');
      expect(retryMessage).toContain('not found');
      expect(retryMessage).toContain('Current Flow State');
      expect(retryMessage).toContain('Available Nodes (2 total)');
      expect(retryMessage).toContain('"Home" (ID: "home")');
      expect(retryMessage).toContain('"About" (ID: "about")');
      expect(retryMessage).toContain('Please retry the failed operations using the correct node IDs');
    });

    it('should handle mixed success and failure with retry', async () => {
      // Setup: Create initial node
      saveFlow({
        nodes: [
          { id: 'home', data: { label: 'Home' }, position: { x: 0, y: 0 } }
        ],
        edges: []
      });

      // First call: Mix of valid and invalid operations
      const firstLLMResponse = `<thinking>
I'll create a profile node and update the home node, and try to delete a non-existent node.
</thinking>
<response>
[
  {
    "type": "tool_use",
    "id": "toolu_001",
    "name": "addNode",
    "input": {
      "id": "profile",
      "label": "Profile"
    }
  },
  {
    "type": "tool_use",
    "id": "toolu_002",
    "name": "updateNode",
    "input": {
      "nodeId": "home",
      "label": "Home Page"
    }
  },
  {
    "type": "tool_use",
    "id": "toolu_003",
    "name": "deleteNode",
    "input": {
      "nodeId": "settings"
    }
  }
]
</response>`;

      // Second call: Only retry the failed operation
      const secondLLMResponse = `<thinking>
The first two operations succeeded. I won't retry the delete since that node doesn't exist.
</thinking>
<response>
[]
</response>`;

      mockCallConversationLLM
        .mockResolvedValueOnce(firstLLMResponse)
        .mockResolvedValueOnce(secondLLMResponse);

      const response = await request(app)
        .post('/api/conversation/message')
        .send({ message: 'Do some operations' })
        .expect(200);

      // First iteration should report mixed results
      expect(mockCallConversationLLM).toHaveBeenCalledTimes(2);

      // Verify retry message includes both successes and failures
      const retryMessage = mockCallConversationLLM.mock.calls[1][0].userMessage;
      expect(retryMessage).toContain('✅ addNode');
      expect(retryMessage).toContain('✅ updateNode');
      expect(retryMessage).toContain('❌ deleteNode');
      expect(retryMessage).toContain('settings');
      expect(retryMessage).toContain('Available Nodes (2 total)');
    });
  });

  describe('Iteration limit enforcement', () => {
    it('should enforce 3-iteration limit and return failure', async () => {
      // All three attempts return invalid operations
      const failingLLMResponse = `<thinking>
I'll try to delete a non-existent node.
</thinking>
<response>
[
  {
    "type": "tool_use",
    "id": "toolu_001",
    "name": "deleteNode",
    "input": {
      "nodeId": "nonexistent"
    }
  }
]
</response>`;

      mockCallConversationLLM.mockResolvedValue(failingLLMResponse);

      const response = await request(app)
        .post('/api/conversation/message')
        .send({ message: 'Delete the nonexistent node' })
        .expect(200);

      // Should have attempted 3 times
      expect(mockCallConversationLLM).toHaveBeenCalledTimes(3);

      // Should report failure after max iterations
      expect(response.body.success).toBe(false);
      expect(response.body.iterations).toBe(3);
      expect(response.body.message).toBe('Failed after 3 attempts');
      expect(response.body.errors).toBeDefined();
      expect(response.body.errors).toHaveLength(1);
      expect(response.body.errors[0].success).toBe(false);
      expect(response.body.errors[0].error).toContain('not found');
    });

    it('should stop retrying after successful correction within limit', async () => {
      // First attempt fails, second succeeds
      const firstLLMResponse = `<thinking>
I'll add an edge.
</thinking>
<response>
[
  {
    "type": "tool_use",
    "id": "toolu_001",
    "name": "addEdge",
    "input": {
      "sourceNodeId": "a",
      "targetNodeId": "b"
    }
  }
]
</response>`;

      const secondLLMResponse = `<thinking>
I need to create the nodes first.
</thinking>
<response>
[
  {
    "type": "tool_use",
    "id": "toolu_002",
    "name": "addNode",
    "input": {
      "id": "a",
      "label": "Node A"
    }
  },
  {
    "type": "tool_use",
    "id": "toolu_003",
    "name": "addNode",
    "input": {
      "id": "b",
      "label": "Node B"
    }
  },
  {
    "type": "tool_use",
    "id": "toolu_004",
    "name": "addEdge",
    "input": {
      "sourceNodeId": "a",
      "targetNodeId": "b"
    }
  }
]
</response>`;

      mockCallConversationLLM
        .mockResolvedValueOnce(firstLLMResponse)
        .mockResolvedValueOnce(secondLLMResponse);

      const response = await request(app)
        .post('/api/conversation/message')
        .send({ message: 'Connect a to b' })
        .expect(200);

      // Should stop after 2 iterations (not continue to 3)
      expect(mockCallConversationLLM).toHaveBeenCalledTimes(2);
      expect(response.body.success).toBe(true);
      expect(response.body.iterations).toBe(2);
    });
  });

  describe('Response structure validation', () => {
    it('should return all required fields on success', async () => {
      const mockLLMResponse = `<thinking>
Creating a test node.
</thinking>
<response>
[
  {
    "type": "tool_use",
    "id": "toolu_001",
    "name": "addNode",
    "input": {
      "label": "Test"
    }
  }
]
</response>`;

      mockCallConversationLLM.mockResolvedValue(mockLLMResponse);

      const response = await request(app)
        .post('/api/conversation/message')
        .send({ message: 'Create a test node' })
        .expect(200);

      // Verify all required fields are present
      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('thinking');
      expect(response.body).toHaveProperty('toolCalls');
      expect(response.body).toHaveProperty('execution');
      expect(response.body).toHaveProperty('updatedFlow');
      expect(response.body).toHaveProperty('iterations');

      // Verify structure of nested objects
      expect(Array.isArray(response.body.toolCalls)).toBe(true);
      expect(Array.isArray(response.body.execution)).toBe(true);
      expect(response.body.updatedFlow).toHaveProperty('nodes');
      expect(response.body.updatedFlow).toHaveProperty('edges');
      expect(typeof response.body.iterations).toBe('number');
    });

    it('should return appropriate fields on max iteration failure', async () => {
      const failingLLMResponse = `<thinking>
Trying to delete a non-existent node.
</thinking>
<response>
[
  {
    "type": "tool_use",
    "id": "toolu_001",
    "name": "deleteNode",
    "input": {
      "nodeId": "fake"
    }
  }
]
</response>`;

      mockCallConversationLLM.mockResolvedValue(failingLLMResponse);

      const response = await request(app)
        .post('/api/conversation/message')
        .send({ message: 'Delete fake node' })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('thinking');
      expect(response.body).toHaveProperty('toolCalls');
      expect(response.body).toHaveProperty('execution');
      expect(response.body).toHaveProperty('updatedFlow');
      expect(response.body).toHaveProperty('errors');
      expect(response.body).toHaveProperty('iterations');
      expect(response.body).toHaveProperty('message');
      expect(response.body.iterations).toBe(3);
      expect(response.body.message).toBe('Failed after 3 attempts');
    });

    it('should handle parse errors gracefully', async () => {
      const invalidLLMResponse = `<thinking>
Creating a node.
</thinking>
<response>
This is not valid JSON!
</response>`;

      mockCallConversationLLM.mockResolvedValue(invalidLLMResponse);

      const response = await request(app)
        .post('/api/conversation/message')
        .send({ message: 'Create a node' })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body).toHaveProperty('parseError');
      expect(response.body.parseError).toContain('Failed to parse tool calls');
      expect(response.body).toHaveProperty('thinking');
      expect(response.body).toHaveProperty('response');
      expect(response.body.iterations).toBe(1);
    });

    it('should handle no tool calls response', async () => {
      const noToolCallsResponse = `<thinking>
I understand the request but cannot help with that.
</thinking>
<response>
[]
</response>`;

      mockCallConversationLLM.mockResolvedValue(noToolCallsResponse);

      const response = await request(app)
        .post('/api/conversation/message')
        .send({ message: 'Do something impossible' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.response).toBe('No tool calls generated');
      expect(response.body.iterations).toBe(1);
    });
  });

  describe('Edge cases and error handling', () => {
    it('should reject missing message', async () => {
      const response = await request(app)
        .post('/api/conversation/message')
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Message is required and must be a string');
    });

    it('should reject non-string message', async () => {
      const response = await request(app)
        .post('/api/conversation/message')
        .send({ message: 123 })
        .expect(400);

      expect(response.body.error).toBe('Message is required and must be a string');
    });

    it('should handle missing API keys', async () => {
      delete process.env.GROQ_API_KEY;
      delete process.env.CEREBRAS_API_KEY;

      const response = await request(app)
        .post('/api/conversation/message')
        .send({ message: 'Create a node' })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.thinking).toBe('LLM disabled: missing API keys');
      expect(response.body.response).toContain('LLM is not configured');
      expect(response.body.iterations).toBe(0);
      expect(response.body).toHaveProperty('updatedFlow');
    });

    it('should handle LLM service errors', async () => {
      mockCallConversationLLM.mockRejectedValue(new Error('LLM service unavailable'));

      const response = await request(app)
        .post('/api/conversation/message')
        .send({ message: 'Create a node' })
        .expect(500);

      expect(response.body.error).toBe('Failed to process message');
    });

    it('should track created node IDs in retry message', async () => {
      const firstLLMResponse = `<thinking>
Creating nodes.
</thinking>
<response>
[
  {
    "type": "tool_use",
    "id": "toolu_001",
    "name": "addNode",
    "input": {
      "label": "First Node"
    }
  },
  {
    "type": "tool_use",
    "id": "toolu_002",
    "name": "addEdge",
    "input": {
      "sourceNodeId": "first",
      "targetNodeId": "second"
    }
  }
]
</response>`;

      const secondLLMResponse = `<thinking>
The first node was created, I'll create the second node and retry the edge.
</thinking>
<response>
[
  {
    "type": "tool_use",
    "id": "toolu_003",
    "name": "addNode",
    "input": {
      "id": "second",
      "label": "Second Node"
    }
  }
]
</response>`;

      mockCallConversationLLM
        .mockResolvedValueOnce(firstLLMResponse)
        .mockResolvedValueOnce(secondLLMResponse);

      const response = await request(app)
        .post('/api/conversation/message')
        .send({ message: 'Create two connected nodes' })
        .expect(200);

      // Verify retry message shows created node ID
      const retryMessage = mockCallConversationLLM.mock.calls[1][0].userMessage;
      expect(retryMessage).toContain('✅ addNode');
      expect(retryMessage).toContain('Created node with ID:');
      expect(retryMessage).toContain('❌ addEdge');
      expect(retryMessage).toContain('Available Nodes (1 total)');
    });
  });
});
