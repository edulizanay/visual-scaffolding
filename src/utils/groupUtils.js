// ABOUTME: Unified group manager handling creation, collapse, visibility, and halos

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

const buildNodeMap = (nodes) =>
  nodes.reduce((acc, node) => {
    acc.set(node.id, node);
    return acc;
  }, new Map());

/**
 * Traverse descendants by parentGroupId (used by multiple operations).
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

export const detectCircularReference = (nodeId, potentialParentId, nodes) => {
  const node = nodes.find((n) => n.id === nodeId);
  const potentialParent = nodes.find((n) => n.id === potentialParentId);

  if (!node || !potentialParent) return false;

  const descendants = getGroupDescendants(nodeId, nodes);
  return descendants.includes(potentialParentId);
};

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
      const a = selectedIds[i];
      const b = selectedIds[j];

      const descendantsA = getGroupDescendants(a, nodes);
      if (descendantsA.includes(b)) {
        return { valid: false, error: 'Cannot group node with its descendant' };
      }

      const descendantsB = getGroupDescendants(b, nodes);
      if (descendantsB.includes(a)) {
        return { valid: false, error: 'Cannot group node with its descendant' };
      }
    }
  }

  return { valid: true };
};

const computeAncestorHiddenSet = (nodes) => {
  const nodeMap = buildNodeMap(nodes);
  const memo = new Map();

  const isHiddenByAncestor = (node) => {
    if (memo.has(node.id)) return memo.get(node.id);

    let current = node;
    while (current?.parentGroupId) {
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

  const hidden = new Set();
  nodes.forEach((node) => {
    if (isHiddenByAncestor(node)) {
      hidden.add(node.id);
    }
  });

  return hidden;
};

export const applyGroupVisibility = (nodes, edges) => {
  const ancestorHidden = computeAncestorHiddenSet(nodes);

  const nextNodes = nodes.map((node) => {
    const hiddenByAncestor = ancestorHidden.has(node.id);
    const previousGroupHidden = node.groupHidden ?? false;
    const previouslyHidden = node.hidden ?? false;

    if (node.type === 'group') {
      const isExpanded = node.isExpanded !== false;
      const wrapperHidden = hiddenByAncestor || isExpanded === true;

      return {
        ...node,
        groupHidden: hiddenByAncestor,
        wrapperHidden,
        hidden: wrapperHidden || (previouslyHidden && !previousGroupHidden),
      };
    }

    return {
      ...node,
      groupHidden: hiddenByAncestor,
      hidden: hiddenByAncestor || (previouslyHidden && !previousGroupHidden),
    };
  });

  const nodeHiddenLookup = nextNodes.reduce((acc, node) => {
    acc.set(node.id, { hidden: node.hidden, groupHidden: node.groupHidden });
    return acc;
  }, new Map());

  const nextEdges = edges.map((edge) => {
    const sourceHidden = nodeHiddenLookup.get(edge.source);
    const targetHidden = nodeHiddenLookup.get(edge.target);

    const hiddenByGroup =
      (sourceHidden?.groupHidden ?? false) || (targetHidden?.groupHidden ?? false);
    const hiddenByNode =
      (sourceHidden?.hidden ?? false) || (targetHidden?.hidden ?? false);
    const effectiveHidden = hiddenByGroup || hiddenByNode;
    const previousGroupHidden = edge.groupHidden ?? false;
    const otherHidden = edge.hidden && !previousGroupHidden;

    return {
      ...edge,
      groupHidden: effectiveHidden,
      hidden: effectiveHidden || otherHidden,
    };
  });

  return { nodes: nextNodes, edges: nextEdges };
};

const buildSyntheticEdges = ({ edges, memberSet, groupId, edgeFactory }) => {
  const factory = edgeFactory || defaultEdgeFactory;
  const synthetic = new Map();

  edges.forEach((edge) => {
    const inSource = memberSet.has(edge.source);
    const inTarget = memberSet.has(edge.target);

    if (inSource && !inTarget) {
      const key = `${groupId}->${edge.target}`;
      if (!synthetic.has(key)) {
        const id = `${GROUP_EDGE_PREFIX}${key}`;
        const newEdge = factory({ id, source: groupId, target: edge.target, originalEdge: edge });
        synthetic.set(key, cloneEdgeWithSyntheticFlag(newEdge));
      }
    } else if (!inSource && inTarget) {
      const key = `${edge.source}->${groupId}`;
      if (!synthetic.has(key)) {
        const id = `${GROUP_EDGE_PREFIX}${key}`;
        const newEdge = factory({ id, source: edge.source, target: groupId, originalEdge: edge });
        synthetic.set(key, cloneEdgeWithSyntheticFlag(newEdge));
      }
    }
  });

  return Array.from(synthetic.values());
};

const normalizeState = (nodes, edges) => applyGroupVisibility(nodes, edges);

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
    memberSet.has(node.id) ? { ...node, parentGroupId: groupId } : node
  );

  const normalizedGroupNode = {
    ...groupNode,
    type: 'group',
    isExpanded: collapse ? false : groupNode.isExpanded ?? true,
    hidden: false,
    groupHidden: false,
  };

  const syntheticEdges = buildSyntheticEdges({ edges, memberSet, groupId, edgeFactory });
  const nextNodes = [...updatedNodes, normalizedGroupNode];
  const nextEdges = [...edges.map((edge) => ({ ...edge })), ...syntheticEdges];

  return normalizeState(nextNodes, nextEdges);
};

export const toggleGroupExpansion = (flow, groupId, expandState = null) => {
  const { nodes, edges } = flow;
  const groupNode = nodes.find((node) => node.id === groupId && node.type === 'group');
  if (!groupNode) return flow;

  const currentExpanded = groupNode.isExpanded !== false;
  const nextExpanded = expandState === null ? !currentExpanded : expandState;

  const updatedNodes = nodes.map((node) =>
    node.id === groupId
      ? { ...node, isExpanded: nextExpanded, hidden: false, groupHidden: false }
      : node
  );

  return normalizeState(updatedNodes, edges);
};

export const ungroup = (flow, groupId) => {
  const { nodes, edges } = flow;
  const groupNode = nodes.find((node) => node.id === groupId && node.type === 'group');
  if (!groupNode) return flow;

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

  return normalizeState(updatedNodes, updatedEdges);
};

export const collapseSubtreeByHandles = (flow, nodeId, collapsed, getDescendantsFn = null) => {
  const { nodes, edges } = flow;
  const target = nodes.find((node) => node.id === nodeId);
  if (!target) return flow;

  const descendants = getDescendantsFn
    ? getDescendantsFn(nodeId, nodes, edges).map((entry) => (typeof entry === 'string' ? entry : entry.id))
    : getGroupDescendants(nodeId, nodes);
  const descendantSet = new Set(descendants);

  const updatedNodes = nodes.map((node) => {
    if (node.id === nodeId) {
      return { ...node, data: { ...node.data, collapsed } };
    }
    if (descendantSet.has(node.id)) {
      return { ...node, hidden: collapsed };
    }
    return node;
  });

  const updatedEdges = edges.map((edge) =>
    descendantSet.has(edge.source) || descendantSet.has(edge.target)
      ? { ...edge, hidden: collapsed }
      : edge
  );

  return { nodes: updatedNodes, edges: updatedEdges };
};

export const addChildNode = (flow, parentId, factory) => {
  const { nodes, edges } = flow;
  const parent = nodes.find((node) => node.id === parentId);
  if (!parent) return flow;

  const { node: newNode, edge: newEdge } = factory(parent);

  const nextNodes = [...nodes, newNode];
  const nextEdges = [...edges, newEdge];

  return normalizeState(nextNodes, nextEdges);
};

export const getExpandedGroupHalos = (nodes, getNodeDimensions, padding = 16) => {
  if (!Array.isArray(nodes) || !nodes.length) return [];

  const halos = [];

  nodes.forEach((groupNode) => {
    if (groupNode?.type !== 'group') return;
    if (groupNode.groupHidden) return;

    const isExpanded = groupNode.isExpanded !== false;
    if (!isExpanded) return;

    const descendantIds = getGroupDescendants(groupNode.id, nodes);
    if (!descendantIds.length) return;

    const descendants = descendantIds
      .map((id) => nodes.find((node) => node.id === id))
      .filter((node) => node && !node.hidden && !node.groupHidden);

    if (!descendants.length) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    descendants.forEach((node) => {
      const { width = 0, height = 0 } = getNodeDimensions ? getNodeDimensions(node) : {};
      const x = node?.position?.x ?? 0;
      const y = node?.position?.y ?? 0;

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + width);
      maxY = Math.max(maxY, y + height);
    });

    if (!isFinite(minX) || !isFinite(minY) || !isFinite(maxX) || !isFinite(maxY)) {
      return;
    }

    halos.push({
      groupId: groupNode.id,
      label: groupNode?.data?.label ?? 'Group',
      bounds: {
        x: minX - padding,
        y: minY - padding,
        width: (maxX - minX) + padding * 2,
        height: (maxY - minY) + padding * 2,
      },
    });
  });

  return halos;
};

export const constants = {
  GROUP_EDGE_PREFIX,
};
