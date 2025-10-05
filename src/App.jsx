// ABOUTME: Main application component with React Flow canvas
// ABOUTME: Loads flow from backend and auto-saves changes
import { useCallback, useMemo, useEffect, useState } from 'react';
import {
  ReactFlow,
  MiniMap,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Position,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import Node from './Node';
import Edge from './Edge';
import { loadFlow, saveFlow, undoFlow, redoFlow, getHistoryStatus } from './api';
import ChatInterface from './ChatInterface';

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  useEffect(() => {
    const fetchFlow = async () => {
      try {
        const flow = await loadFlow();

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
    if (isLoading) return;

    const timeoutId = setTimeout(async () => {
      try {
        await saveFlow(nodes, edges);
      } catch (error) {
        console.error('Failed to save flow:', error);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [nodes, edges, isLoading]);

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

  const nodesWithHandlers = useMemo(() =>
    nodes.map((node) => ({
      ...node,
      data: {
        ...node.data,
        onLabelChange: updateNodeLabel,
        onDescriptionChange: updateNodeDescription,
      },
    })),
    [nodes, updateNodeLabel, updateNodeDescription]
  );

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

  const onNodeDoubleClick = useCallback(
    (event, node) => {
      if (event.metaKey || event.ctrlKey) {
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

        setNodes((nds) => [...nds, newNode]);
        setEdges((eds) => [...eds, newEdge]);
      }
    },
    [setNodes, setEdges, updateNodeLabel, updateNodeDescription, updateEdgeLabel],
  );

  const handleFlowUpdate = useCallback((updatedFlow) => {
    if (!updatedFlow) return;

    const nodesWithPosition = updatedFlow.nodes.map(node => ({
      ...node,
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }));

    setNodes(nodesWithPosition);
    setEdges(updatedFlow.edges);
  }, [setNodes, setEdges]);

  const updateHistoryStatus = useCallback(async () => {
    try {
      const status = await getHistoryStatus();
      setCanUndo(status.canUndo);
      setCanRedo(status.canRedo);
    } catch (error) {
      console.error('Failed to get history status:', error);
    }
  }, []);

  useEffect(() => {
    updateHistoryStatus();
    const interval = setInterval(updateHistoryStatus, 1000);
    return () => clearInterval(interval);
  }, [updateHistoryStatus]);

  const handleUndo = useCallback(async () => {
    try {
      const result = await undoFlow();
      if (result.success && result.flow) {
        handleFlowUpdate(result.flow);
        await updateHistoryStatus();
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
      }
    } catch (error) {
      console.error('Failed to redo:', error);
    }
  }, [handleFlowUpdate, updateHistoryStatus]);

  if (isLoading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100vw', height: '100vh', color: 'white' }}>Loading...</div>;
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <div style={{
        position: 'absolute',
        top: 20,
        right: 20,
        zIndex: 1000,
        display: 'flex',
        gap: 10
      }}>
        <button
          onClick={handleUndo}
          disabled={!canUndo}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            cursor: canUndo ? 'pointer' : 'not-allowed',
            opacity: canUndo ? 1 : 0.5,
            backgroundColor: '#333',
            color: 'white',
            border: '1px solid #555',
            borderRadius: '4px'
          }}
        >
          ← Undo
        </button>
        <button
          onClick={handleRedo}
          disabled={!canRedo}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            cursor: canRedo ? 'pointer' : 'not-allowed',
            opacity: canRedo ? 1 : 0.5,
            backgroundColor: '#333',
            color: 'white',
            border: '1px solid #555',
            borderRadius: '4px'
          }}
        >
          Redo →
        </button>
      </div>
      <ReactFlow
        nodes={nodesWithHandlers}
        edges={edgesWithHandlers}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDoubleClick={onNodeDoubleClick}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        colorMode="dark"
        defaultViewport={{ x: 300, y: 200, zoom: 1 }}
        fitView
      >
        <MiniMap />
        <Background variant="dots" gap={12} size={1} />
      </ReactFlow>
      <ChatInterface onFlowUpdate={handleFlowUpdate} />
    </div>
  );
}

export default App;
