// ABOUTME: Simplified LLM service for notes summarization
// ABOUTME: Handles bullet extraction from user messages with Groq/Cerebras failover
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { getFlow } from '../db.js';
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

// Initialize clients lazily (separate instances from main LLM service)
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

const NOTES_SYSTEM_PROMPT = `You are a notes assistant that helps users organize their thoughts about what they want to build.

Your role:
1. Review the current notes bullets (if any)
2. Look at the current flow state (nodes and edges the user has created)
3. Listen to the user's latest message
4. Extract key concepts, ideas, and action items into concise bullet points

Response format:
- First, output your thinking process in <thinking> tags
- Then, output an array of bullet strings in <response> tags
- Each bullet should be a single, concise statement
- Only ADD new bullets - do not edit or remove existing ones
- Follow this exact structure:

<thinking>
Your reasoning about what concepts to extract from the user's message.
</thinking>
<response>
["First bullet point", "Second bullet point", "Third bullet point"]
</response>

Important:
- Keep bullets concise and actionable
- Extract the essence of what the user wants to build
- Do NOT include tool calls or actions - only text bullets
- Return an empty array [] if there's nothing to extract
- The array must be valid JSON`;

/**
 * Parse LLM response to extract thinking and bullet array
 * Expects format:
 * <thinking>reasoning here</thinking>
 * <response>
 * ["bullet 1", "bullet 2", ...]
 * </response>
 */
export function parseNotesBullets(llmResponse) {
  // Extract thinking
  const thinkingMatch = llmResponse.match(/<thinking>([\s\S]*?)<\/thinking>/);
  const thinking = thinkingMatch ? thinkingMatch[1].trim() : '';

  // Extract response content
  const responseMatch = llmResponse.match(/<response>([\s\S]*?)<\/response>/);
  const content = responseMatch ? responseMatch[1].trim() : '';

  let bullets = [];
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

      // Ensure it's an array of strings
      if (Array.isArray(parsed)) {
        bullets = parsed;
      } else {
        bullets = [];
      }
    } catch (error) {
      // If JSON parsing fails, capture the error
      parseError = `Failed to parse bullets: ${error.message}`;
      console.error(parseError);
      console.error('Content:', content);
    }
  }

  return {
    thinking,
    content,
    bullets,
    parseError,
  };
}

/**
 * Build notes LLM context
 * Combines current bullets, user message, and graph state
 */
export async function buildNotesContext(bullets, userMessage) {
  const flowState = await getFlow();

  return {
    systemPrompt: NOTES_SYSTEM_PROMPT,
    currentBullets: bullets,
    userMessage,
    flowState,
  };
}

/**
 * Call Notes LLM API with Groq as primary and Cerebras as fallback
 */
export async function callNotesLLM(notesContext) {
  try {
    return await _callNotesLLMWithProvider('groq', notesContext);
  } catch (error) {
    console.log('Groq failed, falling back to Cerebras:', error.message);
    return await _callNotesLLMWithProvider('cerebras', notesContext);
  }
}

/**
 * Internal function to call Notes LLM with a specific provider
 */
async function _callNotesLLMWithProvider(provider, notesContext) {
  const { systemPrompt, currentBullets, userMessage, flowState } = notesContext;

  // Build the user message with full context
  const contextMessage = `Current Notes:
${currentBullets.length > 0 ? currentBullets.map((b, i) => `${i + 1}. ${b}`).join('\n') : '(No notes yet)'}

Current Flow State:
${JSON.stringify(flowState, null, 2)}

User Message: ${userMessage}`;

  // Build messages array
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: contextMessage }
  ];

  // Get the appropriate client and model
  const client = provider === 'groq' ? getGroqClient() : getCerebrasClient();
  const model = provider === 'groq' ? 'openai/gpt-oss-120b' : 'gpt-oss-120b';

  console.log(`🌐 Calling ${provider.toUpperCase()} API for notes with model: ${model}`);

  const completionParams = {
    model,
    messages,
    temperature: 1,
    max_completion_tokens: 2048,
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
