// ABOUTME: Notes panel component for capturing and editing thoughts
// ABOUTME: Slides in from left, displays editable bullets, no backdrop (companion workspace)

import { useState, useEffect, useCallback, useRef } from 'react';
import { loadNotes, updateNotes } from './api';
import { COLOR_DEEP_PURPLE, COLOR_INDIGO_LIGHT, TRANSITION_NORMAL, EASING_DECELERATE, EASING_ACCELERATE, Z_INDEX_NOTES_PANEL } from './constants/theme.js';

function NotesPanel({ isOpen, onClose, externalBullets }) {
  const [bullets, setBullets] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const debounceTimerRef = useRef(null);

  // Load notes when panel opens
  useEffect(() => {
    if (isOpen) {
      const fetchNotes = async () => {
        try {
          const data = await loadNotes();
          setBullets(data.bullets || []);
        } catch (error) {
          console.error('Failed to load notes:', error);
          setBullets([]);
        } finally {
          setIsLoading(false);
        }
      };
      fetchNotes();
    }
  }, [isOpen]);

  // Update bullets when external bullets change (from ChatInterface)
  useEffect(() => {
    if (externalBullets) {
      setBullets(externalBullets);
    }
  }, [externalBullets]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Auto-save bullets with debouncing
  const saveBullets = useCallback((updatedBullets) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(async () => {
      try {
        await updateNotes(updatedBullets);
      } catch (error) {
        console.error('Failed to update notes:', error);
      }
    }, 500);
  }, []);

  const handleBulletChange = useCallback((index, newValue) => {
    const updatedBullets = [...bullets];
    updatedBullets[index] = newValue;
    setBullets(updatedBullets);
    saveBullets(updatedBullets);
  }, [bullets, saveBullets]);

  const handleAddBullet = useCallback(() => {
    const updatedBullets = [...bullets, ''];
    setBullets(updatedBullets);
    saveBullets(updatedBullets);
  }, [bullets, saveBullets]);

  const handleDeleteBullet = useCallback((index) => {
    const updatedBullets = bullets.filter((_, i) => i !== index);
    setBullets(updatedBullets);
    saveBullets(updatedBullets);
  }, [bullets, saveBullets]);

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
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
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
        <button
          onClick={onClose}
          aria-label="Close notes panel"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: '24px',
            cursor: 'pointer',
            padding: '0',
            width: '24px',
            height: '24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'color 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
          }}
        >
          ×
        </button>
      </div>

      {/* Bullets Container */}
      <div
        data-testid="bullets-container"
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 20px',
        }}
      >
        {isLoading ? (
          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>
            Loading notes...
          </div>
        ) : bullets.length === 0 ? (
          <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px' }}>
            No notes yet. Start typing in the chat to add your first note!
          </div>
        ) : (
          bullets.map((bullet, index) => (
            <BulletItem
              key={index}
              value={bullet}
              onChange={(newValue) => handleBulletChange(index, newValue)}
              onDelete={() => handleDeleteBullet(index)}
            />
          ))
        )}

        {/* Add Bullet Button */}
        {bullets.length > 0 && (
          <button
            onClick={handleAddBullet}
            aria-label="Add new bullet point"
            style={{
              marginTop: '12px',
              padding: '8px 12px',
              background: 'transparent',
              border: '1px solid rgba(99, 102, 241, 0.3)',
              borderRadius: '4px',
              color: COLOR_INDIGO_LIGHT,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'all 150ms',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.1)';
              e.currentTarget.style.borderColor = COLOR_INDIGO_LIGHT;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.3)';
            }}
          >
            + Add bullet
          </button>
        )}
      </div>
    </div>
  );
}

function BulletItem({ value, onChange, onDelete }) {
  const [isFocused, setIsFocused] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const textareaRef = useRef(null);

  const adjustHeight = useCallback(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '8px',
        alignItems: 'flex-start',
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Bullet marker */}
      <span
        style={{
          color: COLOR_INDIGO_LIGHT,
          fontSize: '16px',
          lineHeight: '1.5',
          marginTop: '2px',
          userSelect: 'none',
        }}
      >
        •
      </span>

      {/* Editable textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          adjustHeight();
        }}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        aria-label="Edit bullet point"
        placeholder="Type your note here..."
        style={{
          flex: 1,
          background: isFocused ? 'rgba(99, 102, 241, 0.05)' : 'transparent',
          border: 'none',
          borderLeft: `2px solid ${isFocused ? COLOR_INDIGO_LIGHT : isHovered ? 'rgba(99, 102, 241, 0.3)' : 'transparent'}`,
          paddingLeft: '8px',
          paddingTop: '2px',
          paddingBottom: '2px',
          color: 'white',
          fontSize: '13px',
          lineHeight: '1.5',
          resize: 'none',
          outline: 'none',
          overflow: 'hidden',
          fontFamily: 'inherit',
          transition: 'all 150ms',
        }}
        rows={1}
      />

      {/* Delete button (visible on hover) */}
      {isHovered && (
        <button
          onClick={onDelete}
          aria-label="Delete bullet"
          style={{
            background: 'transparent',
            border: 'none',
            color: 'rgba(255, 255, 255, 0.4)',
            fontSize: '14px',
            cursor: 'pointer',
            padding: '0 4px',
            transition: 'color 150ms',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'rgba(239, 68, 68, 0.8)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.4)';
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}

export default NotesPanel;
