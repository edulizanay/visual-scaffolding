// ABOUTME: LLM service for building context and parsing responses
// ABOUTME: Combines flow state, conversation history, and tools for LLM requests
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getHistory } from '../conversationService.js';
import { toolDefinitions } from './tools.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SYSTEM_PROMPT = `You are a UI helper for React Flow graph structures.
The user is building a flow diagram with nodes and edges.

Your role:
1. Review the conversation history to understand context
2. Look at the current flow state (nodes and edges)
3. Use the available tools to help the user achieve their objective

Response format:
- First, output your thinking process in <thinking> tags
- Then, output your tool calls as a JSON array in <response> tags
- Each tool call must have: type, id, name, and input
- Follow this exact structure:

<thinking>
Your reasoning about what tools to use and why.
</thinking>
<response>
[
  {
    "type": "tool_use",
    "id": "toolu_01A09q90qw90lq917835lq9",
    "name": "addNode",
    "input": {
      "label": "Login",
      "description": "User authentication page"
    }
  },
  {
    "type": "tool_use",
    "id": "toolu_01B10r01rw01mr018017mr1",
    "name": "addNode",
    "input": {
      "label": "Home"
    }
  }
]
</response>

Important:
- The "id" can be any unique string (e.g., "toolu_" followed by random characters)
- The "input" object contains the parameters for the tool
- You can call multiple tools in a single response
- Available tools and their schemas will be provided in each request`;

function getFlowPath() {
  return process.env.FLOW_DATA_PATH || join(__dirname, '../data', 'flow.json');
}

/**
 * Load current flow state from flow.json
 */
async function loadFlow() {
  try {
    const data = await fs.readFile(getFlowPath(), 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { nodes: [], edges: [] };
    }
    throw error;
  }
}

/**
 * Build complete LLM context
 * Combines user message, flow state, conversation history, and available tools
 */
export async function buildLLMContext(userMessage) {
  const flowState = await loadFlow();
  const conversationHistory = await getHistory(6); // Last 6 interactions

  return {
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    flowState,
    conversationHistory,
    availableTools: toolDefinitions,
  };
}

/**
 * Parse LLM response to extract thinking and tool calls
 * Expects Claude API format:
 * <thinking>reasoning here</thinking>
 * <response>
 * [{"type": "tool_use", "id": "...", "name": "...", "input": {...}}]
 * </response>
 */
export function parseToolCalls(llmResponse) {
  // Extract thinking
  const thinkingMatch = llmResponse.match(/<thinking>([\s\S]*?)<\/thinking>/);
  const thinking = thinkingMatch ? thinkingMatch[1].trim() : '';

  // Extract response content
  const responseMatch = llmResponse.match(/<response>([\s\S]*?)<\/response>/);
  const content = responseMatch ? responseMatch[1].trim() : '';

  let toolCalls = [];
  let parseError = null;

  if (content) {
    try {
      // Parse as JSON array
      const parsed = JSON.parse(content);

      // Ensure it's an array
      const toolUseBlocks = Array.isArray(parsed) ? parsed : [parsed];

      // Convert Claude format to our internal format
      toolCalls = toolUseBlocks.map(block => ({
        id: block.id,
        name: block.name,
        params: block.input || {}
      }));
    } catch (error) {
      // If JSON parsing fails, capture the error
      parseError = `Failed to parse tool calls: ${error.message}`;
      console.error(parseError);
      console.error('Content:', content);
    }
  }

  return {
    thinking,
    content,
    toolCalls,
    parseError, // Include error if parsing failed
  };
}
