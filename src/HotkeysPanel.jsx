// ABOUTME: Slide-in panel displaying all keyboard shortcuts and mouse interactions
// ABOUTME: Toggleable with ? button in bottom-right corner

import { useState } from 'react';
import { HOTKEYS, getCategories, formatKeys } from './hooks/useHotkeys';
import { THEME } from './constants/theme.js';

export default function HotkeysPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const categories = getCategories();

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: 'transparent',
          color: 'rgba(255, 255, 255, 0.5)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          fontSize: '16px',
          cursor: 'pointer',
          boxShadow: 'none',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s, color 0.2s, background-color 0.2s',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.9)';
          e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.3)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.color = 'rgba(255, 255, 255, 0.5)';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        aria-label="Toggle keyboard shortcuts panel"
      >
        ?
      </button>

      {/* Slide-in Panel */}
      <div
        className="hotkeys-panel"
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          width: '280px',
          height: '100vh',
          backgroundColor: THEME.node.colors.background,
          boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.3)',
          transform: isOpen ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease-in-out',
          zIndex: 999,
          overflowY: 'auto',
          padding: '20px',
          color: 'white',
        }}
      >
        <style>{`
          .hotkeys-panel::-webkit-scrollbar {
            width: 8px;
          }

          .hotkeys-panel::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.2);
            border-radius: 4px;
          }

          .hotkeys-panel::-webkit-scrollbar-thumb {
            background: rgba(99, 102, 241, 0.4);
            border-radius: 4px;
            transition: background 0.2s;
          }

          .hotkeys-panel::-webkit-scrollbar-thumb:hover {
            background: rgba(99, 102, 241, 0.6);
          }
        `}</style>
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: '0', fontSize: '17px', fontWeight: '500' }}>Shortcuts</h2>
        </div>

        {categories.map(category => {
          const hotkeysInCategory = HOTKEYS.filter(hk => hk.category === category);

          return (
            <div key={category} style={{ marginBottom: '20px' }}>
              <h3
                style={{
                  margin: '0 0 8px 0',
                  fontSize: '13px',
                  fontWeight: '400',
                  color: 'white',
                  opacity: 0.5,
                }}
              >
                {category}
              </h3>

              {hotkeysInCategory.map(hotkey => (
                <div
                  key={hotkey.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px',
                    minHeight: '24px',
                  }}
                >
                  <div style={{ flex: 1, fontSize: '13px', fontWeight: '400', color: 'white', opacity: 0.85 }}>
                    {hotkey.label}
                  </div>
                  <div
                    style={{
                      marginLeft: '12px',
                      padding: '3px 6px',
                      backgroundColor: 'rgba(255, 255, 255, 0.08)',
                      borderRadius: '3px',
                      fontSize: '12px',
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                      color: 'white',
                      opacity: 0.9,
                    }}
                  >
                    {formatKeys(hotkey.keys)}
                  </div>
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Overlay to close panel when clicking outside */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.3)',
            zIndex: 998,
          }}
        />
      )}
    </>
  );
}
