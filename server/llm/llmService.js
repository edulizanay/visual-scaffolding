// ABOUTME: LLM service for building context and parsing responses
// ABOUTME: Combines flow state, conversation history, and tools for LLM requests
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getFlow } from '../db.js';
import { getHistory } from '../conversationService.js';
import { toolDefinitions } from './tools.js';
import Groq from 'groq-sdk';
import Cerebras from '@cerebras/cerebras_cloud_sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file manually
const envPath = join(__dirname, '..', '..', '.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim();
      process.env[key] = value;
    }
  });
} catch (error) {
  console.warn('Could not load .env file:', error.message);
}

// Initialize clients lazily
let groq = null;
let cerebras = null;

function getGroqClient() {
  if (!groq) {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }
  return groq;
}

function getCerebrasClient() {
  if (!cerebras) {
    cerebras = new Cerebras({
      apiKey: process.env.CEREBRAS_API_KEY
    });
  }
  return cerebras;
}

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

/**
 * Load current flow state from database
 */
async function loadFlow() {
  return getFlow();
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
      // Strip JSON comments that LLMs sometimes add
      // Remove single-line comments (// style)
      let cleanedContent = content.replace(/\/\/.*$/gm, '');
      // Remove block comments (/* ... */ style, including multi-line)
      cleanedContent = cleanedContent.replace(/\/\*[\s\S]*?\*\//g, '');
      cleanedContent = cleanedContent.trim();

      // Parse as JSON array
      const parsed = JSON.parse(cleanedContent);

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

/**
 * Builds a retry message to send back to the LLM after tool execution failures.
 * Provides verbose information about what succeeded/failed and current flow state.
 */
export function buildRetryMessage(executionResults, toolCalls, currentFlow) {
  const lines = ["Previous tool execution results:\n"];

  // Show results for each tool call
  executionResults.forEach((result, i) => {
    const toolCall = toolCalls[i];

    if (result.success) {
      lines.push(`✅ ${toolCall.name}(${JSON.stringify(toolCall.params)}) → Success!`);
      if (result.nodeId) {
        lines.push(`   Created node with ID: "${result.nodeId}"`);
      }
      if (result.edgeId) {
        lines.push(`   Created edge with ID: "${result.edgeId}"`);
      }
    } else {
      lines.push(`❌ ${toolCall.name}(${JSON.stringify(toolCall.params)}) → Failed`);
      lines.push(`   Error: ${result.error}`);
    }
  });

  // Show current flow state so LLM can see available node IDs
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
}

/**
 * Call LLM API with the LLM context, with Groq as primary and Cerebras as fallback
 * Converts our context format to messages format and streams the response
 */
export async function callLLM(llmContext) {
  try {
    return await _callLLMWithProvider('groq', llmContext);
  } catch (error) {
    console.log('Groq failed, falling back to Cerebras:', error.message);
    return await _callLLMWithProvider('cerebras', llmContext);
  }
}

/**
 * Internal function to call LLM with a specific provider
 */
async function _callLLMWithProvider(provider, llmContext) {
  const { systemPrompt, userMessage, flowState, conversationHistory, availableTools } = llmContext;

  // Format tools for the context message
  const toolsText = availableTools.map(tool =>
    `${tool.name}: ${tool.description}\nParameters: ${JSON.stringify(tool.parameters, null, 2)}`
  ).join('\n\n');

  // Build the user message with full context
  const contextMessage = `Current Flow State:
${JSON.stringify(flowState, null, 2)}

Available Tools:
${toolsText}

User Request: ${userMessage}`;

  // Convert conversation history to messages format
  const messages = [
    { role: 'system', content: systemPrompt },
    ...conversationHistory.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    })),
    { role: 'user', content: contextMessage }
  ];

  // Get the appropriate client and model (Groq uses 'openai/' prefix, Cerebras doesn't)
  const client = provider === 'groq' ? getGroqClient() : getCerebrasClient();
  const model = provider === 'groq' ? 'openai/gpt-oss-120b' : 'gpt-oss-120b';

  console.log(`🌐 Calling ${provider.toUpperCase()} API with model: ${model}`);

  const completionParams = {
    model,
    messages,
    temperature: 1,
    max_completion_tokens: 8192,
    top_p: 1,
    stream: true,
    stop: null,
    reasoning_effort: 'low'
  };

  const completion = await client.chat.completions.create(completionParams);
  console.log(`✅ ${provider.toUpperCase()} API call completed`);

  // Collect the streamed response
  let fullResponse = '';
  for await (const chunk of completion) {
    const content = chunk.choices[0]?.delta?.content || '';
    fullResponse += content;
    // Optionally log chunks for debugging
    // process.stdout.write(content);
  }

  return fullResponse;
}
