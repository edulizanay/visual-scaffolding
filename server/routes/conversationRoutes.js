// ABOUTME: Conversation domain routes - handles AI chat interactions
// ABOUTME: Manages LLM conversation, message processing, and retry logic
import { Router } from 'express';
import { addUserMessage, addAssistantMessage, getHistory, clearHistory } from '../conversationService.js';
import { buildLLMContext, callConversationLLM, buildRetryMessage } from '../llm/llmService.js';
import { executeToolCalls } from '../tools/executor.js';

const router = Router();

const MAX_LLM_RETRY_ITERATIONS = 3;

// Logs errors with consistent formatting
function logError(operation, error) {
  console.error(`Error ${operation}:`, error);
}

// Logs iteration progress with consistent formatting
function logIteration(iteration, event, details = {}) {
  const messages = {
    start: () => console.log(`\n=== Iteration ${iteration} ===`),
    success: () => console.log(`✅ All ${details.count} tool calls succeeded on iteration ${iteration}`),
    failure: () => console.log(`❌ ${details.failed} of ${details.total} tool calls failed on iteration ${iteration}`),
    maxIterations: () => console.log(`⚠️  Max iterations (${details.max}) reached, giving up`),
    retry: () => console.log(`🔄 Retrying with message:\n${details.message}`)
  };
  messages[event]?.();
}

// Checks if LLM API keys are configured
function checkLLMAvailability() {
  return Boolean(process.env.GROQ_API_KEY || process.env.CEREBRAS_API_KEY);
}

/**
 * Builds consistent conversation endpoint responses with optional fields (generic fallback)
 */
function buildConversationResponse({ success, thinking, response, iterations, toolCalls, execution, updatedFlow, errors, message, parseError }) {
  const baseResponse = {
    success,
    thinking,
    iterations
  };

  if (response !== undefined) baseResponse.response = response;
  if (parseError !== undefined) baseResponse.parseError = parseError;
  if (toolCalls !== undefined) baseResponse.toolCalls = toolCalls;
  if (execution !== undefined) baseResponse.execution = execution;
  if (updatedFlow !== undefined) baseResponse.updatedFlow = updatedFlow;
  if (errors !== undefined) baseResponse.errors = errors;
  if (message !== undefined) baseResponse.message = message;

  return baseResponse;
}

// Builds response when LLM is not available
async function buildNoLLMResponse(readFlow) {
  const flowState = await readFlow();
  return buildConversationResponse({
    success: false,
    thinking: 'LLM disabled: missing API keys',
    response: 'LLM is not configured. Provide GROQ_API_KEY or CEREBRAS_API_KEY to enable AI-assisted updates.',
    iterations: 0,
    updatedFlow: flowState,
  });
}

// Executes a single iteration of LLM conversation with tool calling
async function executeSingleIteration(currentMessage, llmContext, iteration, readFlow) {
  logIteration(iteration, 'start');

  // Update llmContext with current message (initial or retry message)
  const contextWithMessage = { ...llmContext, userMessage: currentMessage };

  // Call LLM API (already returns parsed result!)
  const parsed = await callConversationLLM(contextWithMessage);

  // Handle parse errors
  if (parsed.parseError) {
    return {
      type: 'parseError',
      response: buildConversationResponse({
        success: false,
        parseError: parsed.parseError,
        thinking: parsed.thinking,
        response: parsed.content,
        iterations: iteration
      })
    };
  }

  // If no tool calls, LLM gave up or finished without tools
  if (!parsed.toolCalls || parsed.toolCalls.length === 0) {
    await addAssistantMessage(parsed.content, []);
    return {
      type: 'noTools',
      response: buildConversationResponse({
        success: true,
        thinking: parsed.thinking,
        response: 'No tool calls generated',
        iterations: iteration
      })
    };
  }

  // Execute tool calls
  const executionResults = await executeToolCalls(parsed.toolCalls);
  const failures = executionResults.filter(r => !r.success);

  if (failures.length === 0) {
    // All tool calls succeeded!
    logIteration(iteration, 'success', { count: executionResults.length });
    await addAssistantMessage(parsed.content, parsed.toolCalls);
    const updatedFlow = await readFlow();
    return {
      type: 'success',
      response: buildConversationResponse({
        success: true,
        thinking: parsed.thinking,
        toolCalls: parsed.toolCalls,
        execution: executionResults,
        updatedFlow,
        iterations: iteration
      })
    };
  }

  // Some failures occurred
  logIteration(iteration, 'failure', { failed: failures.length, total: executionResults.length });
  await addAssistantMessage(parsed.content, parsed.toolCalls);

  return {
    type: 'retry',
    parsed,
    executionResults,
    failures
  };
}

// Executes message with automatic retry on tool call failures
async function executeMessageWithRetry(message, readFlow) {
  await addUserMessage(message);
  const llmContext = await buildLLMContext(message);

  let currentMessage = message;
  let iteration = 0;

  while (iteration < MAX_LLM_RETRY_ITERATIONS) {
    iteration++;

    const result = await executeSingleIteration(currentMessage, llmContext, iteration, readFlow);

    // Return immediately for parse errors, no tools, or success
    if (result.type !== 'retry') {
      return result.response;
    }

    // Handle retry case
    if (iteration === MAX_LLM_RETRY_ITERATIONS) {
      // Max retries reached, return failure
      logIteration(iteration, 'maxIterations', { max: MAX_LLM_RETRY_ITERATIONS });
      const updatedFlow = await readFlow();
      return buildConversationResponse({
        success: false,
        thinking: result.parsed.thinking,
        toolCalls: result.parsed.toolCalls,
        execution: result.executionResults,
        updatedFlow,
        errors: result.failures,
        iterations: iteration,
        message: `Failed after ${MAX_LLM_RETRY_ITERATIONS} attempts`
      });
    }

    // Build retry message and continue loop
    const currentFlow = await readFlow();
    currentMessage = buildRetryMessage(result.executionResults, result.parsed.toolCalls, currentFlow);
    await addUserMessage(currentMessage);
    logIteration(iteration, 'retry', { message: currentMessage });
  }
}

export function registerConversationRoutes(router, { readFlow }) {
  router.post('/message', async (req, res) => {
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required and must be a string' });
      }

      if (!checkLLMAvailability()) {
        return res.json(await buildNoLLMResponse(readFlow));
      }

      const response = await executeMessageWithRetry(message, readFlow);
      res.json(response);

    } catch (error) {
      logError('processing message', error);
      res.status(500).json({ error: 'Failed to process message' });
    }
  });

  router.get('/debug', async (req, res) => {
    try {
      const history = await getHistory();
      res.json({
        history,
        messageCount: history.length,
        oldestTimestamp: history.length > 0 ? history[0].timestamp : null,
        newestTimestamp: history.length > 0 ? history[history.length - 1].timestamp : null,
      });
    } catch (error) {
      logError('fetching conversation', error);
      res.status(500).json({ error: 'Failed to fetch conversation' });
    }
  });

  router.delete('/history', async (req, res) => {
    try {
      await clearHistory();
      res.json({ success: true });
    } catch (error) {
      logError('clearing history', error);
      res.status(500).json({ error: 'Failed to clear history' });
    }
  });
}

export default router;
