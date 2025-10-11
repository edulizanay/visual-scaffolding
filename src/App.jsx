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
import { loadFlow, saveFlow, undoFlow, redoFlow, getHistoryStatus } from './api';
import ChatInterface, { Kbd } from './ChatInterface';
import { useFlowLayout } from './hooks/useFlowLayout';
import { DEFAULT_VISUAL_SETTINGS, mergeWithDefaultVisualSettings } from '../shared/visualSettings.js';

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
    validateGroupMembership,
    getAllDescendantsByGroup,
    getAffectedNodesForCollapse,
    getAffectedEdgesForCollapse,
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

  const updateNodeLabel = useCallback((nodeId, newLabel) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, label: newLabel } } : n
      )
    );
  }, [setNodes]);

  const updateNodeDescription = useCallback((nodeId, newDescription) => {
    setNodes((nds) =>
      nds.map((n) =>
        n.id === nodeId ? { ...n, data: { ...n.data, description: newDescription } } : n
      )
    );
  }, [setNodes]);

  const updateEdgeLabel = useCallback((edgeId, newLabel) => {
    setEdges((eds) =>
      eds.map((e) =>
        e.id === edgeId ? { ...e, data: { ...e.data, label: newLabel } } : e
      )
    );
  }, [setEdges]);

  const nodesWithHandlers = useMemo(() => {
    const defaultNode = visualSettings.dimensions?.node?.default ?? DEFAULT_VISUAL_SETTINGS.dimensions.node.default;
    const overrides = visualSettings.dimensions?.node?.overrides ?? {};
    const globalColors = visualSettings.colors?.allNodes ?? DEFAULT_VISUAL_SETTINGS.colors.allNodes;
    const perNodeColors = visualSettings.colors?.perNode ?? {};

    return nodes.map((node) => {
      const isGroupNode = node.type === 'group';
      const isCollapsed = isGroupNode && node.isExpanded === false;

      // HARDCODED: Group dimensions 50% larger than regular nodes
      const override = overrides[node.id] || {};
      const baseWidth = isGroupNode ? defaultNode.width * 1.5 : defaultNode.width;
      const baseHeight = isGroupNode ? defaultNode.height * 1.5 : defaultNode.height;
      const width = override.width ?? baseWidth;
      const height = override.height ?? baseHeight;
      const borderRadius = override.borderRadius ?? defaultNode.borderRadius;

      const nodeColorOverrides = perNodeColors[node.id] || {};
      // HARDCODED: Group node colors (distinct from regular nodes)
      const defaultBackground = isGroupNode ? '#3730a3' : globalColors.background; // Indigo for groups
      const defaultBorder = isGroupNode ? '#6366f1' : globalColors.border; // Lighter indigo border
      const background = nodeColorOverrides.background ?? defaultBackground;
      const border = nodeColorOverrides.border ?? defaultBorder;
      const text = nodeColorOverrides.text ?? globalColors.text;

      const isSelected = selectedNodeIds.includes(node.id);

      // Count members if collapsed
      let memberCount = 0;
      if (isCollapsed) {
        memberCount = getAffectedNodesForCollapse(node.id, nodes).length;
      }

      const baseStyle = {
        background,
        border: `1px solid ${border}`,
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
  }, [nodes, updateNodeLabel, updateNodeDescription, visualSettings, selectedNodeIds, getAffectedNodesForCollapse]);

  const edgesWithHandlers = useMemo(() =>
    edges.map((edge) => ({
      ...edge,
      type: 'smoothstep',
      data: {
        ...edge.data,
        onLabelChange: updateEdgeLabel,
      },
    })),
    [edges, updateEdgeLabel]
  );

  const nodeTypes = useMemo(() => ({ default: Node }), []);
  const edgeTypes = useMemo(() => ({ smoothstep: Edge }), []);

  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, type: 'smoothstep', data: { onLabelChange: updateEdgeLabel } }, eds)),
    [setEdges, updateEdgeLabel],
  );

  const onPaneClick = useCallback(() => {
    setSelectedNodeIds([]);
  }, [setSelectedNodeIds]);

  const onNodeDoubleClick = useCallback(
    (event, node) => {
      // Double-click on group node: toggle collapse/expand
      if (node.type === 'group') {
        const isCurrentlyExpanded = node.isExpanded !== false; // Default to true if undefined

        // Toggle isExpanded on group node
        const updatedNodes = nodes.map(n =>
          n.id === node.id
            ? { ...n, isExpanded: !isCurrentlyExpanded }
            : n
        );

        // Get all descendant nodes (including nested groups)
        const descendantIds = getAffectedNodesForCollapse(node.id, nodes);

        // Mark descendants as hidden (collapse) or visible (expand)
        const finalNodes = updatedNodes.map(n =>
          descendantIds.includes(n.id)
            ? { ...n, hidden: !isCurrentlyExpanded }
            : n
        );

        // Mark affected edges as hidden
        const affectedEdgeIds = getAffectedEdgesForCollapse(descendantIds, edges);
        const finalEdges = edges.map(e =>
          affectedEdgeIds.includes(e.id)
            ? { ...e, hidden: !isCurrentlyExpanded }
            : e
        );

        // Apply layout
        setTimeout(() => {
          applyLayoutWithAnimation(finalNodes, finalEdges);
        }, 0);
      }
      // Cmd+Double-click: Create child node (existing behavior)
      else if (event.metaKey || event.ctrlKey) {
        const newNodeId = `${Date.now()}`;
        const newNode = {
          id: newNodeId,
          position: { x: node.position.x + 200, y: node.position.y },
          data: {
            label: `Node ${newNodeId}`,
            description: '',
            onLabelChange: updateNodeLabel,
            onDescriptionChange: updateNodeDescription,
          },
          sourcePosition: Position.Right,
          targetPosition: Position.Left,
        };

        const newEdge = {
          id: `e${node.id}-${newNodeId}`,
          source: node.id,
          target: newNodeId,
          type: 'smoothstep',
          data: { onLabelChange: updateEdgeLabel },
        };

        const updatedNodes = [...nodes, newNode];
        const updatedEdges = [...edges, newEdge];

        setTimeout(() => {
          applyLayoutWithAnimation(updatedNodes, updatedEdges);
        }, 0);
      }
    },
    [nodes, edges, applyLayoutWithAnimation, updateNodeLabel, updateNodeDescription, updateEdgeLabel, getAffectedNodesForCollapse, getAffectedEdgesForCollapse],
  );

  const onNodeClick = useCallback(
    (event, node) => {
      // Alt+Click: Collapse/expand subtree (existing behavior)
      if (event.altKey) {
        const isCurrentlyCollapsed = node.data.collapsed || false;

        const updatedNodes = nodes.map(n =>
          n.id === node.id
            ? { ...n, data: { ...n.data, collapsed: !isCurrentlyCollapsed }}
            : n
        );

        const descendants = getAllDescendants(node.id, nodes, edges);
        const descendantIds = descendants.map(d => d.id);

        const finalNodes = updatedNodes.map(n =>
          descendantIds.includes(n.id)
            ? { ...n, hidden: !isCurrentlyCollapsed }
            : n
        );

        const finalEdges = edges.map(e =>
          (descendantIds.includes(e.source) || descendantIds.includes(e.target))
            ? { ...e, hidden: !isCurrentlyCollapsed }
            : e
        );

        setTimeout(() => {
          applyLayoutWithAnimation(finalNodes, finalEdges);
        }, 0);
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
    [nodes, edges, applyLayoutWithAnimation, setSelectedNodeIds]
  );

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

  const createGroup = useCallback(() => {
    if (selectedNodeIds.length < 2) {
      alert('Please select at least 2 nodes to create a group');
      return;
    }

    // Validate group membership
    const validation = validateGroupMembership(selectedNodeIds, nodes);
    if (!validation.valid) {
      alert(`Cannot create group: ${validation.error}`);
      return;
    }

    // Auto-generate group label
    const groupLabel = `Group ${Date.now()}`;

    // Generate group node ID
    const groupId = `group-${Date.now()}`;

    // Create group node at average position of selected nodes
    const selectedNodes = nodes.filter(n => selectedNodeIds.includes(n.id));
    const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length;
    const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length;

    const groupNode = {
      id: groupId,
      type: 'group',
      isExpanded: true,
      position: { x: avgX, y: avgY - 100 }, // Position above selected nodes
      data: {
        label: groupLabel,
        onLabelChange: updateNodeLabel,
        onDescriptionChange: updateNodeDescription,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    };

    // Update selected nodes with parentGroupId
    const updatedNodes = nodes.map(n =>
      selectedNodeIds.includes(n.id)
        ? { ...n, parentGroupId: groupId }
        : n
    );

    const finalNodes = [...updatedNodes, groupNode];

    // Create group edges to connect group node to external nodes
    const selectedSet = new Set(selectedNodeIds);
    const newGroupEdges = [];
    const groupEdgeMap = new Map(); // Deduplicate edges

    edges.forEach(edge => {
      const sourceInGroup = selectedSet.has(edge.source);
      const targetInGroup = selectedSet.has(edge.target);

      // Edge going OUT of group (member → external)
      if (sourceInGroup && !targetInGroup) {
        const edgeKey = `${groupId}-to-${edge.target}`;
        if (!groupEdgeMap.has(edgeKey)) {
          groupEdgeMap.set(edgeKey, {
            id: `group-edge-${edgeKey}`,
            source: groupId,
            target: edge.target,
            type: 'smoothstep',
            data: { onLabelChange: updateEdgeLabel },
          });
        }
      }
      // Edge coming INTO group (external → member)
      else if (!sourceInGroup && targetInGroup) {
        const edgeKey = `${edge.source}-to-${groupId}`;
        if (!groupEdgeMap.has(edgeKey)) {
          groupEdgeMap.set(edgeKey, {
            id: `group-edge-${edgeKey}`,
            source: edge.source,
            target: groupId,
            type: 'smoothstep',
            data: { onLabelChange: updateEdgeLabel },
          });
        }
      }
    });

    newGroupEdges.push(...groupEdgeMap.values());

    const finalEdges = [...edges, ...newGroupEdges];

    console.log('Creating group:', {
      groupId,
      groupLabel,
      selectedNodeIds,
      newGroupEdges: newGroupEdges.length,
      finalNodes: finalNodes.length,
      finalEdges: finalEdges.length
    });

    // Clear selection
    setSelectedNodeIds([]);

    // Set nodes first, then edges after a brief delay to ensure nodes are mounted
    setNodes(finalNodes);

    setTimeout(() => {
      setEdges(finalEdges);
      // Then apply layout animation
      setTimeout(() => {
        applyLayoutWithAnimation(finalNodes, finalEdges);
      }, 50);
    }, 50);
  }, [selectedNodeIds, nodes, edges, validateGroupMembership, updateNodeLabel, updateNodeDescription, updateEdgeLabel, applyLayoutWithAnimation, setSelectedNodeIds, setNodes, setEdges]);

  const ungroupNodes = useCallback(() => {
    if (selectedNodeIds.length !== 1) {
      alert('Please select exactly 1 group node to ungroup');
      return;
    }

    const groupId = selectedNodeIds[0];
    const groupNode = nodes.find(n => n.id === groupId);

    if (!groupNode || groupNode.type !== 'group') {
      alert('Selected node is not a group');
      return;
    }

    // Find all direct children of this group
    const memberIds = nodes
      .filter(n => n.parentGroupId === groupId)
      .map(n => n.id);

    if (memberIds.length === 0) {
      alert('Group has no members');
      return;
    }

    // Remove parentGroupId from all members (including nested groups)
    const updatedNodes = nodes
      .filter(n => n.id !== groupId) // Remove group node
      .map(n =>
        memberIds.includes(n.id)
          ? { ...n, parentGroupId: undefined, hidden: false } // Free members and unhide
          : n
      );

    // Unhide any edges connected to freed nodes
    const freedNodeIds = new Set(memberIds);
    const updatedEdges = edges.map(e =>
      (freedNodeIds.has(e.source) || freedNodeIds.has(e.target))
        ? { ...e, hidden: false }
        : e
    );

    // Clear selection
    setSelectedNodeIds([]);

    // Apply layout
    setTimeout(() => {
      applyLayoutWithAnimation(updatedNodes, updatedEdges);
    }, 0);
  }, [selectedNodeIds, nodes, edges, applyLayoutWithAnimation, setSelectedNodeIds]);

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
        createGroup();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleUndo, handleRedo, createGroup, ungroupNodes]);

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
    <div style={{ width: '100vw', height: '100vh' }}>
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
