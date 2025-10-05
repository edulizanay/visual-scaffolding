// ABOUTME: Chat interface for AI tool interaction
// ABOUTME: Provides text input and sends messages to backend
import { useState, useCallback, useEffect, useRef } from 'react';
import { sendMessage, clearConversation } from './api';

function ChatInterface({ nodes, edges }) {
  const [message, setMessage] = useState('');
  const isInitialized = useRef(false);

  // Clear conversation history on mount (start fresh session)
  useEffect(() => {
    if (!isInitialized.current) {
      clearConversation().catch(error => {
        console.warn('Failed to clear conversation on init:', error);
      });
      isInitialized.current = true;
    }
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    // Check for /resume command
    if (message.trim() === '/resume') {
      console.log('📜 Resuming previous conversation...');
      // Just log for now - history already exists
      setMessage('');
      return;
    }

    try {
      const response = await sendMessage(message);
      console.log('✅ Message saved to conversation.json:', response);
      console.log('📂 Check server/data/conversation.json to see the message');
      setMessage('');
    } catch (error) {
      console.error('❌ Failed to send message:', error);
    }
  }, [message]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      background: 'rgba(0, 0, 0, 0.9)',
      borderTop: '1px solid #333',
      padding: '12px 16px',
      zIndex: 1000,
    }}>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '8px', maxWidth: '1200px', margin: '0 auto' }}>
        <input
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command (e.g., 'add a login node') or '/resume' to continue previous session..."
          style={{
            flex: 1,
            padding: '8px 12px',
            background: '#1a1a1a',
            border: '1px solid #444',
            borderRadius: '4px',
            color: 'white',
            fontSize: '14px',
            outline: 'none',
          }}
        />
        <button
          type="submit"
          style={{
            padding: '8px 24px',
            background: '#0066cc',
            border: 'none',
            borderRadius: '4px',
            color: 'white',
            fontSize: '14px',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default ChatInterface;
