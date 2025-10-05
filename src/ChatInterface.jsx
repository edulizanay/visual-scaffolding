// ABOUTME: Chat interface for AI tool interaction
// ABOUTME: Provides text input and sends messages to backend
import { useState, useCallback, useRef } from 'react';
import { sendMessage, clearConversation } from './api';

function ChatInterface({ onFlowUpdate }) {
  const [message, setMessage] = useState('');
  const isFirstMessage = useRef(true);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    // Handle first message of the session
    if (isFirstMessage.current) {
      isFirstMessage.current = false;

      // If first message is /resume, keep history and continue
      if (message.trim() === '/resume') {
        console.log('📜 Resuming previous conversation...');
        setMessage('');
        return;
      }

      // Otherwise, clear history and start fresh
      try {
        await clearConversation();
        console.log('🆕 Starting new conversation (history cleared)');
      } catch (error) {
        console.warn('Failed to clear conversation:', error);
      }
    }

    try {
      const response = await sendMessage(message);
      console.log('✅ AI Response:', response);

      // Update the flow visualization if the AI made changes
      if (response.updatedFlow) {
        onFlowUpdate(response.updatedFlow);
        console.log('🔄 Flow updated with AI changes');
      }

      setMessage('');
    } catch (error) {
      console.error('❌ Failed to send message:', error);
    }
  }, [message, onFlowUpdate]);

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
          placeholder="Type a command or '/resume' to continue previous session..."
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
