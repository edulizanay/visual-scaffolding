// ABOUTME: Tests for frontend API client functions and error handling
// ABOUTME: Validates fetch calls, response parsing, and error scenarios

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  loadFlow,
  sendMessage,
  getConversationDebug,
  clearConversation,
  undoFlow,
  redoFlow,
  getHistoryStatus,
  createNode,
  updateNode,
  deleteNode,
  createEdge,
  updateEdge,
  deleteEdge,
  createGroup,
  ungroup,
  toggleGroupExpansion,
  loadNotes,
  sendNotesMessage,
  updateNotes,
} from '../../../src/services/api';

// Mock global fetch
global.fetch = vi.fn();

beforeEach(() => {
  // Reset fetch mock before each test
  global.fetch.mockReset();

  // Suppress console.error by default to keep test output clean
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  // Restore console.error
  console.error.mockRestore();
});

describe('loadFlow', () => {
  it('should fetch flow data successfully', async () => {
    const mockFlowData = {
      nodes: [{ id: '1', data: { label: 'Test' } }],
      edges: [{ id: 'e1', source: '1', target: '2' }],
      settings: { colors: {} },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockFlowData,
    });

    const result = await loadFlow();

    expect(global.fetch).toHaveBeenCalledWith('/api/flow');
    expect(result).toEqual(mockFlowData);
  });

  it('should throw error on failed fetch', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(loadFlow()).rejects.toThrow('Failed to load flow');
    expect(console.error).toHaveBeenCalledWith(
      'Error loading flow:',
      expect.any(Error)
    );
  });

  it('should handle network errors', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Network error'));

    await expect(loadFlow()).rejects.toThrow('Network error');
    expect(console.error).toHaveBeenCalledWith(
      'Error loading flow:',
      expect.any(Error)
    );
  });
});

describe('sendMessage', () => {
  it('should send message successfully', async () => {
    const message = 'Create a node';
    const mockResponse = {
      success: true,
      thinking: 'Creating node',
      toolCalls: [],
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await sendMessage(message);

    expect(global.fetch).toHaveBeenCalledWith('/api/conversation/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    expect(result).toEqual(mockResponse);
  });

  it('should throw error on failed message send', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
    });

    await expect(sendMessage('test')).rejects.toThrow('Failed to send message');
    expect(console.error).toHaveBeenCalledWith(
      'Error sending message:',
      expect.any(Error)
    );
  });

  it('should handle network errors during message send', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Connection refused'));

    await expect(sendMessage('test')).rejects.toThrow('Connection refused');
  });
});

describe('getConversationDebug', () => {
  it('should fetch conversation debug data successfully', async () => {
    const mockDebugData = {
      history: [{ role: 'user', content: 'test' }],
      messageCount: 1,
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockDebugData,
    });

    const result = await getConversationDebug();

    expect(global.fetch).toHaveBeenCalledWith('/api/conversation/debug');
    expect(result).toEqual(mockDebugData);
  });

  it('should throw error on failed fetch', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(getConversationDebug()).rejects.toThrow(
      'Failed to fetch conversation'
    );
    expect(console.error).toHaveBeenCalledWith(
      'Error fetching conversation:',
      expect.any(Error)
    );
  });
});

describe('clearConversation', () => {
  it('should clear conversation successfully', async () => {
    const mockResponse = { success: true };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await clearConversation();

    expect(global.fetch).toHaveBeenCalledWith('/api/conversation/history', {
      method: 'DELETE',
    });
    expect(result).toEqual(mockResponse);
  });

  it('should throw error on failed clear', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(clearConversation()).rejects.toThrow(
      'Failed to clear conversation'
    );
    expect(console.error).toHaveBeenCalledWith(
      'Error clearing conversation:',
      expect.any(Error)
    );
  });
});

describe('undoFlow', () => {
  it('should undo flow successfully', async () => {
    const mockResponse = {
      success: true,
      flow: { nodes: [], edges: [] },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await undoFlow();

    expect(global.fetch).toHaveBeenCalledWith('/api/flow/undo', {
      method: 'POST',
    });
    expect(result).toEqual(mockResponse);
  });

  it('should throw error on failed undo', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(undoFlow()).rejects.toThrow('Failed to undo');
    expect(console.error).toHaveBeenCalledWith(
      'Error undoing:',
      expect.any(Error)
    );
  });
});

describe('redoFlow', () => {
  it('should redo flow successfully', async () => {
    const mockResponse = {
      success: true,
      flow: { nodes: [], edges: [] },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await redoFlow();

    expect(global.fetch).toHaveBeenCalledWith('/api/flow/redo', {
      method: 'POST',
    });
    expect(result).toEqual(mockResponse);
  });

  it('should throw error on failed redo', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(redoFlow()).rejects.toThrow('Failed to redo');
    expect(console.error).toHaveBeenCalledWith(
      'Error redoing:',
      expect.any(Error)
    );
  });
});

describe('getHistoryStatus', () => {
  it('should fetch history status successfully', async () => {
    const mockStatus = {
      canUndo: true,
      canRedo: false,
      snapshotCount: 5,
      currentIndex: 4,
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockStatus,
    });

    const result = await getHistoryStatus();

    expect(global.fetch).toHaveBeenCalledWith('/api/flow/history-status');
    expect(result).toEqual(mockStatus);
  });

  it('should throw error on failed fetch', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
    });

    await expect(getHistoryStatus()).rejects.toThrow(
      'Failed to get history status'
    );
    expect(console.error).toHaveBeenCalledWith(
      'Error getting history status:',
      expect.any(Error)
    );
  });
});

describe('createNode', () => {
  it('should create node successfully', async () => {
    const params = {
      label: 'Test Node',
      position: { x: 100, y: 200 },
    };
    const mockResponse = {
      success: true,
      flow: { nodes: [], edges: [] },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await createNode(params);

    expect(global.fetch).toHaveBeenCalledWith('/api/node', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    expect(result).toEqual(mockResponse);
  });

  it('should throw error with server error message on failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid node parameters' }),
    });

    await expect(createNode({})).rejects.toThrow('Invalid node parameters');
    expect(console.error).toHaveBeenCalledWith(
      'Error creating node:',
      expect.any(Error)
    );
  });

  it('should throw default error message when server error missing', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    await expect(createNode({})).rejects.toThrow('Failed to create node');
  });
});

describe('updateNode', () => {
  it('should update node successfully', async () => {
    const nodeId = 'node-123';
    const params = { label: 'Updated Label' };
    const mockResponse = {
      success: true,
      flow: { nodes: [], edges: [] },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await updateNode(nodeId, params);

    expect(global.fetch).toHaveBeenCalledWith('/api/node/node-123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    expect(result).toEqual(mockResponse);
  });

  it('should throw error with server error message on failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Node not found' }),
    });

    await expect(updateNode('invalid', {})).rejects.toThrow('Node not found');
    expect(console.error).toHaveBeenCalledWith(
      'Error updating node:',
      expect.any(Error)
    );
  });
});

describe('deleteNode', () => {
  it('should delete node successfully', async () => {
    const nodeId = 'node-123';
    const mockResponse = {
      success: true,
      flow: { nodes: [], edges: [] },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await deleteNode(nodeId);

    expect(global.fetch).toHaveBeenCalledWith('/api/node/node-123', {
      method: 'DELETE',
    });
    expect(result).toEqual(mockResponse);
  });

  it('should throw error with server error message on failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Cannot delete node' }),
    });

    await expect(deleteNode('node-123')).rejects.toThrow('Cannot delete node');
    expect(console.error).toHaveBeenCalledWith(
      'Error deleting node:',
      expect.any(Error)
    );
  });
});

describe('createEdge', () => {
  it('should create edge successfully', async () => {
    const params = {
      source: 'node-1',
      target: 'node-2',
    };
    const mockResponse = {
      success: true,
      flow: { nodes: [], edges: [] },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await createEdge(params);

    expect(global.fetch).toHaveBeenCalledWith('/api/edge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    expect(result).toEqual(mockResponse);
  });

  it('should throw error with server error message on failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid edge parameters' }),
    });

    await expect(createEdge({})).rejects.toThrow('Invalid edge parameters');
    expect(console.error).toHaveBeenCalledWith(
      'Error creating edge:',
      expect.any(Error)
    );
  });
});

describe('updateEdge', () => {
  it('should update edge successfully', async () => {
    const edgeId = 'edge-123';
    const params = { label: 'Updated Edge' };
    const mockResponse = {
      success: true,
      flow: { nodes: [], edges: [] },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await updateEdge(edgeId, params);

    expect(global.fetch).toHaveBeenCalledWith('/api/edge/edge-123', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    expect(result).toEqual(mockResponse);
  });

  it('should throw error with server error message on failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Edge not found' }),
    });

    await expect(updateEdge('invalid', {})).rejects.toThrow('Edge not found');
    expect(console.error).toHaveBeenCalledWith(
      'Error updating edge:',
      expect.any(Error)
    );
  });
});

describe('deleteEdge', () => {
  it('should delete edge successfully', async () => {
    const edgeId = 'edge-123';
    const mockResponse = {
      success: true,
      flow: { nodes: [], edges: [] },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await deleteEdge(edgeId);

    expect(global.fetch).toHaveBeenCalledWith('/api/edge/edge-123', {
      method: 'DELETE',
    });
    expect(result).toEqual(mockResponse);
  });

  it('should throw error with server error message on failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Cannot delete edge' }),
    });

    await expect(deleteEdge('edge-123')).rejects.toThrow('Cannot delete edge');
    expect(console.error).toHaveBeenCalledWith(
      'Error deleting edge:',
      expect.any(Error)
    );
  });
});

describe('createGroup', () => {
  it('should create group successfully', async () => {
    const params = {
      nodeIds: ['node-1', 'node-2'],
      label: 'Test Group',
    };
    const mockResponse = {
      success: true,
      flow: { nodes: [], edges: [] },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await createGroup(params);

    expect(global.fetch).toHaveBeenCalledWith('/api/group', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    expect(result).toEqual(mockResponse);
  });

  it('should throw error with server error message on failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Invalid group parameters' }),
    });

    await expect(createGroup({})).rejects.toThrow('Invalid group parameters');
    expect(console.error).toHaveBeenCalledWith(
      'Error creating group:',
      expect.any(Error)
    );
  });

  it('should throw default error message when server error missing', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    await expect(createGroup({})).rejects.toThrow('Failed to create group');
  });
});

describe('ungroup', () => {
  it('should ungroup successfully', async () => {
    const groupId = 'group-123';
    const mockResponse = {
      success: true,
      flow: { nodes: [], edges: [] },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await ungroup(groupId);

    expect(global.fetch).toHaveBeenCalledWith('/api/group/group-123', {
      method: 'DELETE',
    });
    expect(result).toEqual(mockResponse);
  });

  it('should throw error with server error message on failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Group not found' }),
    });

    await expect(ungroup('invalid')).rejects.toThrow('Group not found');
    expect(console.error).toHaveBeenCalledWith(
      'Error ungrouping:',
      expect.any(Error)
    );
  });

  it('should throw default error message when server error missing', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    await expect(ungroup('group-123')).rejects.toThrow('Failed to ungroup');
  });
});

describe('toggleGroupExpansion', () => {
  it('should expand group successfully', async () => {
    const groupId = 'group-123';
    const mockResponse = {
      success: true,
      flow: { nodes: [], edges: [] },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await toggleGroupExpansion(groupId, true);

    expect(global.fetch).toHaveBeenCalledWith('/api/group/group-123/expand', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expand: true }),
    });
    expect(result).toEqual(mockResponse);
  });

  it('should collapse group successfully', async () => {
    const groupId = 'group-123';
    const mockResponse = {
      success: true,
      flow: { nodes: [], edges: [] },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await toggleGroupExpansion(groupId, false);

    expect(global.fetch).toHaveBeenCalledWith('/api/group/group-123/expand', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expand: false }),
    });
    expect(result).toEqual(mockResponse);
  });

  it('should throw error with server error message on failure', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ error: 'Group not found' }),
    });

    await expect(toggleGroupExpansion('invalid', true)).rejects.toThrow(
      'Group not found'
    );
    expect(console.error).toHaveBeenCalledWith(
      'Error toggling group expansion:',
      expect.any(Error)
    );
  });

  it('should throw default error message when server error missing', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({}),
    });

    await expect(toggleGroupExpansion('group-123', true)).rejects.toThrow(
      'Failed to toggle group expansion'
    );
  });
});

describe('Error Handling', () => {
  it('should handle malformed JSON responses', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => {
        throw new Error('Invalid JSON');
      },
    });

    await expect(loadFlow()).rejects.toThrow('Invalid JSON');
  });

  it('should handle network timeout errors', async () => {
    global.fetch.mockRejectedValueOnce(new Error('Request timeout'));

    await expect(loadFlow()).rejects.toThrow('Request timeout');
  });

  it('should handle CORS errors', async () => {
    global.fetch.mockRejectedValueOnce(new Error('CORS policy blocked'));

    await expect(loadFlow()).rejects.toThrow('CORS policy blocked');
  });
});

describe('Response Parsing', () => {
  it('should correctly parse complex response structures', async () => {
    const complexResponse = {
      success: true,
      flow: {
        nodes: [
          {
            id: 'node-1',
            type: 'default',
            position: { x: 100, y: 200 },
            data: { label: 'Complex Node' },
          },
        ],
        edges: [
          {
            id: 'edge-1',
            source: 'node-1',
            target: 'node-2',
            type: 'default',
          },
        ],
        settings: {
          colors: { primary: '#000' },
          dimensions: { width: 800, height: 600 },
        },
      },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => complexResponse,
    });

    const result = await undoFlow();
    expect(result).toEqual(complexResponse);
    expect(result.flow.nodes[0].position).toEqual({ x: 100, y: 200 });
    expect(result.flow.settings.colors.primary).toBe('#000');
  });

  it('should handle empty response bodies', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const result = await getHistoryStatus();
    expect(result).toEqual({});
  });

  it('should handle null values in responses', async () => {
    const responseWithNulls = {
      success: true,
      flow: { nodes: null, edges: null },
    };

    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => responseWithNulls,
    });

    const result = await undoFlow();
    expect(result.flow.nodes).toBeNull();
    expect(result.flow.edges).toBeNull();
  });
});

describe('Notes API Functions (T2.4-T2.6)', () => {
  describe('loadNotes (T2.4)', () => {
    it('should fetch notes from GET /api/notes', async () => {
      const mockNotesData = {
        bullets: ['First bullet', 'Second bullet'],
        conversationHistory: [
          { role: 'user', content: 'test', timestamp: '2025-01-01T00:00:00Z' }
        ]
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockNotesData,
      });

      const { loadNotes } = await import('../../../src/services/api');
      const result = await loadNotes();

      expect(global.fetch).toHaveBeenCalledWith('/api/notes');
      expect(result).toEqual(mockNotesData);
    });

    it('should throw error on failed fetch', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { loadNotes } = await import('../../../src/services/api');
      await expect(loadNotes()).rejects.toThrow('Failed to load notes');
      expect(console.error).toHaveBeenCalledWith(
        'Error loading notes:',
        expect.any(Error)
      );
    });
  });

  describe('sendNotesMessage (T2.5)', () => {
    it('should post to /api/notes with message', async () => {
      const message = 'I want to build a feature';
      const mockResponse = {
        success: true,
        bullets: ['Feature idea captured'],
        newBullets: ['Feature idea captured'],
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { sendNotesMessage } = await import('../../../src/services/api');
      const result = await sendNotesMessage(message);

      expect(global.fetch).toHaveBeenCalledWith('/api/notes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on failed send', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { sendNotesMessage } = await import('../../../src/services/api');
      await expect(sendNotesMessage('test')).rejects.toThrow('Failed to send notes message');
      expect(console.error).toHaveBeenCalledWith(
        'Error sending notes message:',
        expect.any(Error)
      );
    });
  });

  describe('updateNotes (T2.6)', () => {
    it('should put to /api/notes with bullets array', async () => {
      const bullets = ['Updated bullet 1', 'Updated bullet 2'];
      const mockResponse = {
        success: true,
        bullets,
      };

      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const { updateNotes } = await import('../../../src/services/api');
      const result = await updateNotes(bullets);

      expect(global.fetch).toHaveBeenCalledWith('/api/notes', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bullets }),
      });
      expect(result).toEqual(mockResponse);
    });

    it('should throw error on failed update', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const { updateNotes } = await import('../../../src/services/api');
      await expect(updateNotes([])).rejects.toThrow('Failed to update notes');
      expect(console.error).toHaveBeenCalledWith(
        'Error updating notes:',
        expect.any(Error)
      );
    });
  });
});
