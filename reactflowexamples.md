Add Node On Edge Drop
You can create a new node when you drop the connection line on the pane by using the onConnectStart and onConnectEnd handlers.
----
Custom Nodes
A powerful feature of React Flow is the ability to create custom nodes. This gives you the flexibility to render anything you want within your nodes. We generally recommend creating your own custom nodes rather than relying on built-in ones. With custom nodes, you can add as many source and target handles as you like—or even embed form inputs, charts, and other interactive elements.

In this section, we’ll walk through creating a custom node featuring an input field that updates text elsewhere in your application. For further examples, we recommend checking out our Custom Node Example.

Implementing a custom node
To create a custom node, all you need to do is create a React component. React Flow will automatically wrap it in an interactive container that injects essential props like the node’s id, position, and data, and provides functionality for selection, dragging, and connecting handles. For a full overview on all available node props, see the Node reference.

Create the component
Let’s dive into an example by creating a custom node called TextUpdaterNode. For this, we’ve added a simple input field with a change handler.


export function TextUpdaterNode(props) {
  const onChange = useCallback((evt) => {
    console.log(evt.target.value);
  }, []);
 
  return (
    <div className="text-updater-node">
      <div>
        <label htmlFor="text">Text:</label>
        <input id="text" name="text" onChange={onChange} className="nodrag" />
      </div>
    </div>
  );
}



----

Delete Middle Node
This example shows you how to recover deleted edges when you remove a node from the middle of a chain. In other words, if we have three nodes connected in sequence - a->b->c - and we deleted the middle node b, this example shows you how to end up with the graph a->c.

To achieve this, we need to make use of a few bits:

The onNodesDelete callback lets us know when a node is deleted.
getConnectedEdges gives us all the edges connected to a node, either as source or target.
getIncomers and getOutgoers give us the nodes connected to a node as source or target.
All together, this allows us to take all the nodes connected to the deleted node, and reconnect them to any nodes the deleted node was connected to.


App.jsx
xy-theme.css
index.css




import React, { useCallback } from 'react';
import {
  ReactFlow,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  getIncomers,
  getOutgoers,
  getConnectedEdges,
} from '@xyflow/react';
 
import '@xyflow/react/dist/style.css';
 
const initialNodes = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Start here...' },
    position: { x: -150, y: 0 },
  },
  {
    id: '2',
    type: 'input',
    data: { label: '...or here!' },
    position: { x: 150, y: 0 },
  },
  { id: '3', data: { label: 'Delete me.' }, position: { x: 0, y: 100 } },
  { id: '4', data: { label: 'Then me!' }, position: { x: 0, y: 200 } },
  {
    id: '5',
    type: 'output',
    data: { label: 'End here!' },
    position: { x: 0, y: 300 },
  },
];
 
const initialEdges = [
  { id: '1->3', source: '1', target: '3' },
  { id: '2->3', source: '2', target: '3' },
  { id: '3->4', source: '3', target: '4' },
  { id: '4->5', source: '4', target: '5' },
];
 
export default function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
 
  const onConnect = useCallback((params) => setEdges(addEdge(params, edges)), [edges]);
 
  const onNodesDelete = useCallback(
    (deleted) => {
      let remainingNodes = [...nodes];
      setEdges(
        deleted.reduce((acc, node) => {
          const incomers = getIncomers(node, remainingNodes, acc);
          const outgoers = getOutgoers(node, remainingNodes, acc);
          const connectedEdges = getConnectedEdges([node], acc);
 
          const remainingEdges = acc.filter((edge) => !connectedEdges.includes(edge));
 
          const createdEdges = incomers.flatMap(({ id: source }) =>
            outgoers.map(({ id: target }) => ({
              id: `${source}->${target}`,
              source,
              target,
            })),
          );
 
          remainingNodes = remainingNodes.filter((rn) => rn.id !== node.id);
 
          return [...remainingEdges, ...createdEdges];
        }, edges),
      );
    },
    [nodes, edges],
  );
 
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onNodesDelete={onNodesDelete}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      fitView
      attributionPosition="top-right"
    >
      <Background />
    </ReactFlow>
  );
}
Although this example is less than 20 lines of code there’s quite a lot to digest. Let’s break some of it down:

Our onNodesDelete callback is called with one argument - deleted - that is an array of every node that was just deleted. If you select an individual node and press the delete key, deleted will contain just that node, but if you make a selection all the nodes in that selection will be in deleted.

We create a new array of edges - remainingEdges - that contains all the edges in the flow that have nothing to do with the node(s) we just deleted.

We create another array of edges by flatMapping over the array of incomers. These are nodes that were connected to the deleted node as a source. For each of these nodes, we create a new edge that connects to each node in the array of outgoers. These are nodes that were connected to the deleted node as a target.

---

To merge/move logic from one place to another? in this case merge files...

Examples
Nodes
Intersections
Copy page

Intersections
The useReactFlow hook exports helpers to check intersections of nodes and areas. In this example you can drag a node and get a visual feedback when it intersects with another node.


App.tsx
xy-theme.css
index.css
index.tsx




import React, { useCallback, type MouseEvent } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  ReactFlowProvider,
  useReactFlow,
  useNodesState,
  type Edge,
  type Node,
} from '@xyflow/react';
 
import '@xyflow/react/dist/style.css';
 
const initialNodes: Node[] = [
  {
    id: '1',
    data: { label: 'Node 1' },
    position: { x: 0, y: 0 },
    style: {
      width: 200,
      height: 100,
    },
  },
  {
    id: '2',
    data: { label: 'Node 2' },
    position: { x: 0, y: 150 },
  },
  {
    id: '3',
    data: { label: 'Node 3' },
    position: { x: 250, y: 0 },
  },
  {
    id: '4',
    data: { label: 'Node' },
    position: { x: 350, y: 150 },
    style: {
      width: 50,
      height: 50,
    },
  },
];
 
const initialEdges: Edge[] = [];
 
const BasicFlow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const { getIntersectingNodes } = useReactFlow();
 
  const onNodeDrag = useCallback((_: MouseEvent, node: Node) => {
    const intersections = getIntersectingNodes(node).map((n) => n.id);
 
    setNodes((ns) =>
      ns.map((n) => ({
        ...n,
        className: intersections.includes(n.id) ? 'highlight' : '',
      })),
    );
  }, []);
 
  return (
    <ReactFlow
      nodes={nodes}
      edges={initialEdges}
      onNodesChange={onNodesChange}
      onNodeDrag={onNodeDrag}
      className="intersection-flow"
      minZoom={0.2}
      maxZoom={4}
      fitView
      selectNodesOnDrag={false}
    >
      <Background />
      <Controls />
    </ReactFlow>
  );
};
 
export default function App() {
  return (
    <ReactFlowProvider>
      <BasicFlow />
    </ReactFlowProvider>
  );
}

----


Node Toolbar to edit definitions
For many types of applications, having a toolbar or set of controls appear when a node is selected can be quite useful. It’s so useful, in fact, that we’ve built the <NodeToolbar /> component to make it easy to add this functionality to your custom nodes!

Content in the toolbar is not scaled as you zoom your flow in and out: this means it should always be visible.


App.jsx
xy-theme.css
index.css




import { useCallback } from 'react';
import {
  Background,
  ReactFlow,
  ReactFlowProvider,
  Panel,
  NodeToolbar,
  Position,
  useNodesState,
} from '@xyflow/react';
 
import '@xyflow/react/dist/style.css';
 
const initialNodes = [
  {
    id: '1',
    position: { x: 0, y: 0 },
    type: 'node-with-toolbar',
    data: { label: 'Select me to show the toolbar' },
  },
];
 
const nodeTypes = {
  'node-with-toolbar': NodeWithToolbar,
};
 
function NodeWithToolbar({ data }) {
  return (
    <>
      <NodeToolbar
        isVisible={data.forceToolbarVisible || undefined}
        position={data.toolbarPosition}
        align={data.align}
      >
        <button className="xy-theme__button">cut</button>
        <button className="xy-theme__button">copy</button>
        <button className="xy-theme__button">paste</button>
      </NodeToolbar>
      <div>{data?.label}</div>
    </>
  );
}
 
function Flow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const setPosition = useCallback(
    (pos) =>
      setNodes((nodes) =>
        nodes.map((node) => ({
          ...node,
          data: { ...node.data, toolbarPosition: pos },
        })),
      ),
    [setNodes],
  );
  const setAlignment = useCallback(
    (align) =>
      setNodes((nodes) =>
        nodes.map((node) => ({
          ...node,
          data: { ...node.data, align },
        })),
      ),
    [setNodes],
  );
  const forceToolbarVisible = useCallback((enabled) =>
    setNodes((nodes) =>
      nodes.map((node) => ({
        ...node,
        data: { ...node.data, forceToolbarVisible: enabled },
      })),
    ),
  );
 
  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        onNodesChange={onNodesChange}
        nodeTypes={nodeTypes}
        fitView
        preventScrolling={false}
      >
        <Panel>
          <h3>Node Toolbar position:</h3>
          <button className="xy-theme__button" onClick={() => setPosition(Position.Top)}>
            top
          </button>
          <button
            className="xy-theme__button"
            onClick={() => setPosition(Position.Right)}
          >
            right
          </button>
          <button
            className="xy-theme__button"
            onClick={() => setPosition(Position.Bottom)}
          >
            bottom
          </button>
          <button className="xy-theme__button" onClick={() => setPosition(Position.Left)}>
            left
          </button>
          <h3>Node Toolbar Alignment:</h3>
          <button className="xy-theme__button" onClick={() => setAlignment('start')}>
            start
          </button>
          <button className="xy-theme__button" onClick={() => setAlignment('center')}>
            center
          </button>
          <button className="xy-theme__button" onClick={() => setAlignment('end')}>
            end
          </button>
          <h3>Override Node Toolbar visibility</h3>
          <label>
            <input
              type="checkbox"
              onChange={(e) => forceToolbarVisible(e.target.checked)}
              className="xy-theme__checkbox"
            />
            <span>Always show toolbar</span>
          </label>
        </Panel>
        <Background />
      </ReactFlow>
    </ReactFlowProvider>
  );
}
 
export default Flow;
For more information on the <NodeToolbar /> component and its props, check out the API reference.

Last updated on September 9, 2025



---


maybe this but to exemplify how functions are progressing? like ins and outs? 

Animating Edges
React Flow provides a simple built-in animation for the default edge type, but it is possible to create more advanced animations by using custom edges. Below are a collection of examples showing different ways an edge path might be used in

Animating SVG elements
It is possible to animate an SVG element along a path using the <animateMotion /> element. This example creates a custom edge that animates a circle along the edge path.


AnimatedSVGEdge.tsx
App.tsx
xy-theme.css
index.css
index.tsx




import React from 'react';
import { BaseEdge, getSmoothStepPath, type EdgeProps } from '@xyflow/react';
 
export function AnimatedSVGEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) {
  const [edgePath] = getSmoothStepPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });
 
  return (
    <>
      <BaseEdge id={id} path={edgePath} />
      <circle r="10" fill="#ff0073">
        <animateMotion dur="2s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
}

----

Edge labels names:

import React, { useCallback } from 'react';
import {
  ReactFlow,
  Controls,
  Background,
  addEdge,
  useEdgesState,
  useNodesState,
  type EdgeTypes,
  type Edge,
  type OnConnect,
  type Node,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';

import CustomEdge from './CustomEdge';
import CustomEdgeStartEnd from './CustomEdgeStartEnd';

const initialNodes: Node[] = [
  {
    id: '1',
    type: 'input',
    data: { label: 'Node 1' },
    position: { x: 0, y: 0 },
  },
  { id: '2', data: { label: 'Node 2' }, position: { x: 0, y: 300 } },
  { id: '3', data: { label: 'Node 3' }, position: { x: 200, y: 0 } },
  { id: '4', data: { label: 'Node 4' }, position: { x: 200, y: 300 } },
];

const initialEdges: Edge[] = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    data: {
      label: 'edge label',
    },
    type: 'custom',
  },
  {
    id: 'e3-4',
    source: '3',
    target: '4',
    data: {
      startLabel: 'start edge label',
      endLabel: 'end edge label',
    },
    type: 'start-end',
  },
];

const edgeTypes: EdgeTypes = {
  custom: CustomEdge,
  'start-end': CustomEdgeStartEnd,
};

const EdgesFlow = () => {
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const onConnect: OnConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [setEdges],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      edgeTypes={edgeTypes}
      fitView
    >
      <Controls />
      <Background />
    </ReactFlow>
  );
};

export default EdgesFlow;
---

general:

For a new connection created by dragging from a handle, the following events are called in order:

onConnectStart is called with the mouse event and an object containing the source node, potentially the source handle id, and the handle type.

onConnect is only called when the connection is released on a handle that is connectable. It is called with a complete connection object containing the source and target node, and the source and target handle ids if present.

onConnectEnd is called when a connection is released, regardless of whether it was successful or not. It is called with the mouse event.

When an edge is reconnected by dragging an existing edge, the following events are called in order:

onReconnectStart is called when a reconnectable edge is picked up. It is called with the mouse event, the edge object that is being reconnected, and the type of the stable handle.

onConnectStart is called as above.

onReconnect is called when the edge is released on a handle that is reconnectable. It is called with the old edge object and the new connection object.

onConnectEnd is called as above.

onReconnectEnd is called when the edge is released, regardless of whether the reconnection was successful or not. It is called with the mouse event, the edge that was picked up, and the type of the stable handle.


----


truly important, to create different levels of abstraction of the codebase:

Contextual Zoom
This example shows how the current zoom level can be used by a node to decide which content to show. We are using selecting the zoom via the useStore hook to update our custom node whenever the zoom changes.


App.jsx
ZoomNode.jsx
xy-theme.css
index.css




import React, { useCallback } from 'react';
import {
  Background,
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  MiniMap,
  Controls,
} from '@xyflow/react';
 
import '@xyflow/react/dist/style.css';
 
import ZoomNode from './ZoomNode';
 
const snapGrid = [20, 20];
const nodeTypes = {
  zoom: ZoomNode,
};
 
const initialNodes = [
  {
    id: '1',
    type: 'zoom',
    data: {
      content: <>Zoom to toggle content and placeholder</>,
    },
    position: { x: 0, y: 0 },
  },
  {
    id: '2',
    type: 'zoom',
    data: { content: <>this is a node with some lines of text in it.</> },
    position: { x: 200, y: 0 },
  },
  {
    id: '3',
    type: 'zoom',
    data: { content: <>this is another node with some more text.</> },
    position: { x: 400, y: 0 },
  },
];
 
const initialEdges = [
  {
    id: 'e1-2',
    source: '1',
    target: '2',
    animated: true,
  },
  {
    id: 'e2-3',
    source: '2',
    target: '3',
    animated: true,
  },
];
 
const defaultViewport = { x: 0, y: 0, zoom: 1.5 };
 
const ContextualZoomFlow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge({ ...params, animated: true }, eds)),
    [],
  );
 
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      snapToGrid={true}
      snapGrid={snapGrid}
      defaultViewport={defaultViewport}
      attributionPosition="top-right"
      fitView
    >
      <Background />
      <MiniMap />
      <Controls />
    </ReactFlow>
  );
};
 
export default ContextualZoomFlow;


----


Selection Grouping
This example demonstrates how to create dynamic node grouping in React Flow. You can select multiple nodes by holding Shift and clicking, then use the “Group Nodes” button in the appearing toolbar to group them together. When a group node is selected, an “Ungroup” button appears that detaches all child nodes. Group nodes are fully resizable and automatically adjust their dimensions based on their child nodes.

This is a Pro example. Get all pro examples, templates, 1:1 support from the xyflow team and prioritized Github issues with a React Flow Pro subscription.

See Pricing Plans
Sign In

About this Pro Example
Dependencies: @xyflow/react 
License: xyflow Pro License 



.---

FOR UI VALIDATIONS --- IMPORTANT!!

Download Image
This example shows how to download a flow as an image with html-to-image .

The version of the html-to-image  package used in this example, has been locked to 1.11.11, which is the latest working version for the package. The recent versions, after 1.11.11, are not exporting images properly and there is open issue  for this on Github.


App.jsx
CustomNode.jsx
DownloadButton.jsx
xy-theme.css
index.css
initialElements.js




import React, { useCallback } from 'react';
import {
  ReactFlow,
  useNodesState,
  useEdgesState,
  addEdge,
  Controls,
  Background,
} from '@xyflow/react';
 
import '@xyflow/react/dist/style.css';
 
import DownloadButton from './DownloadButton';
import CustomNode from './CustomNode';
import { initialNodes, initialEdges } from './initialElements';
 
const connectionLineStyle = { stroke: '#ffff' };
const snapGrid = [25, 25];
const nodeTypes = {
  custom: CustomNode,
};
 
const defaultEdgeOptions = {
  animated: true,
  type: 'smoothstep',
};
 
const defaultViewport = { x: 0, y: 0, zoom: 1.5 };
 
const DownloadImageFlow = () => {
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
 
  const onConnect = useCallback(
    (params) => setEdges((eds) => addEdge(params, eds)),
    [],
  );
 
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      nodeTypes={nodeTypes}
      connectionLineStyle={connectionLineStyle}
      connectionLineType="smoothstep"
      snapToGrid={true}
      snapGrid={snapGrid}
      defaultViewport={defaultViewport}
      fitView
      attributionPosition="bottom-left"
      defaultEdgeOptions={defaultEdgeOptions}
      className="download-image"
    >
      <Controls />
      <Background />
      <DownloadButton />
    </ReactFlow>
  );
};
 
export default DownloadImageFlow;

----


for annotations: 

import { memo } from 'react';

function AnnotationNode({ data }) {
  return (
    <>
      <div className='annotation-content'>
        <div className='annotation-level'>{data.level}.</div>
        <div>{data.label}</div>
      </div>
      {data.arrowStyle && (
        <div className="annotation-arrow" style={data.arrowStyle}>
          ⤹
        </div>
      )}
    </>
  );
}

export default memo(AnnotationNode);


----


