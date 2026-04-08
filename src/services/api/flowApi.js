// ABOUTME: Flow API client for backend flow operations
// ABOUTME: Handles flow CRUD, history, nodes, and edges
const API_BASE_URL = '/api/flow';

export const loadFlow = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}`);
    if (!response.ok) {
      throw new Error('Failed to load flow');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading flow:', error);
    throw error;
  }
};

export const undoFlow = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/undo`, {
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
    const response = await fetch(`${API_BASE_URL}/redo`, {
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
    const response = await fetch(`${API_BASE_URL}/history-status`);
    if (!response.ok) {
      throw new Error('Failed to get history status');
    }
    return await response.json();
  } catch (error) {
    console.error('Error getting history status:', error);
    throw error;
  }
};

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

export const toggleSubtreeCollapse = async (nodeId, collapsed) => {
  try {
    const response = await fetch(`${API_BASE_URL}/subtree/${nodeId}/collapse`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ collapsed }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to toggle subtree collapse');
    }
    return await response.json();
  } catch (error) {
    console.error('Error toggling subtree collapse:', error);
    throw error;
  }
};
