// ABOUTME: Express server for visual scaffolding flow API
// ABOUTME: Handles GET/POST operations for flow data persistence
import express from 'express';
import cors from 'cors';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { addUserMessage, addAssistantMessage, getHistory, clearHistory } from './conversationService.js';
import { buildLLMContext, parseToolCalls, callLLM } from './llm/llmService.js';
import { pushSnapshot, undo as historyUndo, redo as historyRedo, getHistoryStatus, initializeHistory } from './historyService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Dynamically resolve path for testability
function getFlowPath() {
  return process.env.FLOW_DATA_PATH || join(__dirname, 'data', 'flow.json');
}

app.use(cors());
app.use(express.json());

const DEFAULT_FLOW = {
  nodes: [],
  edges: []
};

export async function readFlow() {
  try {
    const data = await fs.readFile(getFlowPath(), 'utf-8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return DEFAULT_FLOW;
    }
    throw error;
  }
}

export async function writeFlow(flowData, skipSnapshot = false) {
  const flowPath = getFlowPath();
  const dataDir = dirname(flowPath);
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(flowPath, JSON.stringify(flowData, null, 2));

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

/**
 * Builds a retry message to send back to the LLM after tool execution failures.
 * Provides verbose information about what succeeded/failed and current flow state.
 */
function buildRetryMessage(executionResults, toolCalls, currentFlow) {
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

// ==================== Tool Execution Functions ====================

export async function executeTool(toolName, params, flow) {
  try {
    switch (toolName) {
      case 'addNode':
        return await executeAddNode(params, flow);
      case 'updateNode':
        return await executeUpdateNode(params, flow);
      case 'deleteNode':
        return await executeDeleteNode(params, flow);
      case 'addEdge':
        return await executeAddEdge(params, flow);
      case 'updateEdge':
        return await executeUpdateEdge(params, flow);
      case 'deleteEdge':
        return await executeDeleteEdge(params, flow);
      case 'undo':
        return await executeUndo();
      case 'redo':
        return await executeRedo();
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function executeToolCalls(toolCalls) {
  let flow = await readFlow(); // Read once at start
  const results = [];

  for (const { name, params } of toolCalls) {
    const result = await executeTool(name, params, flow);
    results.push(result);

    if (result.success && result.updatedFlow) {
      flow = result.updatedFlow; // Update in-memory flow
    }
  }

  await writeFlow(flow); // Write once at end
  return results;
}

// Helper: Generate unique ID (uses underscore to match sanitizeId format)
function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Helper: Sanitize string to create a valid ID
function sanitizeId(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')  // Replace non-alphanumeric with underscore
    .replace(/^_+|_+$/g, '');      // Remove leading/trailing underscores
}

// addNode: Creates a new node, optionally with edge to parent
async function executeAddNode(params, flow) {
  const { id, label, description, parentNodeId, edgeLabel } = params;

  if (!label) {
    return { success: false, error: 'label is required' };
  }

  // Use provided ID, or sanitize label, or generate random ID
  const nodeId = id || sanitizeId(label) || generateId();

  // Check for ID collision
  if (flow.nodes.some(n => n.id === nodeId)) {
    return {
      success: false,
      error: `Node ID "${nodeId}" already exists. Please choose a different ID.`
    };
  }

  // If parentNodeId provided, sanitize and verify it exists
  let parentNode = null;
  if (parentNodeId) {
    const sanitizedParentId = sanitizeId(parentNodeId);
    parentNode = flow.nodes.find(n => n.id === sanitizedParentId);
    if (!parentNode) {
      return { success: false, error: `Parent node ${parentNodeId} not found` };
    }
  }
  const newNode = {
    id: nodeId,
    type: 'default',
    position: parentNode
      ? { x: parentNode.position.x + 200, y: parentNode.position.y }
      : { x: 0, y: 0 },
    data: { label }
  };

  if (description) {
    newNode.data.description = description;
  }

  flow.nodes.push(newNode);

  // Create edge if parent specified
  if (parentNode) {
    const edgeId = generateId();
    const newEdge = {
      id: edgeId,
      source: parentNode.id,
      target: nodeId
    };

    if (edgeLabel) {
      newEdge.data = { label: edgeLabel };
    }

    flow.edges.push(newEdge);
  }

  return { success: true, nodeId, updatedFlow: flow };
}

// updateNode: Updates node properties
async function executeUpdateNode(params, flow) {
  const { nodeId, label, description, position } = params;

  if (!nodeId) {
    return { success: false, error: 'nodeId is required' };
  }

  const node = flow.nodes.find(n => n.id === nodeId);

  if (!node) {
    return { success: false, error: `Node ${nodeId} not found` };
  }

  if (label !== undefined) node.data.label = label;
  if (description !== undefined) node.data.description = description;
  if (position !== undefined) node.position = position;

  return { success: true, updatedFlow: flow };
}

// deleteNode: Removes node and all connected edges
async function executeDeleteNode(params, flow) {
  const { nodeId } = params;

  if (!nodeId) {
    return { success: false, error: 'nodeId is required' };
  }

  const nodeIndex = flow.nodes.findIndex(n => n.id === nodeId);

  if (nodeIndex === -1) {
    return { success: false, error: `Node ${nodeId} not found` };
  }

  flow.nodes.splice(nodeIndex, 1);
  flow.edges = flow.edges.filter(e => e.source !== nodeId && e.target !== nodeId);

  return { success: true, updatedFlow: flow };
}

// addEdge: Creates edge between two nodes
async function executeAddEdge(params, flow) {
  const { sourceNodeId, targetNodeId, label } = params;

  if (!sourceNodeId || !targetNodeId) {
    return { success: false, error: 'sourceNodeId and targetNodeId are required' };
  }

  const sourceExists = flow.nodes.some(n => n.id === sourceNodeId);
  const targetExists = flow.nodes.some(n => n.id === targetNodeId);

  if (!sourceExists) {
    return { success: false, error: `Source node ${sourceNodeId} not found` };
  }
  if (!targetExists) {
    return { success: false, error: `Target node ${targetNodeId} not found` };
  }

  const edgeId = generateId();
  const newEdge = {
    id: edgeId,
    source: sourceNodeId,
    target: targetNodeId
  };

  if (label) {
    newEdge.data = { label };
  }

  flow.edges.push(newEdge);

  return { success: true, edgeId, updatedFlow: flow };
}

// updateEdge: Updates edge label
async function executeUpdateEdge(params, flow) {
  const { edgeId, label } = params;

  if (!edgeId || !label) {
    return { success: false, error: 'edgeId and label are required' };
  }

  const edge = flow.edges.find(e => e.id === edgeId);

  if (!edge) {
    return { success: false, error: `Edge ${edgeId} not found` };
  }

  if (!edge.data) {
    edge.data = {};
  }
  edge.data.label = label;

  return { success: true, updatedFlow: flow };
}

// deleteEdge: Removes edge
async function executeDeleteEdge(params, flow) {
  const { edgeId } = params;

  if (!edgeId) {
    return { success: false, error: 'edgeId is required' };
  }

  const edgeIndex = flow.edges.findIndex(e => e.id === edgeId);

  if (edgeIndex === -1) {
    return { success: false, error: `Edge ${edgeId} not found` };
  }

  flow.edges.splice(edgeIndex, 1);

  return { success: true, updatedFlow: flow };
}

// undo: Reverts to previous flow state
async function executeUndo(params, flow) {
  const previousState = await historyUndo();

  if (!previousState) {
    return { success: false, error: 'Nothing to undo' };
  }

  return { success: true, updatedFlow: previousState };
}

// redo: Reapplies last undone change
async function executeRedo(params, flow) {
  const nextState = await historyRedo();

  if (!nextState) {
    return { success: false, error: 'Nothing to redo' };
  }

  return { success: true, updatedFlow: nextState };
}

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
