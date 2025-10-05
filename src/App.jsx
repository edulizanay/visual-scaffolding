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
import { loadFlow, saveFlow } from './api';
import ChatInterface from './ChatInterface';

function App() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isLoading, setIsLoading] = useState(true);

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
