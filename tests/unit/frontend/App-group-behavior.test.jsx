import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import App from '../../../src/App.jsx';
import { ReactFlow } from '@xyflow/react';
import * as api from '../../../src/services/api';
import ChatInterface from '../../../src/features/chat/components/ChatInterface';

vi.mock('@xyflow/react', () => {
  const React = require('react');
  const ReactFlowComponent = (props) => {
    ReactFlowComponent.mockProps = props;
    return React.createElement('div', { 'data-testid': 'react-flow' }, props.children);
  };
  ReactFlowComponent.mockProps = null;

  const Handle = (props) => React.createElement('div', props);

  const useNodesState = (initial) => {
    const React = require('react');
    const [nodes, setNodes] = React.useState(initial);
    const onNodesChange = vi.fn();
    return [nodes, setNodes, onNodesChange];
  };

  const useEdgesState = (initial) => {
    const React = require('react');
    const [edges, setEdges] = React.useState(initial);
    const onEdgesChange = vi.fn();
    return [edges, setEdges, onEdgesChange];
  };

  return {
    __esModule: true,
    ReactFlow: ReactFlowComponent,
    Handle,
    useNodesState,
    useEdgesState,
    useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    Position: { Right: 'right', Left: 'left' },
  };
});

vi.mock('../../../src/features/chat/components/ChatInterface', () => {
  const React = require('react');
  const MockChatInterface = ({ onFlowUpdate, onProcessingChange }) => {
    MockChatInterface.handlers = { onFlowUpdate, onProcessingChange };
    return React.createElement('div', { 'data-testid': 'chat-interface' });
  };
  MockChatInterface.handlers = {};

  const Kbd = ({ children, ...props }) => React.createElement('span', props, children);

  return {
    __esModule: true,
    default: MockChatInterface,
    Kbd,
  };
});

vi.mock('../../../src/features/chat/components/KeyboardShortcutsPanel', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: ({ tooltipConfig }) =>
      React.createElement('div', { 'data-testid': 'hotkeys-panel' },
        tooltipConfig && React.createElement('div', { key: 'tooltip' }, [
          React.createElement('span', { key: 'keys' }, tooltipConfig.keys),
          React.createElement('span', { key: 'label' }, tooltipConfig.label),
        ])
      ),
  };
});

vi.mock('../../../src/features/flow-canvas/components/Node', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'node' }),
  };
});

vi.mock('../../../src/features/flow-canvas/components/Edge', () => {
  const React = require('react');
  return {
    __esModule: true,
    default: () => React.createElement('div', { 'data-testid': 'edge' }),
  };
});

vi.mock('../../../src/features/flow-canvas/hooks/useFlowLayout', () => ({
  useFlowLayout: vi.fn(() => ({
    applyLayoutWithAnimation: vi.fn(),
    isAnimating: false,
    fitViewPadding: 0,
    getAllDescendants: vi.fn(() => []),
  })),
  getAllDescendants: vi.fn(() => []),
}));

vi.mock('../../../src/hooks/useHotkeys', () => ({
  useHotkeys: vi.fn(),
}));

vi.mock('../../../src/services/api', () => ({
  loadFlow: vi.fn(),
  saveFlow: vi.fn(),
  undoFlow: vi.fn(),
  redoFlow: vi.fn(),
  getHistoryStatus: vi.fn(),
  createNode: vi.fn(),
  updateNode: vi.fn(),
  createEdge: vi.fn(),
  updateEdge: vi.fn(),
  createGroup: vi.fn(),
  ungroup: vi.fn(),
  toggleGroupExpansion: vi.fn(),
}));

const getChatHandlers = () => {
  return ChatInterface.handlers || {};
};

const defaultFlow = {
  nodes: [
    { id: 'group-1', type: 'group', isCollapsed: true, position: { x: 0, y: 0 }, data: { label: 'Group 1' } },
    { id: 'node-1', type: 'default', position: { x: 100, y: 0 }, data: { label: 'Node 1' } },
    { id: 'node-2', type: 'default', position: { x: 200, y: 0 }, data: { label: 'Node 2' } },
  ],
  edges: [],
};

const originalAlert = global.alert;

describe('App group behaviour', () => {
  beforeAll(() => {
    global.alert = vi.fn();
  });

  afterAll(() => {
    global.alert = originalAlert;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    ReactFlow.mockProps = null;

    api.loadFlow.mockResolvedValue(defaultFlow);
    api.saveFlow.mockResolvedValue({ success: true });
    api.getHistoryStatus.mockResolvedValue({ canUndo: false });
    api.toggleGroupExpansion.mockResolvedValue({ success: true, flow: defaultFlow });
  });

  afterEach(async () => {
    if (vi.isFakeTimers()) {
      await act(async () => {
        vi.runOnlyPendingTimers();
      });
      vi.useRealTimers();
    }
  });

  const renderApp = async () => {
    await act(async () => {
      render(<App />);
    });

    await waitFor(() => expect(api.loadFlow).toHaveBeenCalled());
    await waitFor(() => expect(ReactFlow.mockProps).not.toBeNull());
  };

  test('double-click on collapsed group triggers expand API call', async () => {
    api.loadFlow.mockResolvedValueOnce(defaultFlow);

    await renderApp();

    const { onNodeDoubleClick, nodes } = ReactFlow.mockProps;

    await act(async () => {
      onNodeDoubleClick({ metaKey: false, ctrlKey: false }, nodes[0]);
    });

    expect(api.toggleGroupExpansion).toHaveBeenCalledWith('group-1', true);
  });

  test('double-click on expanded group triggers collapse API call', async () => {
    const expandedFlow = {
      ...defaultFlow,
      nodes: defaultFlow.nodes.map((node) =>
        node.id === 'group-1' ? { ...node, isCollapsed: false } : node
      ),
    };
    api.loadFlow.mockResolvedValueOnce(expandedFlow);

    await renderApp();

    const { onNodeDoubleClick, nodes } = ReactFlow.mockProps;

    await act(async () => {
      onNodeDoubleClick({ metaKey: false, ctrlKey: false }, nodes[0]);
    });

    expect(api.toggleGroupExpansion).toHaveBeenCalledWith('group-1', false);
  });

  test('tooltip shows group shortcut when multiple nodes selected', async () => {
    api.loadFlow.mockResolvedValueOnce(defaultFlow);

    await renderApp();

    const { onNodeClick, nodes } = ReactFlow.mockProps;

    const metaEvent = { metaKey: true, ctrlKey: false };

    await act(async () => {
      onNodeClick(metaEvent, nodes[1]);
      onNodeClick(metaEvent, nodes[2]);
    });

    expect(screen.getByText('⌘ G')).toBeInTheDocument();
    expect(screen.getByText('to group')).toBeInTheDocument();
  });

  test('tooltip shows ungroup shortcut when single group selected', async () => {
    const flowWithGroup = {
      ...defaultFlow,
      nodes: [
        { id: 'group-1', type: 'group', isCollapsed: false, position: { x: 0, y: 0 }, data: { label: 'Group 1' } },
      ],
    };
    api.loadFlow.mockResolvedValueOnce(flowWithGroup);

    await renderApp();

    const { onNodeClick, nodes } = ReactFlow.mockProps;

    const metaEvent = { metaKey: true, ctrlKey: false };

    await act(async () => {
      onNodeClick(metaEvent, nodes[0]);
    });

    expect(screen.getByText('⌘ ⇧ G')).toBeInTheDocument();
    expect(screen.getByText('to ungroup')).toBeInTheDocument();
  });

});
