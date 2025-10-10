// ABOUTME: Tool definitions for flow manipulation operations
// ABOUTME: Used by both UI and AI to modify nodes and edges

/**
 * Tool schemas in OpenAI function calling format
 * These define what operations can be performed on the flow
 */
export const toolDefinitions = [
  {
    name: 'addNode',
    description: 'Creates a new node. If parentNodeId is provided, automatically creates an edge from parent to the new node. If the user asks for a label on the edge you can include it in the same call. NOTE: When creating multiple related nodes in a batch, you can reference them by their label (e.g., parentNodeId: "Lion") and the system will automatically match them.',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: 'Optional: Specify a custom ID for this node. If omitted, an ID will be auto-generated from the label (e.g., "My Node" becomes "my_node"). This allows you to reference nodes by their label when creating chains.',
        },
        label: {
          type: 'string',
          description: 'The label/name of the node',
        },
        description: {
          type: ['string', 'null'],
          description: 'Optional description for the node',
        },
        parentNodeId: {
          type: ['string', 'null'],
          description: 'Optional ID or label of parent node. You can use either the exact label (e.g., "Lion") or a previously generated ID. The system will automatically match them. If provided, creates edge from parent to new node.',
        },
        edgeLabel: {
          type: ['string', 'null'],
          description: 'Optional label for the auto-created edge. ONLY use if: (1) user explicitly requests an edge label, OR (2) there is a meaningful relationship to describe. Leave empty for unlabeled edges.',
        },
      },
      required: ['label'],
    },
    returns: {
      type: 'string',
      description: 'The ID of the newly created node',
    },
  },
  {
    name: 'updateNode',
    description: 'Updates properties of an existing node. At least one property (label, description, or position) must be provided.',
    parameters: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description: 'The ID of the node to update',
        },
        label: {
          type: 'string',
          description: 'New label for the node',
        },
        description: {
          type: 'string',
          description: 'New description for the node',
        },
        position: {
          type: 'object',
          description: 'New position for the node',
          properties: {
            x: {
              type: 'number',
              description: 'X coordinate',
            },
            y: {
              type: 'number',
              description: 'Y coordinate',
            },
          },
        },
      },
      required: ['nodeId'],
    },
  },
  {
    name: 'deleteNode',
    description: 'Deletes a node. All edges connected to this node (incoming and outgoing) are removed. Child nodes become orphaned.',
    parameters: {
      type: 'object',
      properties: {
        nodeId: {
          type: 'string',
          description: 'The ID of the node to delete',
        },
      },
      required: ['nodeId'],
    },
  },
  {
    name: 'addEdge',
    description: 'Creates an edge connecting two nodes. Used for manual connections or fixing orphaned nodes.',
    parameters: {
      type: 'object',
      properties: {
        sourceNodeId: {
          type: 'string',
          description: 'The ID of the source (parent) node',
        },
        targetNodeId: {
          type: 'string',
          description: 'The ID of the target (child) node',
        },
        label: {
          type: 'string',
          description: 'Optional label for the edge',
        },
      },
      required: ['sourceNodeId', 'targetNodeId'],
    },
    returns: {
      type: 'string',
      description: 'The ID of the newly created edge',
    },
  },
  {
    name: 'updateEdge',
    description: 'Updates the label of an existing edge.',
    parameters: {
      type: 'object',
      properties: {
        edgeId: {
          type: 'string',
          description: 'The ID of the edge to update',
        },
        label: {
          type: 'string',
          description: 'New label for the edge',
        },
      },
      required: ['edgeId', 'label'],
    },
  },
  {
    name: 'deleteEdge',
    description: 'Removes an edge from the flow. The nodes remain but the target node becomes orphaned.',
    parameters: {
      type: 'object',
      properties: {
        edgeId: {
          type: 'string',
          description: 'The ID of the edge to delete',
        },
      },
      required: ['edgeId'],
    },
  },
  {
    name: 'undo',
    description: 'Reverts the last change made to the flow. Can be called multiple times to undo multiple changes.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'redo',
    description: 'Reapplies the last undone change. Only works after undo has been called.',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'changeVisuals',
    description: 'Updates the visual styling of the canvas background or nodes.',
    parameters: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          enum: ['background', 'all_nodes', 'node'],
          description: 'Which element to update: the canvas background, all nodes, or a specific node.',
        },
        nodeId: {
          type: 'string',
          description: 'Required when target is "node". The node ID whose styling should change.',
        },
        color: {
          type: 'string',
          description: 'CSS color value to apply (hex, rgb/rgba, hsl/hsla, or named color).',
        },
        property: {
          type: 'string',
          enum: ['background', 'border', 'text'],
          description: 'Optional: which node color to update. Defaults to background.',
        },
      },
      required: ['target', 'color'],
    },
  },
  {
    name: 'changeDimensions',
    description: 'Adjusts node sizes, zoom level, or dagre layout spacing by +/-10% increments.',
    parameters: {
      type: 'object',
      properties: {
        target: {
          type: 'string',
          enum: ['node', 'all_nodes', 'zoom', 'layout_spacing'],
          description: 'What to resize: a specific node, all nodes, overall zoom, or layout spacing.',
        },
        nodeId: {
          type: 'string',
          description: 'Required when target is "node". The node ID whose dimensions should change.',
        },
        direction: {
          type: 'string',
          enum: ['increase', 'decrease'],
          description: 'Whether to grow (increase) or shrink (decrease) the target by 10%.',
        },
        axis: {
          type: 'string',
          enum: ['horizontal', 'vertical', 'both'],
          description: 'Which axis to affect. Defaults to both when omitted.',
        },
      },
      required: ['target', 'direction'],
    },
  },
];

/**
 * Formats the current flow state into context for LLM
 * Simplifies nodes and edges to essential information
 */
export function formatFlowContext(nodes, edges) {
  return {
    nodes: nodes.map(node => ({
      id: node.id,
      label: node.data.label,
      description: node.data.description || '',
      position: node.position,
    })),
    edges: edges.map(edge => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      label: edge.data?.label || '',
    })),
  };
}

/**
 * Formats a complete message to show what would be sent to LLM
 */
export function formatLLMRequest(userMessage, nodes, edges) {
  return {
    userMessage,
    flowContext: formatFlowContext(nodes, edges),
    availableTools: toolDefinitions,
  };
}

/**
 * Formats a simulated tool call response
 */
export function formatToolCall(toolName, params) {
  return {
    tool: toolName,
    parameters: params,
  };
}

/**
 * Pretty prints LLM request to console
 */
export function logLLMRequest(userMessage, nodes, edges) {
  console.group('=== AI TOOL CALL SIMULATION ===');
  console.log('User Message:', userMessage);
  console.log('\nFlow Context Sent to LLM:');
  console.log(formatFlowContext(nodes, edges));
  console.log('\nAvailable Tools:');
  console.table(toolDefinitions.map(t => ({
    name: t.name,
    description: t.description,
  })));
  console.groupEnd();
}
