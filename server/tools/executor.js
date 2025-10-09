import { getFlow as dbGetFlow, saveFlow as dbSaveFlow } from '../db.js';
import { pushSnapshot, undo as historyUndo, redo as historyRedo } from '../historyService.js';

async function readFlow() {
  return dbGetFlow();
}

async function writeFlow(flowData, skipSnapshot = false) {
  dbSaveFlow(flowData);
  if (!skipSnapshot) {
    await pushSnapshot(flowData);
  }
}

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
  let flow = await readFlow();
  const results = [];

  for (const { name, params } of toolCalls) {
    const result = await executeTool(name, params, flow);
    results.push(result);

    if (result.success && result.updatedFlow) {
      flow = result.updatedFlow;
    }
  }

  await writeFlow(flow);
  return results;
}

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function sanitizeId(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

async function executeAddNode(params, flow) {
  const { id, label, description, parentNodeId, edgeLabel } = params;

  if (!label) {
    return { success: false, error: 'label is required' };
  }

  const nodeId = id || sanitizeId(label) || generateId();

  if (flow.nodes.some(n => n.id === nodeId)) {
    return {
      success: false,
      error: `Node ID "${nodeId}" already exists. Please choose a different ID.`
    };
  }

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

async function executeUndo() {
  const previousState = await historyUndo();

  if (!previousState) {
    return { success: false, error: 'Nothing to undo' };
  }

  // Write the restored state back to database (skip snapshot to avoid creating new state)
  await writeFlow(previousState, true);
  return { success: true, updatedFlow: previousState };
}

async function executeRedo() {
  const nextState = await historyRedo();

  if (!nextState) {
    return { success: false, error: 'Nothing to redo' };
  }

  // Write the restored state back to database (skip snapshot to avoid creating new state)
  await writeFlow(nextState, true);
  return { success: true, updatedFlow: nextState };
}


