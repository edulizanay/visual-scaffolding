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

export const saveFlow = async (nodes, edges) => {
  try {
    const response = await fetch(`${API_BASE_URL}/flow`, {
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
