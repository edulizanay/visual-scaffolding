// ABOUTME: Chat interface for AI tool interaction
// ABOUTME: Provides text input and sends messages to backend
import { useState, useCallback, useRef, useEffect } from 'react';
import { sendMessage, clearConversation } from './api';

const Kbd = ({ children }) => (
  <kbd
    style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '2px',
      padding: '2px 6px',
      backgroundColor: '#3a3a3a',
      border: '1px solid transparent',
      borderRadius: '4px',
      color: 'white',
      fontFamily: 'monospace',
      fontSize: '12px',
      boxShadow: '0 1px 3px rgba(0, 0, 0, 0.3)',
      userSelect: 'none'
    }}
  >
    {children}
  </kbd>
);

function ChatInterface({ onFlowUpdate }) {
  const [message, setMessage] = useState('');
  const isFirstMessage = useRef(true);
  const textareaRef = useRef(null);

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
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      handleSubmit(e);
    }
  }, [handleSubmit]);

  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      const activeElement = document.activeElement;
      const isEditableElement =
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.isContentEditable;

      if (!isEditableElement && textareaRef.current && e.key.length === 1) {
        textareaRef.current.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      maxWidth: '33.33vw',
      width: '100%',
      zIndex: 1000,
    }}>
      <form onSubmit={handleSubmit}>
        <div style={{ position: 'relative' }}>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or '/resume' to continue..."
            rows={1}
            style={{
              width: '100%',
              padding: '12px 16px',
              paddingRight: '70px',
              background: 'rgba(26, 26, 26, 0.95)',
              border: '1px solid rgba(107, 114, 128, 0.5)',
              borderRadius: '12px',
              color: 'white',
              fontSize: '14px',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
              boxSizing: 'border-box',
            }}
          />
          <div style={{
            position: 'absolute',
            right: '12px',
            top: 0,
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            pointerEvents: 'none',
            opacity: message.length > 0 ? 1 : 0,
            transition: 'opacity 150ms ease',
          }}>
            <Kbd>⌘</Kbd>
            <span style={{ color: '#9ca3af', fontSize: '12px' }}>+</span>
            <Kbd>⏎</Kbd>
          </div>
        </div>
      </form>
    </div>
  );
}

export default ChatInterface;
