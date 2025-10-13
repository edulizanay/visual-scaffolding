// ABOUTME: Chat interface for AI tool interaction
// ABOUTME: Provides text input and sends messages to backend
import { useState, useCallback, useRef, useEffect } from 'react';
import { sendMessage, clearConversation, getConversationDebug } from './api';
import { THEME } from './constants/theme.js';

export const Kbd = ({ children, style = {} }) => (
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
      userSelect: 'none',
      ...style
    }}
  >
    {children}
  </kbd>
);

function ChatInterface({ onFlowUpdate, onProcessingChange }) {
  const [message, setMessage] = useState('');
  const [historyPosition, setHistoryPosition] = useState(-1);
  const [draftMessage, setDraftMessage] = useState('');
  const [userMessages, setUserMessages] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingPlaceholder, setProcessingPlaceholder] = useState('processing.');
  const isFirstMessage = useRef(true);
  const textareaRef = useRef(null);
  const submissionLockRef = useRef(false);

  useEffect(() => {
    onProcessingChange?.(isProcessing);
  }, [isProcessing, onProcessingChange]);

  const adjustTextareaHeight = useCallback((textarea) => {
    if (!textarea) return;

    const minHeight = 38;
    const maxHeight = 76;

    textarea.style.height = 'auto';
    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
    textarea.style.overflowY = scrollHeight > maxHeight ? 'scroll' : 'hidden';
  }, []);

  const loadConversationHistory = useCallback(async () => {
    try {
      const { history } = await getConversationDebug();
      const messages = history
        .filter(msg => msg.role === 'user')
        .map(msg => msg.content)
        .reverse(); // Most recent first
      setUserMessages(messages);
    } catch (error) {
      console.error('Failed to load conversation history:', error);
    }
  }, []);

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    if (submissionLockRef.current || isProcessing) return;
    submissionLockRef.current = true;

    // Save message before clearing
    const messageToSend = message;

    // Clear input and start processing immediately
    setMessage('');
    setIsProcessing(true);

    // Handle first message of the session
    if (isFirstMessage.current) {
      isFirstMessage.current = false;

      // If first message is /resume, keep history and continue
      if (messageToSend.trim() === '/resume') {
        console.log('📜 Resuming previous conversation...');
        setIsProcessing(false);
        submissionLockRef.current = false;
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
      const response = await sendMessage(messageToSend);
      console.log('✅ AI Response:', response);

      // Update the flow visualization if the AI made changes
      if (response.updatedFlow) {
        onFlowUpdate(response.updatedFlow);
        console.log('🔄 Flow updated with AI changes');
      }

      setHistoryPosition(-1);
      setDraftMessage('');
      await loadConversationHistory();
    } catch (error) {
      console.error('❌ Failed to send message:', error);
    } finally {
      setIsProcessing(false);
      submissionLockRef.current = false;
    }
  }, [message, isProcessing, onFlowUpdate, loadConversationHistory]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      if (e.repeat) {
        e.preventDefault();
        return;
      }
      e.preventDefault();
      handleSubmit(e);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // If at current draft, save it
      if (historyPosition === -1) {
        setDraftMessage(message);
      }
      // Move back in history if possible
      if (historyPosition < userMessages.length - 1) {
        const newPosition = historyPosition + 1;
        setHistoryPosition(newPosition);
        setMessage(userMessages[newPosition]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      // Move forward in history
      if (historyPosition > -1) {
        const newPosition = historyPosition - 1;
        setHistoryPosition(newPosition);
        if (newPosition === -1) {
          setMessage(draftMessage); // Restore draft
        } else {
          setMessage(userMessages[newPosition]);
        }
      }
    }
  }, [handleSubmit, historyPosition, userMessages, message, draftMessage]);

  const handleTextareaChange = useCallback((e) => {
    setMessage(e.target.value);
    adjustTextareaHeight(e.target);
  }, [adjustTextareaHeight]);

  useEffect(() => {
    loadConversationHistory();
  }, [loadConversationHistory]);

  useEffect(() => {
    adjustTextareaHeight(textareaRef.current);
  }, [message, adjustTextareaHeight]);

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

  useEffect(() => {
    if (!isProcessing) return;

    const dots = ['.', '..', '...'];
    let index = 0;

    const interval = setInterval(() => {
      index = (index + 1) % dots.length;
      setProcessingPlaceholder(`processing${dots[index]}`);
    }, 500);

    return () => clearInterval(interval);
  }, [isProcessing]);

  return (
    <>
      <style>{`
        .chat-textarea::-webkit-scrollbar {
          display: none;
        }
      `}</style>
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
              className="chat-textarea"
              ref={textareaRef}
              value={message}
              onChange={handleTextareaChange}
              onKeyDown={handleKeyDown}
              placeholder={isProcessing ? processingPlaceholder : "Type a command or '/resume' to continue conversation."}
              rows={1}
              style={{
                width: '100%',
                minHeight: '38px',
                maxHeight: '76px',
                margin: 0,
                padding: '12px 16px',
                paddingRight: '70px',
                background: 'rgba(26, 26, 26, 0.95)',
                border: '1px solid rgba(107, 114, 128, 0.5)',
                borderRadius: '12px',
                color: 'white',
                fontSize: '12px',
                outline: 'none',
                resize: 'none',
                fontFamily: 'inherit',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)',
                boxSizing: 'border-box',
                overflowY: 'hidden',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none',
                opacity: isProcessing ? 0.6 : 1,
                transition: 'opacity 200ms ease',
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
              <span style={{ color: THEME.text.tertiary, fontSize: '12px' }}>+</span>
              <Kbd>⏎</Kbd>
            </div>
          </div>
        </form>
      </div>
    </>
  );
}

export default ChatInterface;
