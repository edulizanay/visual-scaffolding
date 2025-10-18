// ABOUTME: Notes panel component for capturing and editing thoughts
// ABOUTME: Slides in from left, displays editable bullets as simple text, no backdrop (companion workspace)

import { useState, useEffect, useCallback, useRef } from 'react';
import { loadNotes, updateNotes } from './api';
import { COLOR_DEEP_PURPLE, COLOR_INDIGO_LIGHT, TRANSITION_NORMAL, EASING_DECELERATE, EASING_ACCELERATE, Z_INDEX_NOTES_PANEL } from './constants/theme.js';

function NotesPanel({ isOpen, externalBullets }) {
  const [notesText, setNotesText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const debounceTimerRef = useRef(null);

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

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Auto-save notes with debouncing
  const saveNotes = useCallback((text) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const bullets = textToBullets(text);
        await updateNotes(bullets);
      } catch (error) {
        console.error('Failed to update notes:', error);
      }
    }, 500);
  }, [textToBullets]);

  const handleTextChange = useCallback((e) => {
    const newText = e.target.value;
    setNotesText(newText);
    saveNotes(newText);
  }, [saveNotes]);

  // Convert hex color to rgba with opacity
  const deepPurpleRgba = 'rgba(26, 25, 43, 0.98)';

  return (
    <div
      data-testid="notes-panel"
      role="complementary"
      aria-label="Notes and ideas panel"
      aria-hidden={!isOpen}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '320px',
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
          Notes & Ideas
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
              }}
            >
              {notesText.split('\n').map((_, index) => (
                <div key={index} style={{ height: '1.8em' }}>•</div>
              ))}
            </div>

            {/* Textarea */}
            <textarea
              value={notesText}
              onChange={handleTextChange}
              aria-label="Notes text editor"
              style={{
                width: '100%',
                height: '100%',
                background: 'transparent',
                border: 'none',
                color: 'white',
                fontSize: '13px',
                lineHeight: '1.8',
                resize: 'none',
                outline: 'none',
                fontFamily: 'inherit',
                padding: '0',
                paddingLeft: '20px',
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default NotesPanel;
