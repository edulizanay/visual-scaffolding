// ABOUTME: Conversation API client for chat operations
// ABOUTME: Handles message sending and conversation management
const API_BASE_URL = '/api';

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
