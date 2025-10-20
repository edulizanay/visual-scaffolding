// ABOUTME: Notes panel component for capturing and editing thoughts
// ABOUTME: Slides in from left, displays editable bullets as simple text, no backdrop (companion workspace)

import { useState, useEffect, useCallback, useRef } from 'react';
import { loadNotes, updateNotes, sendMessage } from '../../../services/api';
import { COLOR_DEEP_PURPLE, COLOR_INDIGO_LIGHT, TRANSITION_NORMAL, EASING_DECELERATE, EASING_ACCELERATE, Z_INDEX_NOTES_PANEL } from '../../../constants/theme.js';
import { useDebouncedCallback } from '../../../shared/hooks/useDebouncedCallback.js';

// Render text with styled entity spans (including markers)
// Each span gets data-start and data-end attributes for character position mapping
function renderStyledText(text, { onEntityClick, bulletText, lineIndex }) {
  const regex = /(\*\*)([^*]+)(\*\*)/g;
  const parts = [];
  let charIndex = 0; // Track absolute character position in original text
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    // Plain text before match
    if (match.index > lastIndex) {
      const plainText = text.slice(lastIndex, match.index);
      const startPos = charIndex;
      const endPos = charIndex + plainText.length;

      parts.push(
        <span key={key++} data-start={startPos} data-end={endPos}>
          {plainText}
        </span>
      );

      charIndex = endPos;
    }

    const entityText = match[2];
    const fullMatch = match[0]; // **word**
    const startPos = charIndex;
    const endPos = charIndex + fullMatch.length;

    // Entity with markers: **word**
    // Store position of the entire **word** string
    parts.push(
      <span key={key++} data-start={startPos} data-end={endPos}>
        <span className="marker" data-start={startPos} data-end={startPos + 2}>**</span>
        <span
          className="entity"
          data-start={startPos + 2}
          data-end={endPos - 2}
          data-entity-text={entityText}
          onClick={() =>
            onEntityClick?.({
              bulletText,
              entityText,
              lineIndex,
            })
          }
        >
          {entityText}
        </span>
        <span className="marker" data-start={endPos - 2} data-end={endPos}>**</span>
      </span>
    );

    charIndex = endPos;
    lastIndex = match.index + match[0].length;
  }

  // Remaining text
  if (lastIndex < text.length) {
    const remainingText = text.slice(lastIndex);
    const startPos = charIndex;
    const endPos = charIndex + remainingText.length;

    parts.push(
      <span key={key++} data-start={startPos} data-end={endPos}>
        {remainingText}
      </span>
    );
  }

  return parts.length > 0 ? parts : text;
}

// Remove **entity** markers from bullet text
const stripEntityMarkers = (text) => {
  return text.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*\*/g, '').trim();
};

// Build prompt message for one or many bullets
const buildActionPrompt = (rawBullets) => {
  const normalizedBullets = rawBullets
    .map((bullet) => stripEntityMarkers(bullet))
    .filter((bullet) => bullet.length > 0);

  if (normalizedBullets.length === 0) {
    return null;
  }

  const guidance = 'If this change has already been applied, leave the graph as-is and do not repeat it.';

  if (normalizedBullets.length === 1) {
    return `Please execute this action. ${normalizedBullets[0]} ${guidance}`;
  }

  const bulletList = normalizedBullets.map((bullet) => `- ${bullet}`).join('\n');
  return `Please execute these actions.\n${bulletList}\n${guidance}`;
};

function NotesPanel({ isOpen, onToggle, externalBullets, onFlowUpdate }) {
  const [notesText, setNotesText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  // Convert bullets array to text (one bullet per line)
  const bulletsToText = useCallback((bullets) => {
    return bullets.join('\n');
  }, []);

  // Convert text to bullets array (split by newline, filter empty)
  const textToBullets = useCallback((text) => {
    return text.split('\n').filter(line => line.trim() !== '');
  }, []);

  // Load notes when panel opens
  useEffect(() => {
    if (isOpen) {
      const fetchNotes = async () => {
        try {
          const data = await loadNotes();
          setNotesText(bulletsToText(data.bullets || []));
        } catch (error) {
          console.error('Failed to load notes:', error);
          setNotesText('');
        } finally {
          setIsLoading(false);
        }
      };
      fetchNotes();
    }
  }, [isOpen, bulletsToText]);

  // Update text when external bullets change (from ChatInterface)
  useEffect(() => {
    if (externalBullets) {
      setNotesText(bulletsToText(externalBullets));
    }
  }, [externalBullets, bulletsToText]);

  // Auto-save notes with debouncing
  const saveNotes = useDebouncedCallback(async (text) => {
    try {
      const bullets = textToBullets(text);
      await updateNotes(bullets);
    } catch (error) {
      console.error('Failed to update notes:', error);
    }
  }, 500);

  const handleTextChange = useCallback((e) => {
    const newText = e.target.value;
    setNotesText(newText);
    saveNotes(newText);
  }, [saveNotes]);

  const handleEntityClick = useCallback(
    async ({ bulletText }) => {
      if (isSending) return;

      const prompt = buildActionPrompt([bulletText]);
      if (!prompt) return;

      setIsSending(true);
      try {
        const response = await sendMessage(prompt);
        if (response?.updatedFlow) {
          onFlowUpdate?.(response.updatedFlow);
        }
      } catch (error) {
        console.error('Failed to send bullet action:', error);
      } finally {
        setIsSending(false);
      }
    },
    [isSending, onFlowUpdate]
  );

  const handleLoadToGraph = useCallback(async () => {
    if (isSending) return;

    const bullets = notesText.split('\n');
    const prompt = buildActionPrompt(bullets);
    if (!prompt) return;

    setIsSending(true);
    try {
      const response = await sendMessage(prompt);
      if (response?.updatedFlow) {
        onFlowUpdate?.(response.updatedFlow);
      }
    } catch (error) {
      console.error('Failed to load bullets to graph:', error);
    } finally {
      setIsSending(false);
    }
  }, [isSending, notesText, onFlowUpdate]);

  // Ref to the textarea for programmatic focus/selection
  const textareaRef = useRef(null);

  // Handle clicks on the overlay - delegate to textarea or trigger entity actions
  const handleOverlayPointerDown = useCallback((e) => {
    const target = e.target;

    // Check if clicked on an entity
    if (target.classList.contains('entity')) {
      // Entity click - don't delegate to textarea, just return
      // Don't prevent default - let the onClick event fire naturally
      return;
    }

    // Regular text click - find character index and set textarea cursor
    e.preventDefault();

    // Use caretRangeFromPoint to find where the click landed
    const range = document.caretRangeFromPoint(e.clientX, e.clientY);
    if (!range) return;

    // Find the nearest span with data-start
    let node = range.startContainer;
    let offset = range.startOffset;

    // Walk up to find a span with data-start
    while (node && node.nodeType !== Node.ELEMENT_NODE) {
      node = node.parentNode;
    }

    while (node && !node.hasAttribute?.('data-start')) {
      node = node.parentNode;
    }

    if (!node) return;

    // Get the character index
    const dataStart = parseInt(node.getAttribute('data-start'), 10);
    const charIndex = dataStart + offset;

    // Set textarea selection to this position
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(charIndex, charIndex);
    }
  }, []);

  // Convert hex color to rgba with opacity
  const deepPurpleRgba = 'rgba(26, 25, 43, 0.98)';

  return (
    <div
      data-testid="notes-panel"
      role="complementary"
      aria-label="Notes and ideas panel"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '368px',
        height: '100vh',
        backgroundColor: deepPurpleRgba,
        borderRight: `1px solid ${COLOR_INDIGO_LIGHT}`,
        boxShadow: '2px 0 8px rgba(0, 0, 0, 0.3), 0 0 12px rgba(99, 102, 241, 0.3)',
        transform: isOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: `transform ${TRANSITION_NORMAL} ${isOpen ? EASING_DECELERATE : EASING_ACCELERATE}`,
        zIndex: Z_INDEX_NOTES_PANEL,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Toggle Button - attached to panel's top-right edge */}
      <button
        onClick={onToggle}
        aria-label={isOpen ? 'Close notes panel' : 'Open notes panel'}
        aria-expanded={isOpen}
        style={{
          position: 'absolute',
          top: '16px',
          right: isOpen ? '16px' : '-48px',
          width: '40px',
          height: '40px',
          borderRadius: '8px',
          backgroundColor: isOpen ? 'rgba(99, 102, 241, 0.2)' : 'rgba(26, 25, 43, 0.8)',
          color: isOpen ? '#6366f1' : 'rgba(255, 255, 255, 0.6)',
          border: `1px solid ${isOpen ? '#6366f1' : 'rgba(255, 255, 255, 0.2)'}`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 200ms ease',
          boxShadow: isOpen ? '0 0 12px rgba(99, 102, 241, 0.3)' : 'none',
          padding: '0',
        }}
        onMouseEnter={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.15)';
            e.currentTarget.style.color = '#6366f1';
            e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.5)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            e.currentTarget.style.backgroundColor = 'rgba(26, 25, 43, 0.8)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
          }
        }}
      >
        {isOpen ? (
          // Panel is open - show panel-right icon (can close it)
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/>
            <path d="M15 3v18"/>
          </svg>
        ) : (
          // Panel is closed - show panel-left icon (can open it)
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="3" rx="2"/>
            <path d="M9 3v18"/>
          </svg>
        )}
      </button>

      {/* Header */}
      <div
        style={{
          padding: '20px',
          borderBottom: '1px solid rgba(99, 102, 241, 0.2)',
        }}
      >
        <h2 style={{
          margin: 0,
          fontSize: '18px',
          fontWeight: '500',
          color: 'white',
        }}>
          Notes
        </h2>
      </div>

      {/* Notes Textarea */}
      <div
        data-testid="notes-container"
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 20px',
          position: 'relative',
        }}
      >
        {isLoading ? (
          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>
            Loading notes...
          </div>
        ) : (
          <div style={{ flex: 1, position: 'relative' }}>
            {/* Bullet points overlay */}
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '20px',
                pointerEvents: 'none',
                color: COLOR_INDIGO_LIGHT,
                fontSize: '13px',
                lineHeight: '1.8',
                userSelect: 'none',
                zIndex: 2,
              }}
            >
              {notesText.split('\n').map((_, index) => (
                <div key={index} style={{ height: '1.8em' }}>•</div>
              ))}
            </div>

            {/* Textarea with styled text background */}
            <div style={{ position: 'relative', width: '100%', height: '100%' }}>
              {/* Styled text layer (shows entities with styling) */}
              <div
                data-testid="styled-text-overlay"
                aria-hidden="true"
                onPointerDown={handleOverlayPointerDown}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  paddingLeft: '20px',
                  pointerEvents: 'auto',
                  userSelect: 'none',
                  color: 'white',
                  fontSize: '13px',
                  lineHeight: '1.8',
                  fontFamily: 'inherit',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  overflowWrap: 'break-word',
                  cursor: 'text',
                  zIndex: 2,
                }}
              >
                {notesText.split('\n').map((line, index) => (
                  <div key={index} style={{ minHeight: '1.8em' }}>
                    {line
                      ? renderStyledText(line, {
                          onEntityClick: handleEntityClick,
                          bulletText: line,
                          lineIndex: index,
                        })
                      : '\u00A0'}
                  </div>
                ))}
              </div>

              {/* Textarea (transparent, cursor only visible) */}
              <textarea
                ref={textareaRef}
                value={notesText}
                onChange={handleTextChange}
                aria-label="Notes text editor"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: 'transparent',
                  border: 'none',
                  color: 'transparent',
                  caretColor: 'white',
                  fontSize: '13px',
                  lineHeight: '1.8',
                  resize: 'none',
                  outline: 'none',
                  fontFamily: 'inherit',
                  padding: '0',
                  paddingLeft: '20px',
                  zIndex: 1,
                }}
              />
            </div>

            {/* Entity styling */}
            <style>{`
              .entity {
                color: #a5b4fc;
                font-weight: 500;
                cursor: pointer;
                transition: all 150ms ease;
              }
              .entity:hover {
                color: #c4b5fd;
                text-decoration: underline;
                text-decoration-color: rgba(165, 180, 252, 0.5);
              }
              .marker {
                opacity: 0.2;
                font-size: 0.85em;
              }
            `}</style>
          </div>
        )}
      </div>

      {/* Load to Graph Button */}
      <div
        style={{
          padding: '16px 20px',
          borderTop: '1px solid rgba(99, 102, 241, 0.2)',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <button
          onClick={handleLoadToGraph}
          style={{
            padding: '10px 24px',
            backgroundColor: COLOR_INDIGO_LIGHT,
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            transition: 'all 150ms ease',
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#7c7ff9';
            e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.4)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = COLOR_INDIGO_LIGHT;
            e.currentTarget.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.3)';
          }}
        >
          Load to Graph
        </button>
      </div>
    </div>
  );
}

export default NotesPanel;
