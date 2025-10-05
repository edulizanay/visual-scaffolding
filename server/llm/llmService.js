// ABOUTME: LLM service for building context and parsing responses
// ABOUTME: Combines flow state, conversation history, and tools for LLM requests
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getHistory } from '../conversationService.js';
import { toolDefinitions } from './tools.js';
import { SYSTEM_PROMPT } from './prompts.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
 * Expects format:
 * <thinking>reasoning here</thinking>
 * <response>
 * toolName(param="value")
 * </response>
 */
export function parseToolCalls(llmResponse) {
  // Extract thinking
  const thinkingMatch = llmResponse.match(/<thinking>([\s\S]*?)<\/thinking>/);
  const thinking = thinkingMatch ? thinkingMatch[1].trim() : '';

  // Extract response content
  const responseMatch = llmResponse.match(/<response>([\s\S]*?)<\/response>/);
  const content = responseMatch ? responseMatch[1].trim() : '';

  // Parse tool calls from response
  const toolCalls = [];

  if (content) {
    // Split by newlines and parse each line
    const lines = content.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    for (const line of lines) {
      // Match pattern: toolName(param1="value1", param2="value2")
      const toolMatch = line.match(/^(\w+)\((.*)\)$/);

      if (toolMatch) {
        const toolName = toolMatch[1];
        const paramsString = toolMatch[2];

        // Parse parameters
        const params = {};

        if (paramsString.trim()) {
          // Match param="value" or param='value' or param=value
          const paramMatches = paramsString.matchAll(/(\w+)=(?:"([^"]*)"|'([^']*)'|([^,\s]+))/g);

          for (const match of paramMatches) {
            const paramName = match[1];
            const quotedValue = match[2] || match[3]; // Quoted strings
            const unquotedValue = match[4]; // Unquoted values

            let paramValue;

            if (quotedValue !== undefined) {
              // If it was quoted, keep as string
              paramValue = quotedValue;
            } else {
              // Unquoted - try to parse as JSON types
              if (unquotedValue === 'true') paramValue = true;
              else if (unquotedValue === 'false') paramValue = false;
              else if (unquotedValue === 'null') paramValue = null;
              else if (!isNaN(unquotedValue) && unquotedValue !== '') paramValue = Number(unquotedValue);
              else paramValue = unquotedValue;
            }

            params[paramName] = paramValue;
          }
        }

        toolCalls.push({
          name: toolName,
          params,
        });
      }
    }
  }

  return {
    thinking,
    content,
    toolCalls,
  };
}
