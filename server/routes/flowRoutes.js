// ABOUTME: Flow domain routes - handles flow CRUD, nodes, edges, groups, and history
// ABOUTME: Manages all operations related to the visual flow canvas
import { Router } from 'express';
import { undo as historyUndo, redo as historyRedo, getHistoryStatus } from '../historyService.js';
import { executeToolCalls } from '../tools/executor.js';

const router = Router();

// Logs errors with consistent formatting
function logError(operation, error) {
  console.error(`Error ${operation}:`, error);
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

export function registerFlowRoutes(router, { readFlow, writeFlow }) {
  // Flow CRUD endpoints
  router.get('/', async (req, res) => {
    try {
      const flow = await readFlow();
      res.json(flow);
    } catch (error) {
      logError('reading flow', error);
      res.status(500).json({ error: 'Failed to load flow data' });
    }
  });

  router.post('/', async (req, res) => {
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

  // Flow history endpoints
  router.post('/undo', async (req, res) => {
    try {
      const result = await executeHistoryOperation(historyUndo, 'undo', writeFlow);
      res.json(result);
    } catch (error) {
      logError('undoing', error);
      res.status(500).json({ error: 'Failed to undo' });
    }
  });

  router.post('/redo', async (req, res) => {
    try {
      const result = await executeHistoryOperation(historyRedo, 'redo', writeFlow);
      res.json(result);
    } catch (error) {
      logError('redoing', error);
      res.status(500).json({ error: 'Failed to redo' });
    }
  });

  router.get('/history-status', async (req, res) => {
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

  // Auto-layout endpoint
  router.post('/auto-layout', async (req, res) => {
    try {
      const result = await executeSingleTool('autoLayout', {});

      if (result.success) {
        res.json({
          success: true,
          flow: result.updatedFlow,
          tool: result.tool,
          didChange: result.didChange
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      logError('applying auto-layout', error);
      res.status(500).json({
        success: false,
        error: 'Failed to apply auto-layout'
      });
    }
  });
}

export default router;
