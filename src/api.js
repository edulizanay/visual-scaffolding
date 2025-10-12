// ABOUTME: API client for backend flow operations
// ABOUTME: Handles loading and saving flow data to/from the backend
const API_BASE_URL = '/api';

export const loadFlow = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/flow`);
    if (!response.ok) {
      throw new Error('Failed to load flow');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading flow:', error);
    throw error;
  }
};

export const saveFlow = async (nodes, edges, skipSnapshot = false) => {
  try {
    const url = skipSnapshot
      ? `${API_BASE_URL}/flow?skipSnapshot=true`
      : `${API_BASE_URL}/flow`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nodes, edges }),
    });
    if (!response.ok) {
      throw new Error('Failed to save flow');
    }
    return await response.json();
  } catch (error) {
    console.error('Error saving flow:', error);
    throw error;
  }
};

export const sendMessage = async (message) => {
  try {
    const response = await fetch(`${API_BASE_URL}/conversation/message`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) {
      throw new Error('Failed to send message');
    }
    return await response.json();
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

export const getConversationDebug = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/conversation/debug`);
    if (!response.ok) {
      throw new Error('Failed to fetch conversation');
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching conversation:', error);
    throw error;
  }
};

export const clearConversation = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/conversation/history`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to clear conversation');
    }
    return await response.json();
  } catch (error) {
    console.error('Error clearing conversation:', error);
    throw error;
  }
};

export const undoFlow = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/flow/undo`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to undo');
    }
    return await response.json();
  } catch (error) {
    console.error('Error undoing:', error);
    throw error;
  }
};

export const redoFlow = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/flow/redo`, {
      method: 'POST',
    });
    if (!response.ok) {
      throw new Error('Failed to redo');
    }
    return await response.json();
  } catch (error) {
    console.error('Error redoing:', error);
    throw error;
  }
};

export const getHistoryStatus = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/flow/history-status`);
    if (!response.ok) {
      throw new Error('Failed to get history status');
    }
    return await response.json();
  } catch (error) {
    console.error('Error getting history status:', error);
    throw error;
  }
};

// Unified Flow Command API Helpers
// These functions provide consistent API access to all flow operations

// Node operations
export const createNode = async (params) => {
  try {
    const response = await fetch(`${API_BASE_URL}/node`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create node');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating node:', error);
    throw error;
  }
};

export const updateNode = async (nodeId, params) => {
  try {
    const response = await fetch(`${API_BASE_URL}/node/${nodeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update node');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating node:', error);
    throw error;
  }
};

export const deleteNode = async (nodeId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/node/${nodeId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete node');
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting node:', error);
    throw error;
  }
};

// Edge operations
export const createEdge = async (params) => {
  try {
    const response = await fetch(`${API_BASE_URL}/edge`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create edge');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating edge:', error);
    throw error;
  }
};

export const updateEdge = async (edgeId, params) => {
  try {
    const response = await fetch(`${API_BASE_URL}/edge/${edgeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to update edge');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating edge:', error);
    throw error;
  }
};

export const deleteEdge = async (edgeId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/edge/${edgeId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to delete edge');
    }
    return await response.json();
  } catch (error) {
    console.error('Error deleting edge:', error);
    throw error;
  }
};

// Group operations
export const createGroup = async (params) => {
  try {
    const response = await fetch(`${API_BASE_URL}/group`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create group');
    }
    return await response.json();
  } catch (error) {
    console.error('Error creating group:', error);
    throw error;
  }
};

export const ungroup = async (groupId) => {
  try {
    const response = await fetch(`${API_BASE_URL}/group/${groupId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to ungroup');
    }
    return await response.json();
  } catch (error) {
    console.error('Error ungrouping:', error);
    throw error;
  }
};

export const toggleGroupExpansion = async (groupId, expand) => {
  try {
    const response = await fetch(`${API_BASE_URL}/group/${groupId}/expand`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ expand }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to toggle group expansion');
    }
    return await response.json();
  } catch (error) {
    console.error('Error toggling group expansion:', error);
    throw error;
  }
};
