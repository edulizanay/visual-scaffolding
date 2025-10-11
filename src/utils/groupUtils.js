// ABOUTME: Utility functions to manage group node state, visibility, and edges
// ABOUTME: Centralizes group operations for consistency across the app

const GROUP_EDGE_PREFIX = 'group-edge-';

const defaultEdgeFactory = ({ id, source, target }) => ({
  id,
  source,
  target,
  type: 'smoothstep',
});

const cloneEdgeWithSyntheticFlag = (edge) => {
  const data = edge.data ? { ...edge.data } : {};
  return {
    ...edge,
    data: {
      ...data,
      isSyntheticGroupEdge: true,
    },
  };
};

/**
 * Traverse descendants by parentGroupId (for group operations).
 */
export const getGroupDescendants = (nodeId, nodes) => {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return [];

  const visited = new Set();
  const descendants = [];

  const traverse = (currentId) => {
    if (visited.has(currentId)) return;
    visited.add(currentId);

    const children = nodes.filter((n) => n.parentGroupId === currentId);
    children.forEach((child) => {
      descendants.push(child.id);
      traverse(child.id);
    });
  };

  traverse(nodeId);
  return descendants;
};

/**
 * Detect if making nodeId a member of potentialParentId would create circular reference.
 */
export const detectCircularReference = (nodeId, potentialParentId, nodes) => {
  const node = nodes.find((n) => n.id === nodeId);
  const potentialParent = nodes.find((n) => n.id === potentialParentId);

  if (!node || !potentialParent) return false;

  const descendants = getGroupDescendants(nodeId, nodes);
  return descendants.includes(potentialParentId);
};

/**
 * Validate that a set of nodes can be grouped together.
 */
export const validateGroupMembership = (selectedIds, nodes) => {
  if (selectedIds.length < 2) {
    return { valid: false, error: 'Group must contain at least 2 nodes' };
  }

  const uniqueIds = new Set(selectedIds);
  if (uniqueIds.size !== selectedIds.length) {
    return { valid: false, error: 'Cannot group duplicate nodes' };
  }

  for (const id of selectedIds) {
    const node = nodes.find((n) => n.id === id);
    if (!node) {
      return { valid: false, error: `Node ${id} not found` };
    }
  }

  for (let i = 0; i < selectedIds.length; i += 1) {
    for (let j = i + 1; j < selectedIds.length; j += 1) {
      const id1 = selectedIds[i];
      const id2 = selectedIds[j];

      const descendants1 = getGroupDescendants(id1, nodes);
      if (descendants1.includes(id2)) {
        return { valid: false, error: 'Cannot group node with its descendant' };
      }

      const descendants2 = getGroupDescendants(id2, nodes);
      if (descendants2.includes(id1)) {
        return { valid: false, error: 'Cannot group node with its descendant' };
      }
    }
  }

  return { valid: true };
};

const buildSyntheticEdges = ({ edges, memberSet, groupId, edgeFactory }) => {
  const factory = edgeFactory || defaultEdgeFactory;
  const syntheticEdges = new Map();

  edges.forEach((edge) => {
    const sourceInGroup = memberSet.has(edge.source);
    const targetInGroup = memberSet.has(edge.target);

    if (sourceInGroup && !targetInGroup) {
      const key = `${groupId}->${edge.target}`;
      if (!syntheticEdges.has(key)) {
        const id = `${GROUP_EDGE_PREFIX}${key}`;
        const newEdge = factory({ id, source: groupId, target: edge.target, originalEdge: edge });
        syntheticEdges.set(key, cloneEdgeWithSyntheticFlag(newEdge));
      }
    } else if (!sourceInGroup && targetInGroup) {
      const key = `${edge.source}->${groupId}`;
      if (!syntheticEdges.has(key)) {
        const id = `${GROUP_EDGE_PREFIX}${key}`;
        const newEdge = factory({ id, source: edge.source, target: groupId, originalEdge: edge });
        syntheticEdges.set(key, cloneEdgeWithSyntheticFlag(newEdge));
      }
    }
  });

  return Array.from(syntheticEdges.values());
};

const buildNodeMap = (nodes) =>
  nodes.reduce((acc, node) => {
    acc.set(node.id, node);
    return acc;
  }, new Map());

const computeGroupHiddenSet = (nodes) => {
  const nodeMap = buildNodeMap(nodes);
  const memo = new Map();

  const isHidden = (node) => {
    if (memo.has(node.id)) {
      return memo.get(node.id);
    }

    let current = node;
    while (current && current.parentGroupId) {
      const parent = nodeMap.get(current.parentGroupId);
      if (!parent) break;
      if (parent.isExpanded === false) {
        memo.set(node.id, true);
        return true;
      }
      current = parent;
    }

    memo.set(node.id, false);
    return false;
  };

  const hiddenSet = new Set();
  nodes.forEach((node) => {
    if (isHidden(node)) {
      hiddenSet.add(node.id);
    }
  });

  return hiddenSet;
};

/**
 * Recalculate hidden states for nodes and edges based on collapsed groups.
 */
export const applyGroupVisibility = (nodes, edges) => {
  const hiddenSet = computeGroupHiddenSet(nodes);

  const nextNodes = nodes.map((node) => {
    const isGroup = node.type === 'group';

    if (isGroup) {
      const isExpanded = node.isExpanded !== false;
      const previousGroupHidden = node.groupHidden ?? false;
      const otherHidden = node.hidden && !previousGroupHidden;
      const forcedHidden = isExpanded;

      return {
        ...node,
        groupHidden: false,
        hidden: forcedHidden || otherHidden,
      };
    }

    const groupHidden = hiddenSet.has(node.id);
    const previousGroupHidden = node.groupHidden ?? false;
    const otherHidden = node.hidden && !previousGroupHidden;

    return {
      ...node,
      groupHidden,
      hidden: groupHidden || otherHidden,
    };
  });

  const nodeHiddenLookup = nextNodes.reduce((acc, node) => {
    acc.set(node.id, { groupHidden: node.groupHidden, hidden: node.hidden });
    return acc;
  }, new Map());

  const nextEdges = edges.map((edge) => {
    const sourceHidden = nodeHiddenLookup.get(edge.source);
    const targetHidden = nodeHiddenLookup.get(edge.target);

    const groupHidden =
      (sourceHidden?.groupHidden ?? false) || (targetHidden?.groupHidden ?? false);
    const connectedNodeHidden =
      (sourceHidden?.hidden ?? false) || (targetHidden?.hidden ?? false);
    const effectiveGroupHidden = groupHidden || connectedNodeHidden;
    const previousGroupHidden = edge.groupHidden ?? false;
    const otherHidden = edge.hidden && !previousGroupHidden;

    return {
      ...edge,
      groupHidden: effectiveGroupHidden,
      hidden: effectiveGroupHidden || otherHidden,
    };
  });

  return { nodes: nextNodes, edges: nextEdges };
};

/**
 * Create a collapsed or expanded group with synthetic edges.
 */
export const createGroup = (flow, options) => {
  const { nodes, edges } = flow;
  const {
    groupNode,
    memberIds,
    collapse = true,
    edgeFactory,
  } = options;

  if (!groupNode || !groupNode.id) {
    throw new Error('groupNode with valid id is required');
  }

  const groupId = groupNode.id;
  const memberSet = new Set(memberIds);

  const updatedNodes = nodes.map((node) =>
    memberSet.has(node.id)
      ? { ...node, parentGroupId: groupId }
      : node
  );

  const normalizedGroupNode = {
    ...groupNode,
    type: groupNode.type ?? 'group',
    isExpanded: collapse ? false : groupNode.isExpanded ?? true,
    hidden: false,
    groupHidden: false,
  };

  const syntheticEdges = buildSyntheticEdges({
    edges,
    memberSet,
    groupId,
    edgeFactory,
  });

  const nextNodes = [...updatedNodes, normalizedGroupNode];
  const nextEdges = [...edges.map((edge) => ({ ...edge })), ...syntheticEdges];

  return applyGroupVisibility(nextNodes, nextEdges);
};

/**
 * Toggle (or explicitly set) group expansion state and re-apply visibility.
 */
export const toggleGroupExpansion = (flow, groupId, expandState = null) => {
  const { nodes, edges } = flow;
  const groupNode = nodes.find((node) => node.id === groupId && node.type === 'group');
  if (!groupNode) {
    return flow;
  }

  const currentExpanded = groupNode.isExpanded !== false;
  const nextExpanded = expandState === null ? !currentExpanded : expandState;

  const updatedNodes = nodes.map((node) =>
    node.id === groupId
      ? { ...node, isExpanded: nextExpanded, hidden: false, groupHidden: false }
      : node
  );

  return applyGroupVisibility(updatedNodes, edges);
};

/**
 * Remove a group node, unassign members, and clean up synthetic edges.
 */
export const ungroup = (flow, groupId) => {
  const { nodes, edges } = flow;
  const groupNode = nodes.find((node) => node.id === groupId && node.type === 'group');
  if (!groupNode) {
    return flow;
  }

  const updatedNodes = nodes
    .filter((node) => node.id !== groupId)
    .map((node) =>
      node.parentGroupId === groupId
        ? { ...node, parentGroupId: undefined }
        : node
    );

  const updatedEdges = edges
    .filter((edge) => edge.source !== groupId && edge.target !== groupId)
    .map((edge) => ({ ...edge }));

  return applyGroupVisibility(updatedNodes, updatedEdges);
};

export const constants = {
  GROUP_EDGE_PREFIX,
};
