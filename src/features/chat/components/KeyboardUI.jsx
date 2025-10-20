// ABOUTME: Keyboard UI system: shortcuts panel, contextual tooltips, and action toasts
// ABOUTME: Includes slide-in panel, bottom-right tooltip hints, and top-right feedback toasts

import { useState, useEffect } from 'react';
import { HOTKEYS, getCategories, formatKeys } from '../../../hooks/useHotkeys';
import { THEME } from '../../../constants/theme.js';
import { Kbd } from './ChatInterface';

export default function KeyboardUI({ tooltipConfig }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => setShowContent(true), 300);
      return () => clearTimeout(timer);
    }
    setShowContent(false);
  }, [isOpen]);

  return (
    <>
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
          color: THEME.text.tertiary,
          border: '1px solid rgba(255, 255, 255, 0.2)',
          fontSize: '16px',
          cursor: 'pointer',
          zIndex: 200,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s, color 0.2s, background-color 0.2s',
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.color = THEME.text.primary;
          e.currentTarget.style.backgroundColor = 'rgba(99, 102, 241, 0.3)';
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.color = THEME.text.tertiary;
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
        aria-label="Toggle keyboard shortcuts panel"
      >
        ?
      </button>

      <div
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
          zIndex: 199,
          overflowY: 'auto',
          padding: '20px',
        }}
      >
        <div
          style={{
            opacity: showContent ? 1 : 0,
            transition: 'opacity 0.4s ease-out',
          }}
        >
          <h2 style={{ margin: '0 0 20px 0', fontSize: '17px', fontWeight: '500', color: THEME.text.primary }}>
            Shortcuts
          </h2>

          {getCategories().map((category) => (
            <div key={category} style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', fontWeight: '400', color: THEME.text.primary, opacity: 0.5 }}>
                {category}
              </h3>
              {HOTKEYS.filter(hk => hk.category === category).map((hotkey) => (
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
                  <div style={{ flex: 1, fontSize: '13px', color: THEME.text.primary, opacity: 0.85 }}>
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
                      color: THEME.text.primary,
                      opacity: 0.9,
                    }}
                  >
                    {formatKeys(hotkey.keys)}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

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
            zIndex: 198,
          }}
        />
      )}

      {/* Contextual tooltip (bottom-right corner) */}
      {tooltipConfig && (
        <div style={{
          position: 'fixed',
          bottom: 20,
          right: 20,
          zIndex: 2000,
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          background: THEME.tooltip.colors.background,
          border: `${THEME.tooltip.borderWidth} solid ${THEME.tooltip.colors.border}`,
          borderRadius: THEME.tooltip.borderRadius,
          padding: THEME.tooltip.padding,
          animation: 'slideIn 0.3s ease-out',
        }}>
          <Kbd style={{ gap: '4px', padding: '4px 8px', borderRadius: '6px', fontSize: '14px' }}>{tooltipConfig.keys}</Kbd>
          <span style={{ color: THEME.text.tertiary, fontSize: '13px' }}>{tooltipConfig.label}</span>
        </div>
      )}

    </>
  );
}
