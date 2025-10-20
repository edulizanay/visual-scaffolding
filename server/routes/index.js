// ABOUTME: Central router that registers all API endpoints
// ABOUTME: Mounts all domain routes and handles route organization
import { Router } from 'express';
import { getHistory, clearHistory } from '../conversationService.js';
import { undo as historyUndo, redo as historyRedo, getHistoryStatus } from '../historyService.js';
import { executeToolCalls } from '../tools/executor.js';
import { loadNotes, saveNotes, updateBullets } from '../notesService.js';
import { buildLLMContext, callConversationLLM, buildRetryMessage, buildNotesContext, callNotesLLM } from '../llm/llmService.js';
import { addUserMessage, addAssistantMessage } from '../conversationService.js';

const router = Router();

// ==================== CONSTANTS ====================

const MAX_LLM_RETRY_ITERATIONS = 3;

// ==================== HELPER FUNCTIONS ====================

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

// Builds response when LLM is not available
async function buildNoLLMResponse(readFlow, buildConversationResponse) {
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
async function executeSingleIteration(currentMessage, llmContext, iteration, readFlow, buildConversationResponse) {
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
async function executeMessageWithRetry(message, readFlow, buildConversationResponse) {
  await addUserMessage(message);
  const llmContext = await buildLLMContext(message);

  let currentMessage = message;
  let iteration = 0;

  while (iteration < MAX_LLM_RETRY_ITERATIONS) {
    iteration++;

    const result = await executeSingleIteration(currentMessage, llmContext, iteration, readFlow, buildConversationResponse);

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

/**
 * Builds consistent conversation endpoint responses with optional fields (generic fallback)
 * @param {Object} params - Response parameters
 * @param {boolean} params.success - Whether the operation succeeded
 * @param {string} params.thinking - LLM thinking content
 * @param {number} params.iterations - Number of retry iterations
 * @param {string} [params.response] - LLM response text
 * @param {string} [params.parseError] - Parse error if any
 * @param {Array} [params.toolCalls] - Tool calls made by LLM
 * @param {Array} [params.execution] - Tool execution results
 * @param {Object} [params.updatedFlow] - Updated flow state
 * @param {Array} [params.errors] - Errors from failed tool calls
 * @param {string} [params.message] - Additional message
 * @returns {Object} Formatted response object
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

function validateFlow(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }
  if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
    return false;
  }
  return true;
}

// Executes a single tool call and returns the result
async function executeSingleTool(toolName, params) {
  const [result] = await executeToolCalls([{ name: toolName, params }]);
  return result;
}

// Executes undo/redo operations with consistent null-check and state persistence
async function executeHistoryOperation(operationFn, operationName, writeFlow) {
  const state = await operationFn();

  if (!state) {
    return { success: false, message: `Nothing to ${operationName}` };
  }

  await writeFlow(state, true);
  return { success: true, flow: state };
}

function toolEndpoint(config, writeFlow) {
  return async (req, res) => {
    try {
      const params = config.extractParams(req);

      if (config.validate) {
        const error = config.validate(params);
        if (error) {
          return res.status(400).json({
            success: false,
            error
          });
        }
      }

      const executionResult = await executeSingleTool(config.toolName, params);

      if (executionResult.success) {
        await writeFlow(
          executionResult.updatedFlow,
          config.skipSnapshot ?? false
        );

        const response = {
          success: true,
          flow: executionResult.updatedFlow
        };

        if (config.extraFields) {
          Object.assign(response, config.extraFields(executionResult));
        }

        res.json(response);
      } else {
        res.status(400).json({ success: false, error: executionResult.error });
      }
    } catch (error) {
      logError(config.action, error);
      res.status(500).json({
        success: false,
        error: `Failed to ${config.action}`
      });
    }
  };
}

// ==================== ROUTES REGISTRATION ====================

export function registerRoutes(app, { readFlow, writeFlow }) {
  // Flow CRUD endpoints
  router.get('/flow', async (req, res) => {
    try {
      const flow = await readFlow();
      res.json(flow);
    } catch (error) {
      logError('reading flow', error);
      res.status(500).json({ error: 'Failed to load flow data' });
    }
  });

  router.post('/flow', async (req, res) => {
    try {
      const flowData = req.body;
      const skipSnapshot = req.query.skipSnapshot === 'true';

      if (!validateFlow(flowData)) {
        return res.status(400).json({ error: 'Invalid flow data structure' });
      }

      await writeFlow(flowData, skipSnapshot);
      res.json({ success: true });
    } catch (error) {
      logError('saving flow', error);
      res.status(500).json({ error: 'Failed to save flow data' });
    }
  });

  // Conversation endpoints
  router.post('/conversation/message', async (req, res) => {
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Message is required and must be a string' });
      }

      if (!checkLLMAvailability()) {
        return res.json(await buildNoLLMResponse(readFlow, buildConversationResponse));
      }

      const response = await executeMessageWithRetry(message, readFlow, buildConversationResponse);
      res.json(response);

    } catch (error) {
      logError('processing message', error);
      res.status(500).json({ error: 'Failed to process message' });
    }
  });

  router.get('/conversation/debug', async (req, res) => {
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

  router.delete('/conversation/history', async (req, res) => {
    try {
      await clearHistory();
      res.json({ success: true });
    } catch (error) {
      logError('clearing history', error);
      res.status(500).json({ error: 'Failed to clear history' });
    }
  });

  // Notes endpoints
  router.get('/notes', async (req, res) => {
    try {
      const notes = loadNotes();
      res.json(notes);
    } catch (error) {
      logError('loading notes', error);
      res.status(500).json({ error: 'Failed to load notes' });
    }
  });

  router.post('/notes', async (req, res) => {
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Message is required and must be a string'
        });
      }

      if (!checkLLMAvailability()) {
        return res.json({
          success: false,
          error: 'LLM is not configured. Provide GROQ_API_KEY or CEREBRAS_API_KEY to enable notes.',
          bullets: [],
          newBullets: []
        });
      }

      // Load current notes
      const currentNotes = loadNotes();
      const currentBullets = currentNotes.bullets;
      const conversationHistory = currentNotes.conversationHistory || [];

      // Build context and call LLM (now with conversation history!)
      const notesContext = await buildNotesContext(currentBullets, message, conversationHistory);
      const parsed = await callNotesLLM(notesContext);  // Already returns parsed result!

      if (parsed.parseError) {
        return res.json({
          success: false,
          error: parsed.parseError,
          thinking: parsed.thinking,
          bullets: currentBullets,
          newBullets: []
        });
      }

      // Combine existing bullets with new ones
      const newBullets = parsed.bullets;
      const allBullets = [...currentBullets, ...newBullets];

      // Save to conversation history
      const timestamp = new Date().toISOString();
      const updatedConversationHistory = [
        ...currentNotes.conversationHistory,
        {
          role: 'user',
          content: message,
          timestamp
        },
        {
          role: 'assistant',
          content: parsed.content,  // Use parsed.content instead of llmResponse
          timestamp
        }
      ];

      // Save notes
      saveNotes(allBullets, updatedConversationHistory);

      res.json({
        success: true,
        bullets: allBullets,
        newBullets,
        thinking: parsed.thinking
      });

    } catch (error) {
      logError('processing notes message', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process notes message'
      });
    }
  });

  router.put('/notes', async (req, res) => {
    try {
      const { bullets } = req.body;

      if (!Array.isArray(bullets)) {
        return res.status(400).json({
          success: false,
          error: 'bullets array is required'
        });
      }

      // Update bullets only
      updateBullets(bullets);

      res.json({
        success: true,
        bullets
      });

    } catch (error) {
      logError('updating notes', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update notes'
      });
    }
  });

  // Flow history endpoints
  router.post('/flow/undo', async (req, res) => {
    try {
      const result = await executeHistoryOperation(historyUndo, 'undo', writeFlow);
      res.json(result);
    } catch (error) {
      logError('undoing', error);
      res.status(500).json({ error: 'Failed to undo' });
    }
  });

  router.post('/flow/redo', async (req, res) => {
    try {
      const result = await executeHistoryOperation(historyRedo, 'redo', writeFlow);
      res.json(result);
    } catch (error) {
      logError('redoing', error);
      res.status(500).json({ error: 'Failed to redo' });
    }
  });

  router.get('/flow/history-status', async (req, res) => {
    try {
      const status = await getHistoryStatus();
      res.json(status);
    } catch (error) {
      logError('getting history status', error);
      res.status(500).json({ error: 'Failed to get history status' });
    }
  });

  // Node operations
  router.post('/node', toolEndpoint({
    toolName: 'addNode',
    action: 'creating node',
    extractParams: (req) => req.body,
    extraFields: (result) => ({ nodeId: result.nodeId })
  }, writeFlow));

  router.put('/node/:id', toolEndpoint({
    toolName: 'updateNode',
    action: 'updating node',
    extractParams: (req) => ({ nodeId: req.params.id, ...req.body }),
    skipSnapshot: true
  }, writeFlow));

  router.delete('/node/:id', toolEndpoint({
    toolName: 'deleteNode',
    action: 'deleting node',
    extractParams: (req) => ({ nodeId: req.params.id })
  }, writeFlow));

  // Edge operations
  router.post('/edge', toolEndpoint({
    toolName: 'addEdge',
    action: 'creating edge',
    extractParams: (req) => req.body,
    validate: (params) => {
      if (!params.sourceNodeId || !params.targetNodeId) {
        return 'sourceNodeId and targetNodeId are required';
      }
      return null;
    },
    extraFields: (result) => ({ edgeId: result.edgeId })
  }, writeFlow));

  router.put('/edge/:id', toolEndpoint({
    toolName: 'updateEdge',
    action: 'updating edge',
    extractParams: (req) => ({ edgeId: req.params.id, ...req.body }),
    skipSnapshot: true
  }, writeFlow));

  router.delete('/edge/:id', toolEndpoint({
    toolName: 'deleteEdge',
    action: 'deleting edge',
    extractParams: (req) => ({ edgeId: req.params.id })
  }, writeFlow));

  // Group operations
  router.post('/group', toolEndpoint({
    toolName: 'createGroup',
    action: 'creating group',
    extractParams: (req) => req.body,
    validate: (params) => {
      if (!params.memberIds || !Array.isArray(params.memberIds) || params.memberIds.length < 2) {
        return 'At least 2 memberIds are required';
      }
      return null;
    },
    extraFields: (result) => ({ groupId: result.groupId })
  }, writeFlow));

  router.delete('/group/:id', toolEndpoint({
    toolName: 'ungroup',
    action: 'ungrouping',
    extractParams: (req) => ({ groupId: req.params.id })
  }, writeFlow));

  router.put('/group/:id/expand', toolEndpoint({
    toolName: 'toggleGroupExpansion',
    action: 'toggling group expansion',
    extractParams: (req) => ({ groupId: req.params.id, ...req.body })
  }, writeFlow));

  // Mount all routes under /api
  app.use('/api', router);
}
