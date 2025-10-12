import {
  getFlow as dbGetFlow,
  saveFlow as dbSaveFlow,
  getVisualSettings as dbGetVisualSettings,
  saveVisualSettings as dbSaveVisualSettings,
} from '../db.js';
import { DEFAULT_VISUAL_SETTINGS } from '../../shared/visualSettings.js';
import { pushSnapshot, undo as historyUndo, redo as historyRedo } from '../historyService.js';

async function readFlow() {
  return dbGetFlow();
}

async function readSettings() {
  return dbGetVisualSettings();
}

async function writeFlow(flowData, skipSnapshot = false) {
  dbSaveFlow(flowData);
  if (!skipSnapshot) {
    await pushSnapshot(flowData);
  }
}

async function writeSettings(settings) {
  dbSaveVisualSettings(settings);
}

function cloneSettings(settings) {
  return JSON.parse(JSON.stringify(settings || DEFAULT_VISUAL_SETTINGS));
}

function isValidCssColor(color) {
  if (typeof color !== 'string') return false;
  const trimmed = color.trim();
  if (!trimmed) return false;

  const hexPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
  const rgbPattern = /^rgba?\((\s*\d+\s*,){2}\s*\d+\s*(,\s*(0|0?\.\d+|1(\.0+)?)\s*)?\)$/;
  const hslPattern = /^hsla?\((\s*\d+\s*,){2}\s*(0|0?\.\d+|1(\.0+)?)\s*(,\s*(0|0?\.\d+|1(\.0+)?)\s*)?\)$/;
  const namedPattern = /^[a-zA-Z]+$/;
  const gradientPattern = /^(linear|radial)-gradient\(.+\)$/i;

  return (
    hexPattern.test(trimmed) ||
    rgbPattern.test(trimmed) ||
    hslPattern.test(trimmed) ||
    namedPattern.test(trimmed) ||
    gradientPattern.test(trimmed)
  );
}

function adjustByPercentage(value, direction) {
  const factor = direction === 'increase' ? 1.1 : 0.9;
  return Math.round(value * factor * 100) / 100;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

export async function executeTool(toolName, params, flow, settings) {
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
      case 'changeVisuals':
        return await executeChangeVisuals(params, flow, settings);
      case 'changeDimensions':
        return await executeChangeDimensions(params, flow, settings);
      case 'createGroup':
        return await executeCreateGroup(params, flow);
      case 'ungroup':
        return await executeUngroup(params, flow);
      case 'toggleGroupExpansion':
        return await executeToggleGroupExpansion(params, flow);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export async function executeToolCalls(toolCalls) {
  let flow = await readFlow();
  let settings = await readSettings();
  const results = [];
  let flowChanged = false;
  let settingsChanged = false;

  for (const { name, params } of toolCalls) {
    const result = await executeTool(name, params, flow, settings);
    results.push(result);

    if (result.success && result.updatedFlow) {
      flow = result.updatedFlow;
      flowChanged = true;
    }

    if (result.success && result.updatedSettings) {
      settings = result.updatedSettings;
      settingsChanged = true;
    }
  }

  if (flowChanged) {
    await writeFlow(flow);
  }

  if (settingsChanged) {
    await writeSettings(settings);
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

async function executeChangeVisuals(params, flow, settings) {
  const { target, color, property = 'background', nodeId } = params || {};

  if (!target) {
    return { success: false, error: 'target is required' };
  }

  if (!color) {
    return { success: false, error: 'color is required' };
  }

  if (!isValidCssColor(color)) {
    return { success: false, error: 'Invalid color value provided' };
  }

  const allowedProperties = ['background', 'border', 'text'];
  const normalizedProperty = property || 'background';

  if (!allowedProperties.includes(normalizedProperty)) {
    return { success: false, error: `property must be one of: ${allowedProperties.join(', ')}` };
  }

  const nextSettings = cloneSettings(settings);
  nextSettings.colors = nextSettings.colors || { ...DEFAULT_VISUAL_SETTINGS.colors };
  nextSettings.colors.perNode = nextSettings.colors.perNode || {};

  switch (target) {
    case 'background': {
      nextSettings.colors.background = color.trim();
      break;
    }
    case 'all_nodes': {
      nextSettings.colors.allNodes = {
        ...DEFAULT_VISUAL_SETTINGS.colors.allNodes,
        ...(nextSettings.colors.allNodes || {}),
        [normalizedProperty]: color.trim(),
      };
      break;
    }
    case 'node': {
      if (!nodeId) {
        return { success: false, error: 'nodeId is required when target is "node"' };
      }

      const nodeExists = flow.nodes.some((node) => node.id === nodeId);
      if (!nodeExists) {
        return { success: false, error: `Node ${nodeId} not found` };
      }

      const existing = nextSettings.colors.perNode[nodeId] || {};
      nextSettings.colors.perNode[nodeId] = {
        ...existing,
        [normalizedProperty]: color.trim(),
      };
      break;
    }
    default:
      return { success: false, error: 'Invalid target for changeVisuals' };
  }

  return { success: true, updatedSettings: nextSettings };
}

async function executeChangeDimensions(params, flow, settings) {
  const { target, direction, axis = 'both', nodeId } = params || {};

  if (!target) {
    return { success: false, error: 'target is required' };
  }

  if (!direction || !['increase', 'decrease'].includes(direction)) {
    return { success: false, error: 'direction must be "increase" or "decrease"' };
  }

  const allowedAxis = ['horizontal', 'vertical', 'both'];
  if (!allowedAxis.includes(axis)) {
    return { success: false, error: `axis must be one of: ${allowedAxis.join(', ')}` };
  }

  const nextSettings = cloneSettings(settings);
  nextSettings.dimensions = nextSettings.dimensions || { ...DEFAULT_VISUAL_SETTINGS.dimensions };
  nextSettings.dimensions.node = nextSettings.dimensions.node || { ...DEFAULT_VISUAL_SETTINGS.dimensions.node };
  nextSettings.dimensions.node.overrides = nextSettings.dimensions.node.overrides || {};
  nextSettings.dimensions.dagre = nextSettings.dimensions.dagre || { ...DEFAULT_VISUAL_SETTINGS.dimensions.dagre };

  const affectsHorizontal = axis === 'horizontal' || axis === 'both';
  const affectsVertical = axis === 'vertical' || axis === 'both';

  switch (target) {
    case 'all_nodes': {
      const defaultNode = nextSettings.dimensions.node.default || { ...DEFAULT_VISUAL_SETTINGS.dimensions.node.default };
      if (affectsHorizontal) {
        defaultNode.width = clamp(adjustByPercentage(defaultNode.width, direction), 60, 600);
      }
      if (affectsVertical) {
        defaultNode.height = clamp(adjustByPercentage(defaultNode.height, direction), 24, 320);
      }
      nextSettings.dimensions.node.default = defaultNode;
      break;
    }
    case 'node': {
      if (!nodeId) {
        return { success: false, error: 'nodeId is required when target is "node"' };
      }

      const nodeExists = flow.nodes.some((node) => node.id === nodeId);
      if (!nodeExists) {
        return { success: false, error: `Node ${nodeId} not found` };
      }

      const baseNode = nextSettings.dimensions.node.default || DEFAULT_VISUAL_SETTINGS.dimensions.node.default;
      const currentOverride = nextSettings.dimensions.node.overrides[nodeId] || {};
      const currentWidth = currentOverride.width ?? baseNode.width;
      const currentHeight = currentOverride.height ?? baseNode.height;
      const updatedOverride = { ...currentOverride };

      if (affectsHorizontal) {
        updatedOverride.width = clamp(adjustByPercentage(currentWidth, direction), 60, 600);
      }
      if (affectsVertical) {
        updatedOverride.height = clamp(adjustByPercentage(currentHeight, direction), 24, 320);
      }

      nextSettings.dimensions.node.overrides[nodeId] = updatedOverride;
      break;
    }
    case 'layout_spacing': {
      const dagreSpacing = nextSettings.dimensions.dagre || { ...DEFAULT_VISUAL_SETTINGS.dimensions.dagre };
      if (affectsHorizontal) {
        dagreSpacing.horizontal = clamp(adjustByPercentage(dagreSpacing.horizontal, direction), 10, 400);
      }
      if (affectsVertical) {
        dagreSpacing.vertical = clamp(adjustByPercentage(dagreSpacing.vertical, direction), 10, 400);
      }
      nextSettings.dimensions.dagre = dagreSpacing;
      break;
    }
    default:
      return { success: false, error: 'Invalid target for changeDimensions' };
  }

  return { success: true, updatedSettings: nextSettings };
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

  // Check for existing group memberships
  const alreadyGrouped = memberIds.filter(id => {
    const node = flow.nodes.find(n => n.id === id);
    return node && node.parentGroupId;
  });
  if (alreadyGrouped.length > 0) {
    return { success: false, error: `Nodes already in groups: ${alreadyGrouped.join(', ')}` };
  }

  // Calculate position if not provided
  let groupPosition = position;
  if (!groupPosition) {
    const memberNodes = memberIds.map(id => flow.nodes.find(n => n.id === id));
    const avgX = memberNodes.reduce((sum, n) => sum + n.position.x, 0) / memberNodes.length;
    const avgY = memberNodes.reduce((sum, n) => sum + n.position.y, 0) / memberNodes.length;
    groupPosition = { x: avgX, y: avgY - 100 };
  }

  // Generate group ID and label
  const groupId = `group-${Date.now()}`;
  const groupLabel = label || `Group ${Date.now()}`;

  // Create group node
  const groupNode = {
    id: groupId,
    type: 'group',
    isCollapsed: true,
    position: groupPosition,
    data: { label: groupLabel }
  };

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

  // Remove group node
  const updatedNodes = flow.nodes
    .filter(node => node.id !== groupId)
    .map(node => {
      if (node.parentGroupId === groupId) {
        return { ...node, parentGroupId: undefined, hidden: false };
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
