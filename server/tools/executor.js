import {
  getFlow as dbGetFlow,
  saveFlow as dbSaveFlow,
} from '../db.js';
import { pushSnapshot, undo as historyUndo, redo as historyRedo } from '../historyService.js';
import { applyDagreLayout } from '../../shared/layout/applyDagreLayout.js';
import { NODE_WIDTH, NODE_HEIGHT } from '../../shared/constants/nodeDimensions.js';
import { collapseSubtreeByHandles, getAllDescendants } from '../../shared/flowUtils/subtreeHelpers.js';

async function readFlow() {
  return dbGetFlow();
}

async function writeFlow(flowData, skipSnapshot = false, origin = null) {
  dbSaveFlow(flowData);
  if (!skipSnapshot) {
    await pushSnapshot(flowData, origin);
  }
}

/**
 * Log structured tool execution metrics
 * @param {string} tool - Tool name
 * @param {string} origin - Origin metadata (ui.drag, ui.subtree, llm.tool, etc.)
 * @param {number} duration - Execution duration in ms
 * @param {Object} result - Tool execution result
 */
function logToolExecution(tool, origin, duration, result) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    tool,
    origin,
    duration: `${duration}ms`,
    success: result.success,
  };

  if (!result.success) {
    logEntry.error = result.error;
  }

  console.log('[TOOL_EXECUTION]', JSON.stringify(logEntry));
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
      case 'createGroup':
        return await executeCreateGroup(params, flow);
      case 'ungroup':
        return await executeUngroup(params, flow);
      case 'toggleGroupExpansion':
        return await executeToggleGroupExpansion(params, flow);
      case 'autoLayout':
        return await executeAutoLayout(params, flow);
      case 'toggleSubtreeCollapse':
        return await executeToggleSubtreeCollapse(params, flow);
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
  let flowChanged = false;

  for (const { name, params } of toolCalls) {
    const startTime = Date.now();
    const result = await executeTool(name, params, flow);
    const duration = Date.now() - startTime;

    logToolExecution(name, 'llm.tool', duration, result);
    results.push(result);

    if (result.success && result.updatedFlow) {
      flow = result.updatedFlow;
      flowChanged = true;
    }
  }

  if (flowChanged) {
    await writeFlow(flow, false, 'llm.tool');
  }

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

  // Generate label if not provided
  const finalLabel = label || `Node ${Date.now()}`;

  const nodeId = id || sanitizeId(finalLabel) || generateId();

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
    data: { label: finalLabel }
  };

  if (description) {
    newNode.data.description = description;
  }

  // Inherit group membership from parent
  if (parentNode && parentNode.parentGroupId) {
    newNode.parentGroupId = parentNode.parentGroupId;
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

  if (!edgeId) {
    return { success: false, error: 'edgeId is required' };
  }

  const edge = flow.edges.find(e => e.id === edgeId);

  if (!edge) {
    return { success: false, error: `Edge ${edgeId} not found` };
  }

  if (label !== undefined) {
    if (!edge.data) {
      edge.data = {};
    }
    edge.data.label = label;
  }

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

// Group operation executors
async function executeCreateGroup(params, flow) {
  const { memberIds, label, position } = params;

  if (!memberIds || !Array.isArray(memberIds) || memberIds.length < 2) {
    return { success: false, error: 'At least 2 memberIds are required' };
  }

  // Validate all member nodes exist
  const missingNodes = memberIds.filter(id => !flow.nodes.some(n => n.id === id));
  if (missingNodes.length > 0) {
    return { success: false, error: `Nodes not found: ${missingNodes.join(', ')}` };
  }

  // Validate no duplicates
  const uniqueIds = [...new Set(memberIds)];
  if (uniqueIds.length !== memberIds.length) {
    return { success: false, error: 'Duplicate member IDs provided' };
  }

  // Check that all nodes belong to the same parent group (or no parent group)
  // This allows: ungrouped nodes, nodes from same group, or group nodes themselves
  // This prevents: mixing nodes from different parent groups
  const parentGroups = new Set();
  memberIds.forEach(id => {
    const node = flow.nodes.find(n => n.id === id);
    if (node && node.parentGroupId) {
      parentGroups.add(node.parentGroupId);
    }
  });

  if (parentGroups.size > 1) {
    return {
      success: false,
      error: `Cannot group nodes from different parent groups: ${[...parentGroups].join(', ')}`
    };
  }

  const parentGroupId =
    parentGroups.size === 1 ? parentGroups.values().next().value : undefined;

  // Calculate position if not provided - to the left of the members
  let groupPosition = position;
  if (!groupPosition) {
    const memberNodes = memberIds.map(id => flow.nodes.find(n => n.id === id));
    const minX = Math.min(...memberNodes.map(n => n.position.x));
    const avgY = memberNodes.reduce((sum, n) => sum + n.position.y, 0) / memberNodes.length;
    groupPosition = { x: minX, y: avgY };

  }

  // Generate group ID and label
  const groupId = generateId();
  const groupLabel = label || `Group ${Date.now()}`;

  // Create group node
  const groupNode = {
    id: groupId,
    type: 'group',
    isCollapsed: true,
    position: groupPosition,
    data: { label: groupLabel }
  };
  if (parentGroupId) {
    groupNode.parentGroupId = parentGroupId;
  }

  // Update member nodes to belong to group
  const updatedNodes = flow.nodes.map(node => {
    if (memberIds.includes(node.id)) {
      return { ...node, parentGroupId: groupId, hidden: true };
    }
    return node;
  });

  // Add group node
  updatedNodes.push(groupNode);

  // Synthetic edges are now computed dynamically by the frontend
  // No need to create them here - they'll be generated in applyGroupVisibility
  return { success: true, groupId, updatedFlow: { nodes: updatedNodes, edges: flow.edges } };
}

async function executeUngroup(params, flow) {
  const { groupId } = params;

  if (!groupId) {
    return { success: false, error: 'groupId is required' };
  }

  const groupNode = flow.nodes.find(n => n.id === groupId && n.type === 'group');
  if (!groupNode) {
    return { success: false, error: `Group ${groupId} not found` };
  }

  // Find all member nodes
  const memberNodes = flow.nodes.filter(n => n.parentGroupId === groupId);
  if (memberNodes.length === 0) {
    return { success: false, error: 'Group has no members' };
  }

  const parentGroupId = groupNode.parentGroupId;

  // Remove group node
  const updatedNodes = flow.nodes
    .filter(node => node.id !== groupId)
    .map(node => {
      if (node.parentGroupId === groupId) {
        const next = {
          ...node,
          hidden: false,
          groupHidden: false,
        };

        if (parentGroupId) {
          next.parentGroupId = parentGroupId;
        } else if ('parentGroupId' in next) {
          delete next.parentGroupId;
        }

        if ('subtreeHidden' in next) {
          delete next.subtreeHidden;
        }

        return next;
      }
      return node;
    });

  // Synthetic edges are automatically cleaned up by frontend applyGroupVisibility
  return { success: true, updatedFlow: { nodes: updatedNodes, edges: flow.edges } };
}

async function executeToggleGroupExpansion(params, flow) {
  const { groupId, expand } = params;

  if (!groupId) {
    return { success: false, error: 'groupId is required' };
  }

  const groupNode = flow.nodes.find(n => n.id === groupId && n.type === 'group');
  if (!groupNode) {
    return { success: false, error: `Group ${groupId} not found` };
  }

  // Find all member nodes
  const memberNodes = flow.nodes.filter(n => n.parentGroupId === groupId);

  // Convert expand to collapse (inverted semantics)
  const collapse = !expand;

  // Update group collapse state
  const updatedNodes = flow.nodes.map(node => {
    if (node.id === groupId) {
      return { ...node, isCollapsed: collapse };
    }
    if (memberNodes.some(member => member.id === node.id)) {
      return { ...node, hidden: collapse };
    }
    return node;
  });

  // Synthetic edges and their visibility are handled by frontend applyGroupVisibility
  return { success: true, updatedFlow: { nodes: updatedNodes, edges: flow.edges } };
}

async function executeAutoLayout(params, flow) {
  // Apply Dagre layout to the flow
  const { nodes: layoutedNodes, edges: layoutedEdges } = applyDagreLayout({
    nodes: flow.nodes,
    edges: flow.edges,
    direction: 'LR',
    nodeDimensions: { width: NODE_WIDTH, height: NODE_HEIGHT },
  });

  // Compare positions to check if anything changed
  const positionsChanged = flow.nodes.some((node) => {
    const layoutedNode = layoutedNodes.find(n => n.id === node.id);
    if (!layoutedNode) return false;

    return (
      Math.abs(node.position.x - layoutedNode.position.x) > 0.01 ||
      Math.abs(node.position.y - layoutedNode.position.y) > 0.01
    );
  });

  if (!positionsChanged) {
    // No changes - return original flow to avoid unnecessary write
    return {
      tool: 'autoLayout',
      success: true,
      updatedFlow: flow,
      didChange: false,
    };
  }

  // Positions changed - return updated flow (executeToolCalls will write it)
  const updatedFlow = { nodes: layoutedNodes, edges: layoutedEdges };

  return {
    tool: 'autoLayout',
    success: true,
    updatedFlow,
  };
}

/**
 * Toggle subtree collapse/expand
 *
 * Sets data.collapsed on the parent node and toggles hidden/subtreeHidden
 * on all descendants based on edge-based traversal.
 */
async function executeToggleSubtreeCollapse(params, flow) {
  const { nodeId, collapsed } = params;

  if (!nodeId) {
    return { success: false, error: 'nodeId is required' };
  }

  if (typeof collapsed !== 'boolean') {
    return { success: false, error: 'collapsed must be a boolean' };
  }

  const node = flow.nodes.find(n => n.id === nodeId);
  if (!node) {
    return { success: false, error: `Node ${nodeId} not found` };
  }

  // Use shared collapse logic with edge-based descendant traversal
  const result = collapseSubtreeByHandles(flow, nodeId, collapsed, getAllDescendants);

  return {
    success: true,
    updatedFlow: result,
  };
}
