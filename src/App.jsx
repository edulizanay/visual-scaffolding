// ABOUTME: Main application component with React Flow canvas
// ABOUTME: Loads flow from backend and auto-saves changes
import { useCallback, useMemo, useEffect, useState, useRef } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Position,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import Node from './Node';
import Edge from './Edge';
import { 
  loadFlow, 
  saveFlow, 
  undoFlow, 
  redoFlow, 
  getHistoryStatus,
  createNode,
  updateNode,
  createEdge,
  updateEdge,
  createGroup as apiCreateGroup,
  ungroup as apiUngroup,
  toggleGroupExpansion as apiToggleGroupExpansion
} from './api';
import ChatInterface, { Kbd } from './ChatInterface';
import { useFlowLayout } from './hooks/useFlowLayout';
import { DEFAULT_VISUAL_SETTINGS, mergeWithDefaultVisualSettings } from '../shared/visualSettings.js';
import {
  validateGroupMembership,
  getGroupDescendants,
  collapseSubtreeByHandles,
  addChildNode,
  getExpandedGroupHalos,
  GroupHaloOverlay,
  HALO_PADDING,
} from './utils/groupUtils.js';

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [toast, setToast] = useState(null); // 'undo' | 'redo' | null
  const [isBackendProcessing, setIsBackendProcessing] = useState(false);
  const reactFlowInstance = useRef(null);
  const nodesRef = useRef([]);
  const edgesRef = useRef([]);
  const [visualSettings, setVisualSettings] = useState(DEFAULT_VISUAL_SETTINGS);
  const [selectedNodeIds, setSelectedNodeIds] = useState([]); // Multi-select state

  const {
    applyLayoutWithAnimation,
    isAnimating,
    fitViewPadding,
    getAllDescendants,
  } = useFlowLayout(
    setNodes,
    setEdges,
    reactFlowInstance,
    visualSettings
  );

  const onInit = useCallback((instance) => {
    reactFlowInstance.current = instance;
  }, []);

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  useEffect(() => {
    const fetchFlow = async () => {
      try {
        const flow = await loadFlow();
        const settings = mergeWithDefaultVisualSettings(flow.settings || {});
        setVisualSettings(settings);

        const nodesWithPosition = flow.nodes.map(node => ({
          ...node,
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        }));

        setNodes(nodesWithPosition);
        setEdges(flow.edges);
      } catch (error) {
        console.error('Failed to load flow:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFlow();
  }, [setNodes, setEdges]);

  useEffect(() => {
    if (isLoading || isAnimating || isBackendProcessing) return;

    const timeoutId = setTimeout(async () => {
      try {
        await saveFlow(nodes, edges);
        if (canUndo) {
          setToast('undo');
        }
      } catch (error) {
        console.error('Failed to save flow:', error);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, isLoading, canUndo, isAnimating, isBackendProcessing]);

  const handleFlowUpdate = useCallback((updatedFlow) => {
    if (!updatedFlow) return;

    const mergedSettings = mergeWithDefaultVisualSettings(updatedFlow.settings || {});
    setVisualSettings(mergedSettings);

    const nodesWithPosition = updatedFlow.nodes.map(node => ({
      ...node,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }));

    setNodes(nodesWithPosition);
    setEdges(updatedFlow.edges);

    // Auto-layout when LLM adds nodes
    setTimeout(() => {
      applyLayoutWithAnimation(nodesWithPosition, updatedFlow.edges);
    }, 100);
  }, [setNodes, setEdges, applyLayoutWithAnimation]);

  const updateNodeLabel = useCallback(async (nodeId, newLabel) => {
    try {
      const result = await updateNode(nodeId, { label: newLabel });
      if (result.success) {
        handleFlowUpdate(result.flow);
      } else {
        console.error('Failed to update node label:', result.error);
      }
    } catch (error) {
      console.error('Error updating node label:', error);
    }
  }, [handleFlowUpdate]);

  const updateNodeDescription = useCallback(async (nodeId, newDescription) => {
    try {
      const result = await updateNode(nodeId, { description: newDescription });
      if (result.success) {
        handleFlowUpdate(result.flow);
      } else {
        console.error('Failed to update node description:', result.error);
      }
    } catch (error) {
      console.error('Error updating node description:', error);
    }
  }, [handleFlowUpdate]);

  const updateEdgeLabel = useCallback(async (edgeId, newLabel) => {
    try {
      const result = await updateEdge(edgeId, { label: newLabel });
      if (result.success) {
        handleFlowUpdate(result.flow);
      } else {
        console.error('Failed to update edge label:', result.error);
      }
    } catch (error) {
      console.error('Error updating edge label:', error);
    }
  }, [handleFlowUpdate]);

  const createChildNode = useCallback(async (parentNodeId) => {
    try {
      const result = await createNode({
        label: `Node ${Date.now()}`,
        description: '',
        parentNodeId: parentNodeId,
        edgeLabel: ''
      });
      if (result.success) {
        handleFlowUpdate(result.flow);
      } else {
        console.error('Failed to create child node:', result.error);
      }
    } catch (error) {
      console.error('Error creating child node:', error);
    }
  }, [handleFlowUpdate]);

  const getNodeDimensions = useCallback((node) => {
    const defaultNodeDimensions = visualSettings.dimensions?.node?.default ?? DEFAULT_VISUAL_SETTINGS.dimensions.node.default;
    const overrides = visualSettings.dimensions?.node?.overrides ?? {};
    const override = overrides[node.id] || {};
    const baseWidth = defaultNodeDimensions.width;
    const baseHeight = defaultNodeDimensions.height;

    return {
      width: override.width ?? baseWidth,
      height: override.height ?? baseHeight,
      borderRadius: override.borderRadius ?? defaultNodeDimensions.borderRadius,
    };
  }, [visualSettings]);

  const scheduleLayout = useCallback((nextNodes, nextEdges) => {
    setTimeout(() => {
      applyLayoutWithAnimation(nextNodes, nextEdges);
    }, 0);
  }, [applyLayoutWithAnimation]);

  const commitFlow = useCallback((nextFlow, { selection = null, layout = true } = {}) => {
    if (!nextFlow) return;
    setNodes(nextFlow.nodes);
    setEdges(nextFlow.edges);
    if (selection) {
      setSelectedNodeIds(selection);
    }
    if (layout) {
      scheduleLayout(nextFlow.nodes, nextFlow.edges);
    }
  }, [scheduleLayout, setNodes, setEdges]);

  const nodesWithHandlers = useMemo(() => {
    const globalColors = visualSettings.colors?.allNodes ?? DEFAULT_VISUAL_SETTINGS.colors.allNodes;
    const perNodeColors = visualSettings.colors?.perNode ?? {};

    return nodes.map((node) => {
      const isGroupNode = node.type === 'group';
      const isCollapsed = isGroupNode && node.isCollapsed === true;
      const { width, height, borderRadius } = getNodeDimensions(node);

      const nodeColorOverrides = perNodeColors[node.id] || {};
      // HARDCODED: Group node colors (distinct from regular nodes)
      const defaultBackground = isGroupNode ? '#3730a3' : globalColors.background; // Indigo for groups
      const defaultBorder = isGroupNode ? '#6366f1' : globalColors.border; // Lighter indigo border
      const background = nodeColorOverrides.background ?? defaultBackground;
      const border = nodeColorOverrides.border ?? defaultBorder;
      const text = nodeColorOverrides.text ?? globalColors.text;

      const isSelected = selectedNodeIds.includes(node.id);

      // Count members if collapsed
      const memberCount = isCollapsed ? getGroupDescendants(node.id, nodes).length : 0;

      const baseStyle = {
        background,
        borderWidth: '1px',
        borderStyle: 'solid',
        borderColor: border,
        color: text,
        width,
        minWidth: width,
        height,
        minHeight: height,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px',
        boxSizing: 'border-box',
        borderRadius: `${borderRadius}px`,
      };

      return {
        ...node,
        data: {
          ...node.data,
          onLabelChange: updateNodeLabel,
          onDescriptionChange: updateNodeDescription,
          textColor: text,
          // Show member count for collapsed groups
          label: isCollapsed ? `${node.data.label} (${memberCount} nodes)` : node.data.label,
        },
        style: {
          ...(node.style || {}),
          ...baseStyle,
          ...(node.data.collapsed
            ? {
                borderWidth: '2px',
                borderColor: 'rgba(255, 255, 255, 0.4)',
              }
            : {}),
          // Selection visual: 40% more prominent stroke
          ...(isSelected
            ? {
                borderWidth: '2.4px',
                borderColor: 'rgba(96, 165, 250, 0.8)',
                boxShadow: '0 0 0 2px rgba(96, 165, 250, 0.3)',
              }
            : {}),
        },
      };
    });
  }, [nodes, updateNodeLabel, updateNodeDescription, visualSettings, selectedNodeIds, getNodeDimensions]);

  const edgesWithHandlers = useMemo(() => {
    return edges.map((edge) => ({
      ...edge,
      type: 'smoothstep',
      data: {
        ...edge.data,
        onLabelChange: updateEdgeLabel,
      },
    }));
  }, [edges, updateEdgeLabel]);

  const nodeTypes = useMemo(() => ({ default: Node, group: Node }), []);
  const edgeTypes = useMemo(() => ({ smoothstep: Edge }), []);

  const onConnect = useCallback(async (params) => {
    try {
      const result = await createEdge({
        sourceNodeId: params.source,
        targetNodeId: params.target,
        label: ''
      });
      if (result.success) {
        handleFlowUpdate(result.flow);
      } else {
        console.error('Failed to create edge:', result.error);
      }
    } catch (error) {
      console.error('Error creating edge:', error);
    }
  }, [handleFlowUpdate]);

  const onPaneClick = useCallback(() => {
    setSelectedNodeIds([]);
  }, [setSelectedNodeIds]);

  const applyGroupExpansion = useCallback(async (groupId, collapseState = null) => {
    try {
      // If collapseState is null, toggle based on current state
      let collapse = collapseState;
      if (collapse === null) {
        const groupNode = nodesRef.current.find(n => n.id === groupId);
        collapse = !groupNode?.isCollapsed;
      }

      const result = await apiToggleGroupExpansion(groupId, collapse);
      if (result.success) {
        handleFlowUpdate(result.flow);
      } else {
        console.error('Failed to toggle group expansion:', result.error);
      }
    } catch (error) {
      console.error('Error toggling group expansion:', error);
    }
  }, [handleFlowUpdate]);

  const groupHalos = useMemo(
    () => getExpandedGroupHalos(nodes, getNodeDimensions, HALO_PADDING),
    [nodes, getNodeDimensions],
  );

  const collapseExpandedGroup = useCallback(
    (groupId) => applyGroupExpansion(groupId, true),
    [applyGroupExpansion],
  );

  const onNodeDoubleClick = useCallback(
    (event, node) => {
      // Double-click on group node: toggle collapse/expand
      if (node.type === 'group') {
        applyGroupExpansion(node.id);
        return;
      }
      // Cmd+Double-click: Create child node (existing behavior)
      else if (event.metaKey || event.ctrlKey) {
        createChildNode(node.id);
      }
    },
    [applyGroupExpansion, createChildNode],
  );

  const onNodeClick = useCallback(
    (event, node) => {
      // Alt+Click: Collapse/expand subtree (existing behavior)
      if (event.altKey) {
        const isCurrentlyCollapsed = node.data?.collapsed || false;
        const nextFlow = collapseSubtreeByHandles(
          { nodes: nodesRef.current, edges: edgesRef.current },
          node.id,
          !isCurrentlyCollapsed,
          getAllDescendants
        );

        commitFlow(nextFlow);
      }
      // Cmd+Click: Toggle selection
      else if (event.metaKey || event.ctrlKey) {
        setSelectedNodeIds(prev => {
          if (prev.includes(node.id)) {
            // Deselect
            return prev.filter(id => id !== node.id);
          } else {
            // Select
            return [...prev, node.id];
          }
        });
      }
      // Regular click: Clear selection
      else {
        setSelectedNodeIds([]);
      }
    },
    [commitFlow, setSelectedNodeIds, getAllDescendants]
  );

  const updateHistoryStatus = useCallback(async () => {
    try {
      const status = await getHistoryStatus();
      setCanUndo(status.canUndo);
    } catch (error) {
      console.error('Failed to get history status:', error);
    }
  }, []);

  const handleUndo = useCallback(async () => {
    try {
      const result = await undoFlow();
      if (result.success && result.flow) {
        handleFlowUpdate(result.flow);
        await updateHistoryStatus();
        setToast('redo');
      }
    } catch (error) {
      console.error('Failed to undo:', error);
    }
  }, [handleFlowUpdate, updateHistoryStatus]);

  const handleRedo = useCallback(async () => {
    try {
      const result = await redoFlow();
      if (result.success && result.flow) {
        handleFlowUpdate(result.flow);
        await updateHistoryStatus();
        setToast('undo');
      }
    } catch (error) {
      console.error('Failed to redo:', error);
    }
  }, [handleFlowUpdate, updateHistoryStatus]);

  const handleCreateGroup = useCallback(async () => {
    if (selectedNodeIds.length < 2) {
      alert('Please select at least 2 nodes to create a group');
      return;
    }

    const validation = validateGroupMembership(selectedNodeIds, nodes);
    if (!validation.valid) {
      alert(`Cannot create group: ${validation.error}`);
      return;
    }

    try {
      const result = await apiCreateGroup({
        memberIds: selectedNodeIds,
        label: `Group ${Date.now()}`
      });
      if (result.success) {
        handleFlowUpdate(result.flow);
        setSelectedNodeIds([]);
      } else {
        alert(`Failed to create group: ${result.error}`);
      }
    } catch (error) {
      console.error('Error creating group:', error);
      alert('Failed to create group');
    }
  }, [selectedNodeIds, nodes, validateGroupMembership, handleFlowUpdate, setSelectedNodeIds]);

  const ungroupNodes = useCallback(async () => {
    if (selectedNodeIds.length !== 1) {
      alert('Please select exactly 1 group node to ungroup');
      return;
    }

    const groupId = selectedNodeIds[0];
    const groupNode = nodes.find((n) => n.id === groupId);

    if (!groupNode || groupNode.type !== 'group') {
      alert('Selected node is not a group');
      return;
    }

    try {
      const result = await apiUngroup(groupId);
      if (result.success) {
        handleFlowUpdate(result.flow);
        setSelectedNodeIds([]);
      } else {
        alert(`Failed to ungroup: ${result.error}`);
      }
    } catch (error) {
      console.error('Error ungrouping:', error);
      alert('Failed to ungroup');
    }
  }, [selectedNodeIds, nodes, handleFlowUpdate, setSelectedNodeIds]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'G') {
        // Cmd+Shift+G: Ungroup
        e.preventDefault();
        ungroupNodes();
      } else if ((e.metaKey || e.ctrlKey) && e.key === 'g') {
        // Cmd+G: Group
        e.preventDefault();
        handleCreateGroup();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, handleCreateGroup, ungroupNodes]);

  useEffect(() => {
    updateHistoryStatus();
    const interval = setInterval(updateHistoryStatus, 1000);
    return () => clearInterval(interval);
  }, [updateHistoryStatus]);

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => {
        setToast(null);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  if (isLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '100vh', color: 'white' }}>Loading...</div>;
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edgesWithHandlers}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onInit={onInit}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="dark"
        style={{ background: visualSettings.colors?.background ?? DEFAULT_VISUAL_SETTINGS.colors.background }}
        fitView
        fitViewOptions={{ padding: fitViewPadding }}
        proOptions={{ hideAttribution: true }}
      >
        <GroupHaloOverlay halos={groupHalos} onCollapse={collapseExpandedGroup} />
      </ReactFlow>
      <ChatInterface onFlowUpdate={handleFlowUpdate} onProcessingChange={setIsBackendProcessing} />

      {/* Tooltip section (bottom-right corner) */}
      {selectedNodeIds.length >= 2 && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: 'rgba(30, 30, 30, 0.95)',
          border: '1px solid rgba(96, 165, 250, 0.3)',
          borderRadius: '8px',
          padding: '12px 16px',
          animation: 'slideIn 0.3s ease-out',
        }}>
          <span style={{ color: '#e5e7eb', fontSize: '14px' }}>
            {selectedNodeIds.length} nodes selected
          </span>
          <div style={{ width: '1px', height: '16px', background: 'rgba(255, 255, 255, 0.2)' }}></div>
          <Kbd style={{ gap: '4px', padding: '4px 8px', borderRadius: '6px', fontSize: '14px' }}>⌘ G</Kbd>
          <span style={{ color: '#9ca3af', fontSize: '13px' }}>to group</span>
        </div>
      )}

      {toast && (
        <div style={{
          position: 'fixed',
          top: 20,
          right: 20,
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          animation: 'slideIn 0.3s ease-out',
        }}>
          <Kbd style={{ gap: '4px', padding: '4px 8px', borderRadius: '6px', fontSize: '14px' }}>{toast === 'undo' ? '⌘ Z' : '⌘ Y'}</Kbd>
          <span style={{ color: '#e5e7eb', fontSize: '14px' }}>
            {toast === 'undo' ? 'to undo' : 'to redo'}
          </span>
        </div>
      )}
    </div>
  );
}

export default App;
