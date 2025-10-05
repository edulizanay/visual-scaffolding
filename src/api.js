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

export const saveFlow = async (nodes, edges, skipSnapshot = true) => {
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
