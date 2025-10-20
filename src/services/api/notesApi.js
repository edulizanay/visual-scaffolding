// ABOUTME: Notes API client for notes operations
// ABOUTME: Handles notes loading, updating, and AI-assisted message sending
const API_BASE_URL = '/api';

export const loadNotes = async () => {
  try {
    const response = await fetch(`${API_BASE_URL}/notes`);
    if (!response.ok) {
      throw new Error('Failed to load notes');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading notes:', error);
    throw error;
  }
};

export const sendNotesMessage = async (message) => {
  try {
    const response = await fetch(`${API_BASE_URL}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message }),
    });
    if (!response.ok) {
      throw new Error('Failed to send notes message');
    }
    return await response.json();
  } catch (error) {
    console.error('Error sending notes message:', error);
    throw error;
  }
};

export const updateNotes = async (bullets) => {
  try {
    const response = await fetch(`${API_BASE_URL}/notes`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ bullets }),
    });
    if (!response.ok) {
      throw new Error('Failed to update notes');
    }
    return await response.json();
  } catch (error) {
    console.error('Error updating notes:', error);
    throw error;
  }
};
