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

app.use(cors());
app.use(express.json());

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
    console.error('Error reading flow:', error);
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
    console.error('Error saving flow:', error);
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

    // Save user message to conversation history
    await addUserMessage(message);

    // Build complete LLM context (only once, for the initial user message)
    const llmContext = await buildLLMContext(message);

    let currentMessage = message;
    const MAX_ITERATIONS = 3;
    let iteration = 0;

    // Error recovery loop: retry failed tool calls up to MAX_ITERATIONS times
    while (iteration < MAX_ITERATIONS) {
      iteration++;
      console.log(`\n=== Iteration ${iteration} ===`);

      // Update llmContext with current message (initial or retry message)
      const contextWithMessage = { ...llmContext, userMessage: currentMessage };

      // Call Groq API
      const llmResponse = await callLLM(contextWithMessage);

      // Parse LLM response
      const parsed = parseToolCalls(llmResponse);

      // Handle parse errors
      if (parsed.parseError) {
        return res.json({
          success: false,
          parseError: parsed.parseError,
          thinking: parsed.thinking,
          response: llmResponse,
          iterations: iteration
        });
      }

      // If no tool calls, LLM gave up or finished without tools
      if (!parsed.toolCalls || parsed.toolCalls.length === 0) {
        // Save assistant message to conversation
        await addAssistantMessage(llmResponse, []);
        return res.json({
          success: true,
          thinking: parsed.thinking,
          response: 'No tool calls generated',
          iterations: iteration
        });
      }

      // Execute tool calls
      const executionResults = await executeToolCalls(parsed.toolCalls);

      // Check for failures
      const failures = executionResults.filter(r => !r.success);

      if (failures.length === 0) {
        // All tool calls succeeded!
        console.log(`✅ All ${executionResults.length} tool calls succeeded on iteration ${iteration}`);

        // Save assistant message to conversation
        await addAssistantMessage(llmResponse, parsed.toolCalls);

        // Get updated flow state
        const updatedFlow = await readFlow();

        return res.json({
          success: true,
          thinking: parsed.thinking,
          toolCalls: parsed.toolCalls,
          execution: executionResults,
          updatedFlow,
          iterations: iteration
        });
      }

      // Some failures occurred
      console.log(`❌ ${failures.length} of ${executionResults.length} tool calls failed on iteration ${iteration}`);

      // Save assistant message to conversation history (so next iteration has context)
      await addAssistantMessage(llmResponse, parsed.toolCalls);

      if (iteration === MAX_ITERATIONS) {
        // Max retries reached, return failure
        console.log(`⚠️  Max iterations (${MAX_ITERATIONS}) reached, giving up`);

        // Get updated flow state
        const updatedFlow = await readFlow();

        return res.json({
          success: false,
          thinking: parsed.thinking,
          toolCalls: parsed.toolCalls,
          execution: executionResults,
          updatedFlow,
          errors: failures,
          iterations: iteration,
          message: `Failed after ${MAX_ITERATIONS} attempts`
        });
      }

      // Build retry message and add to conversation as user message
      const currentFlow = await readFlow();
      currentMessage = buildRetryMessage(executionResults, parsed.toolCalls, currentFlow);
      await addUserMessage(currentMessage);
      console.log(`🔄 Retrying with message:\n${currentMessage}`);
    }

  } catch (error) {
    console.error('Error processing message:', error);
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
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation' });
  }
});

app.delete('/api/conversation/history', async (req, res) => {
  try {
    await clearHistory();
    res.json({ success: true });
  } catch (error) {
    console.error('Error clearing history:', error);
    res.status(500).json({ error: 'Failed to clear history' });
  }
});

// Flow history endpoints
app.post('/api/flow/undo', async (req, res) => {
  try {
    const previousState = await historyUndo();

    if (!previousState) {
      return res.json({ success: false, message: 'Nothing to undo' });
    }

    await writeFlow(previousState, true); // Skip snapshot to avoid creating new state
    res.json({ success: true, flow: previousState });
  } catch (error) {
    console.error('Error undoing:', error);
    res.status(500).json({ error: 'Failed to undo' });
  }
});

app.post('/api/flow/redo', async (req, res) => {
  try {
    const nextState = await historyRedo();

    if (!nextState) {
      return res.json({ success: false, message: 'Nothing to redo' });
    }

    await writeFlow(nextState, true); // Skip snapshot to avoid creating new state
    res.json({ success: true, flow: nextState });
  } catch (error) {
    console.error('Error redoing:', error);
    res.status(500).json({ error: 'Failed to redo' });
  }
});

app.get('/api/flow/history-status', async (req, res) => {
  try {
    const status = await getHistoryStatus();
    res.json(status);
  } catch (error) {
    console.error('Error getting history status:', error);
    res.status(500).json({ error: 'Failed to get history status' });
  }
});

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
      console.error('Failed to initialize history:', error);
    }
  });
}

export default app;
