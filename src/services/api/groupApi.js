// ABOUTME: Group API client for group operations
// ABOUTME: Handles group creation, deletion, and expansion
const API_BASE_URL = '/api';

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
