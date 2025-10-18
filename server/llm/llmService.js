// ABOUTME: Unified LLM service for conversation and notes
// ABOUTME: Handles Groq/Cerebras failover, prompts from YAML, and response parsing

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getFlow } from '../db.js';
import { getHistory } from '../conversationService.js';
import { toolDefinitions } from './tools.js';
import Groq from 'groq-sdk';
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import YAML from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================================
// INITIALIZATION
// ============================================================================

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

// Load prompts from YAML
const promptsPath = join(__dirname, 'prompts.yaml');
const PROMPTS = YAML.parse(readFileSync(promptsPath, 'utf-8'));

// Initialize clients lazily (singleton pattern)
let groq = null;
let cerebras = null;

function getGroqClient() {
  if (!groq && process.env.GROQ_API_KEY) {
    groq = new Groq({
      apiKey: process.env.GROQ_API_KEY
    });
  }
  return groq;
}

function getCerebrasClient() {
  if (!cerebras && process.env.CEREBRAS_API_KEY) {
    cerebras = new Cerebras({
      apiKey: process.env.CEREBRAS_API_KEY
    });
  }
  return cerebras;
}

// ============================================================================
// CORE LLM FUNCTIONS (shared by conversation + notes)
// ============================================================================

/**
 * Call LLM with Groq as primary and Cerebras as fallback
 */
async function callLLM(serviceName, messages) {
  const config = PROMPTS[serviceName];

  try {
    return await _callLLMWithProvider('groq', messages, config.max_tokens);
  } catch (error) {
    console.log('Groq failed, falling back to Cerebras:', error.message);
    return await _callLLMWithProvider('cerebras', messages, config.max_tokens);
  }
}

/**
 * Internal function to call LLM with a specific provider
 */
async function _callLLMWithProvider(provider, messages, maxTokens) {
  const client = provider === 'groq' ? getGroqClient() : getCerebrasClient();
  const model = provider === 'groq' ? 'openai/gpt-oss-120b' : 'gpt-oss-120b';

  if (!client) {
    throw new Error(`${provider} is not configured (missing API key)`);
  }

  console.log(`🌐 Calling ${provider.toUpperCase()} API with model: ${model}`);

  const completionParams = {
    model,
    messages,
    temperature: 1,
    max_completion_tokens: maxTokens,
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
  }

  return fullResponse;
}

/**
 * Parse LLM response to extract <thinking> and <response> tags
 * Shared by both conversation and notes services
 */
function parseLLMResponse(llmResponse) {
  // Extract thinking
  const thinkingMatch = llmResponse.match(/<thinking>([\s\S]*?)<\/thinking>/);
  const thinking = thinkingMatch ? thinkingMatch[1].trim() : '';

  // Extract response content
  const responseMatch = llmResponse.match(/<response>([\s\S]*?)<\/response>/);
  const content = responseMatch ? responseMatch[1].trim() : '';

  let parsed = null;
  let parseError = null;

  if (content) {
    try {
      // Strip JSON comments that LLMs sometimes add
      let cleanedContent = content.replace(/\/\/.*$/gm, '');  // Single-line comments
      cleanedContent = cleanedContent.replace(/\/\*[\s\S]*?\*\//g, '');  // Block comments
      cleanedContent = cleanedContent.trim();

      // Parse as JSON
      parsed = JSON.parse(cleanedContent);
    } catch (error) {
      parseError = `Failed to parse response: ${error.message}`;
      console.error(parseError);
      console.error('Content:', content);
    }
  }

  return { thinking, content, parsed, parseError };
}

// ============================================================================
// CONVERSATION SERVICE (tool-based flow manipulation)
// ============================================================================

/**
 * Build complete LLM context for conversation
 * Combines user message, flow state, conversation history, and available tools
 */
export async function buildLLMContext(userMessage) {
  const flowState = await getFlow();
  const conversationHistory = await getHistory(PROMPTS.conversation.history_limit);

  return {
    systemPrompt: PROMPTS.conversation.system,
    userMessage,
    flowState,
    conversationHistory,
    availableTools: toolDefinitions,
  };
}

/**
 * Call conversation LLM and return response with tool calls
 */
export async function callConversationLLM(llmContext) {
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

  // Call LLM
  const response = await callLLM('conversation', messages);

  // Parse response
  const { thinking, content, parsed, parseError } = parseLLMResponse(response);

  // Convert to tool calls format
  const toolCalls = parsed
    ? (Array.isArray(parsed) ? parsed : [parsed]).map(block => ({
        id: block.id,
        name: block.name,
        params: block.input || {}
      }))
    : [];

  return { thinking, content, toolCalls, parseError };
}

/**
 * Parse tool calls from LLM response (for backward compatibility)
 */
export function parseToolCalls(llmResponse) {
  const { thinking, content, parsed, parseError } = parseLLMResponse(llmResponse);

  const toolCalls = parsed
    ? (Array.isArray(parsed) ? parsed : [parsed]).map(block => ({
        id: block.id,
        name: block.name,
        params: block.input || {}
      }))
    : [];

  return { thinking, content, toolCalls, parseError };
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

// ============================================================================
// NOTES SERVICE (bullet extraction with conversation history)
// ============================================================================

/**
 * Build notes LLM context
 * Combines current bullets, user message, flow state, and conversation history
 */
export async function buildNotesContext(bullets, userMessage, conversationHistory = []) {
  const flowState = await getFlow();

  return {
    systemPrompt: PROMPTS.notes.system,
    currentBullets: bullets,
    userMessage,
    flowState,
    conversationHistory
  };
}

/**
 * Call notes LLM and return response with extracted bullets
 */
export async function callNotesLLM(notesContext) {
  const { systemPrompt, currentBullets, userMessage, flowState, conversationHistory } = notesContext;

  // Format current bullets
  const bulletsText = currentBullets.length > 0
    ? currentBullets.map((b, i) => `${i + 1}. ${b}`).join('\n')
    : '(No notes yet)';

  // Build the user message with full context
  const contextMessage = `Current Notes:
${bulletsText}

Current Flow State:
${JSON.stringify(flowState, null, 2)}

User Message: ${userMessage}`;

  // Build messages array with conversation history
  const messages = [
    { role: 'system', content: systemPrompt },
    // Add conversation history (limited by PROMPTS.notes.history_limit)
    ...conversationHistory.slice(-PROMPTS.notes.history_limit).map(msg => ({
      role: msg.role === 'user' ? 'user' : 'assistant',
      content: msg.content
    })),
    { role: 'user', content: contextMessage }
  ];

  // Call LLM
  const response = await callLLM('notes', messages);

  // Parse response
  const { thinking, content, parsed, parseError } = parseLLMResponse(response);

  // Extract bullets (should be an array of strings)
  const bullets = Array.isArray(parsed) ? parsed : [];

  return { thinking, content, bullets, parseError };
}

/**
 * Parse notes bullets from LLM response (for backward compatibility)
 */
export function parseNotesBullets(llmResponse) {
  const { thinking, content, parsed, parseError } = parseLLMResponse(llmResponse);
  const bullets = Array.isArray(parsed) ? parsed : [];
  return { thinking, content, bullets, parseError };
}
