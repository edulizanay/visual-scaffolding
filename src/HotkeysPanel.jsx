// ABOUTME: Slide-in panel displaying all keyboard shortcuts and mouse interactions
// ABOUTME: Toggleable with ? button in bottom-right corner

import { useState } from 'react';
import { HOTKEYS, getCategories, formatKeys } from './hooks/useHotkeys';
import { THEME } from './constants/theme.jsx';

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
          bottom: '20px',
          right: '20px',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          backgroundColor: THEME.groupNode.colors.border,
          color: 'white',
          border: 'none',
          fontSize: '20px',
          cursor: 'pointer',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s',
        }}
        onMouseOver={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
        onMouseOut={(e) => e.currentTarget.style.transform = 'scale(1)'}
        aria-label="Toggle keyboard shortcuts panel"
      >
        ?
      </button>

      {/* Slide-in Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: isOpen ? 0 : '-400px',
          width: '400px',
          height: '100vh',
          backgroundColor: THEME.node.colors.background,
          boxShadow: '-2px 0 8px rgba(0, 0, 0, 0.3)',
          transition: 'right 0.3s ease-in-out',
          zIndex: 999,
          overflowY: 'auto',
          padding: '20px',
          color: 'white',
        }}
      >
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ margin: '0 0 10px 0', fontSize: '24px' }}>Keyboard Shortcuts</h2>
          <p style={{ margin: 0, fontSize: '14px', opacity: 0.7 }}>
            Quick reference for all available shortcuts
          </p>
        </div>

        {categories.map(category => {
          const hotkeysInCategory = HOTKEYS.filter(hk => hk.category === category);

          return (
            <div key={category} style={{ marginBottom: '30px' }}>
              <h3
                style={{
                  margin: '0 0 15px 0',
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: THEME.groupNode.colors.border,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                }}
              >
                {category}
              </h3>

              {hotkeysInCategory.map(hotkey => (
                <div
                  key={hotkey.id}
                  style={{
                    marginBottom: '15px',
                    paddingBottom: '15px',
                    borderBottom: `1px solid ${THEME.node.colors.border}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                        {hotkey.label}
                      </div>
                      <div style={{ fontSize: '13px', opacity: 0.7 }}>
                        {hotkey.description}
                      </div>
                    </div>
                    <div
                      style={{
                        marginLeft: '15px',
                        padding: '5px 10px',
                        backgroundColor: 'rgba(255, 255, 255, 0.1)',
                        borderRadius: '4px',
                        fontSize: '13px',
                        fontFamily: 'monospace',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatKeys(hotkey.keys)}
                    </div>
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
