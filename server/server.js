// ABOUTME: Express server for visual scaffolding flow API
// ABOUTME: Handles GET/POST operations for flow data persistence
import express from 'express';
import cors from 'cors';
import { getFlow as dbGetFlow, saveFlow as dbSaveFlow } from './db.js';
import { addUserMessage, addAssistantMessage, getHistory, clearHistory } from './conversationService.js';
import { buildLLMContext, parseToolCalls, callLLM, buildRetryMessage } from './llm/llmService.js';
import { pushSnapshot, undo as historyUndo, redo as historyRedo, getHistoryStatus, initializeHistory } from './historyService.js';
import { executeToolCalls } from './tools/executor.js';

const app = express();
const PORT = process.env.PORT || 3001;
const MAX_LLM_RETRY_ITERATIONS = 3;

app.use(cors());
app.use(express.json());

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
async function buildNoLLMResponse() {
  const flowState = await readFlow();
  return buildConversationResponse({
    success: false,
    thinking: 'LLM disabled: missing API keys',
    response: 'LLM is not configured. Provide GROQ_API_KEY or CEREBRAS_API_KEY to enable AI-assisted updates.',
    iterations: 0,
    updatedFlow: flowState,
  });
}

// Response builders for conversation endpoint

function buildParseErrorResponse(parseError, thinking, response, iteration) {
  return {
    success: false,
    parseError,
    thinking,
    response,
    iterations: iteration
  };
}

function buildNoToolsResponse(thinking, iteration) {
  return {
    success: true,
    thinking,
    response: 'No tool calls generated',
    iterations: iteration
  };
}

function buildSuccessResponse(thinking, toolCalls, execution, updatedFlow, iteration) {
  return {
    success: true,
    thinking,
    toolCalls,
    execution,
    updatedFlow,
    iterations: iteration
  };
}

function buildMaxIterationsResponse(thinking, toolCalls, execution, updatedFlow, failures, iteration, maxIterations) {
  return {
    success: false,
    thinking,
    toolCalls,
    execution,
    updatedFlow,
    errors: failures,
    iterations: iteration,
    message: `Failed after ${maxIterations} attempts`
  };
}

// Builds consistent conversation endpoint responses with optional fields (generic fallback)
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

export async function readFlow() {
  return dbGetFlow();
}

export async function writeFlow(flowData, skipSnapshot = false) {
  dbSaveFlow(flowData);

  if (!skipSnapshot) {
    await pushSnapshot(flowData);
  }
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

app.get('/api/flow', async (req, res) => {
  try {
    const flow = await readFlow();
    res.json(flow);
  } catch (error) {
    logError('reading flow', error);
    res.status(500).json({ error: 'Failed to load flow data' });
  }
});

app.post('/api/flow', async (req, res) => {
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
app.post('/api/conversation/message', async (req, res) => {
  try {
    const { message } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required and must be a string' });
    }

    if (!checkLLMAvailability()) {
      return res.json(await buildNoLLMResponse());
    }

    // Save user message to conversation history
    await addUserMessage(message);

    // Build complete LLM context (only once, for the initial user message)
    const llmContext = await buildLLMContext(message);

    let currentMessage = message;
    let iteration = 0;

    // Error recovery loop: retry failed tool calls up to MAX_LLM_RETRY_ITERATIONS times
    while (iteration < MAX_LLM_RETRY_ITERATIONS) {
      iteration++;
      logIteration(iteration, 'start');

      // Update llmContext with current message (initial or retry message)
      const contextWithMessage = { ...llmContext, userMessage: currentMessage };

      // Call Groq API
      const llmResponse = await callLLM(contextWithMessage);

      // Parse LLM response
      const parsed = parseToolCalls(llmResponse);

      // Handle parse errors
      if (parsed.parseError) {
        return res.json(buildParseErrorResponse(parsed.parseError, parsed.thinking, llmResponse, iteration));
      }

      // If no tool calls, LLM gave up or finished without tools
      if (!parsed.toolCalls || parsed.toolCalls.length === 0) {
        // Save assistant message to conversation
        await addAssistantMessage(llmResponse, []);
        return res.json(buildNoToolsResponse(parsed.thinking, iteration));
      }

      // Execute tool calls
      const executionResults = await executeToolCalls(parsed.toolCalls);

      // Check for failures
      const failures = executionResults.filter(r => !r.success);

      if (failures.length === 0) {
        // All tool calls succeeded!
        logIteration(iteration, 'success', { count: executionResults.length });

        // Save assistant message to conversation
        await addAssistantMessage(llmResponse, parsed.toolCalls);

        // Get updated flow state
        const updatedFlow = await readFlow();

        return res.json(buildSuccessResponse(parsed.thinking, parsed.toolCalls, executionResults, updatedFlow, iteration));
      }

      // Some failures occurred
      logIteration(iteration, 'failure', { failed: failures.length, total: executionResults.length });

      // Save assistant message to conversation history (so next iteration has context)
      await addAssistantMessage(llmResponse, parsed.toolCalls);

      if (iteration === MAX_LLM_RETRY_ITERATIONS) {
        // Max retries reached, return failure
        logIteration(iteration, 'maxIterations', { max: MAX_LLM_RETRY_ITERATIONS });

        // Get updated flow state
        const updatedFlow = await readFlow();

        return res.json(buildMaxIterationsResponse(parsed.thinking, parsed.toolCalls, executionResults, updatedFlow, failures, iteration, MAX_LLM_RETRY_ITERATIONS));
      }

      // Build retry message and add to conversation as user message
      const currentFlow = await readFlow();
      currentMessage = buildRetryMessage(executionResults, parsed.toolCalls, currentFlow);
      await addUserMessage(currentMessage);
      logIteration(iteration, 'retry', { message: currentMessage });
    }

  } catch (error) {
    logError('processing message', error);
    res.status(500).json({ error: 'Failed to process message' });
  }
});

app.get('/api/conversation/debug', async (req, res) => {
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

app.delete('/api/conversation/history', async (req, res) => {
  try {
    await clearHistory();
    res.json({ success: true });
  } catch (error) {
    logError('clearing history', error);
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

// Executes undo/redo operations with consistent null-check and state persistence
async function executeHistoryOperation(operationFn, operationName) {
  const state = await operationFn();

  if (!state) {
    return { success: false, message: `Nothing to ${operationName}` };
  }

  await writeFlow(state, true);
  return { success: true, flow: state };
}

// Flow history endpoints
app.post('/api/flow/undo', async (req, res) => {
  try {
    const result = await executeHistoryOperation(historyUndo, 'undo');
    res.json(result);
  } catch (error) {
    logError('undoing', error);
    res.status(500).json({ error: 'Failed to undo' });
  }
});

app.post('/api/flow/redo', async (req, res) => {
  try {
    const result = await executeHistoryOperation(historyRedo, 'redo');
    res.json(result);
  } catch (error) {
    logError('redoing', error);
    res.status(500).json({ error: 'Failed to redo' });
  }
});

app.get('/api/flow/history-status', async (req, res) => {
  try {
    const status = await getHistoryStatus();
    res.json(status);
  } catch (error) {
    logError('getting history status', error);
    res.status(500).json({ error: 'Failed to get history status' });
  }
});

// Unified Flow Command Endpoints
// These endpoints provide REST API access to all flow operations for UI consistency

function toolEndpoint(config) {
  return async (req, res) => {
    try {
      const params = config.extractParams(req);

      if (config.validate && !config.validate(params)) {
        return res.status(400).json({
          success: false,
          error: config.validationError
        });
      }

      const [executionResult] = await executeToolCalls([{
        name: config.toolName,
        params
      }]);

      if (executionResult.success) {
        await writeFlow(
          executionResult.updatedFlow,
          config.skipSnapshot?.(req, executionResult) ?? false
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

// Node operations
app.post('/api/node', toolEndpoint({
  toolName: 'addNode',
  action: 'creating node',
  extractParams: (req) => req.body,
  extraFields: (result) => ({ nodeId: result.nodeId })
}));

app.put('/api/node/:id', toolEndpoint({
  toolName: 'updateNode',
  action: 'updating node',
  extractParams: (req) => ({ nodeId: req.params.id, ...req.body }),
  skipSnapshot: () => true
}));

app.delete('/api/node/:id', toolEndpoint({
  toolName: 'deleteNode',
  action: 'deleting node',
  extractParams: (req) => ({ nodeId: req.params.id })
}));

// Edge operations
app.post('/api/edge', toolEndpoint({
  toolName: 'addEdge',
  action: 'creating edge',
  extractParams: (req) => req.body,
  validate: (params) => params.sourceNodeId && params.targetNodeId,
  validationError: 'sourceNodeId and targetNodeId are required',
  extraFields: (result) => ({ edgeId: result.edgeId })
}));

app.put('/api/edge/:id', toolEndpoint({
  toolName: 'updateEdge',
  action: 'updating edge',
  extractParams: (req) => ({ edgeId: req.params.id, ...req.body }),
  skipSnapshot: () => true
}));

app.delete('/api/edge/:id', toolEndpoint({
  toolName: 'deleteEdge',
  action: 'deleting edge',
  extractParams: (req) => ({ edgeId: req.params.id })
}));

// Group operations
app.post('/api/group', toolEndpoint({
  toolName: 'createGroup',
  action: 'creating group',
  extractParams: (req) => req.body,
  validate: (params) => params.memberIds && Array.isArray(params.memberIds) && params.memberIds.length >= 2,
  validationError: 'At least 2 memberIds are required',
  extraFields: (result) => ({ groupId: result.groupId })
}));

app.delete('/api/group/:id', toolEndpoint({
  toolName: 'ungroup',
  action: 'ungrouping',
  extractParams: (req) => ({ groupId: req.params.id })
}));

app.put('/api/group/:id/expand', toolEndpoint({
  toolName: 'toggleGroupExpansion',
  action: 'toggling group expansion',
  extractParams: (req) => ({ groupId: req.params.id, ...req.body })
}));

// Tool executor is used directly by tests from server/tools/executor.js

// ==================== Server Startup ====================

// Only start server if not imported for testing
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);

    // Initialize history with current flow state
    try {
      const currentFlow = await readFlow();
      await initializeHistory(currentFlow);
      console.log('History initialized with current flow state');
    } catch (error) {
      logError('initializing history', error);
    }
  });
}

export default app;
