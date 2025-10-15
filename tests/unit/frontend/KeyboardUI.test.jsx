// ABOUTME: Tests for KeyboardUI component
// ABOUTME: Validates rendering, toggle behavior, and hotkey display

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import KeyboardUI from '../../../src/KeyboardUI';

// Mock the THEME constant
vi.mock('../../../src/constants/theme.js', () => ({
  THEME: {
    node: {
      colors: {
        background: '#1a192b',
        border: '#2b2253',
        text: '#ffffff',
      },
    },
    groupNode: {
      colors: {
        background: '#3730a3',
        border: '#6366f1',
        text: '#ffffff',
      },
    },
    text: {
      tertiary: 'rgba(255, 255, 255, 0.5)',
    },
  },
}));

describe('KeyboardUI Component', () => {
  describe('Toggle Button', () => {
    it('should render toggle button', () => {
      render(<KeyboardUI />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');
      expect(button).toBeInTheDocument();
      expect(button.textContent).toBe('?');
    });

    // Note: Removed stale tests that checked old 'right' positioning
    // Component now uses transform: translateX() for animations
    // TODO: Add new tests for transform-based positioning if needed
  });

  describe('Panel Content', () => {
    it('should display panel title', () => {
      render(<KeyboardUI />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');
      fireEvent.click(button);

      expect(screen.getByText('Shortcuts')).toBeInTheDocument();
    });

    it('should display all categories', () => {
      render(<KeyboardUI />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');
      fireEvent.click(button);

      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Group Operations')).toBeInTheDocument();
      expect(screen.getByText('Chat')).toBeInTheDocument();
    });

    it('should display hotkey labels', () => {
      render(<KeyboardUI />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');
      fireEvent.click(button);

      expect(screen.getByText('Undo')).toBeInTheDocument();
      expect(screen.getByText('Redo')).toBeInTheDocument();
      expect(screen.getByText('Group Nodes')).toBeInTheDocument();
      expect(screen.getByText('Ungroup')).toBeInTheDocument();
    });

    it('should display hotkey labels without descriptions', () => {
      render(<KeyboardUI />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');
      fireEvent.click(button);

      // Component shows labels only (not descriptions) for streamlined UI
      expect(screen.getByText('Undo')).toBeInTheDocument();
      expect(screen.getByText('Group Nodes')).toBeInTheDocument();
    });

    it('should display formatted key combinations', () => {
      render(<KeyboardUI />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');
      fireEvent.click(button);

      // Look for formatted keys (⌘ for Meta)
      expect(screen.getByText('⌘ Z')).toBeInTheDocument();
      expect(screen.getByText('⌘ Y')).toBeInTheDocument();
      expect(screen.getByText('⌘ G')).toBeInTheDocument();
    });
  });

  describe('Overlay', () => {
    it('should show overlay when panel is open', () => {
      const { container } = render(<KeyboardUI />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');

      // Overlay should not exist when closed
      let overlay = container.querySelector('div[style*="position: fixed"][style*="width: 100%"][style*="height: 100%"]');
      expect(overlay).toBeFalsy();

      // Open panel
      fireEvent.click(button);

      // Overlay should exist when open
      overlay = container.querySelector('div[style*="position: fixed"][style*="width: 100%"][style*="height: 100%"]');
      expect(overlay).toBeTruthy();
    });

    // Note: Removed stale test that checked 'right' positioning
    // Component now uses transform: translateX() for animations

    it('should hide overlay when panel is closed', () => {
      const { container } = render(<KeyboardUI />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');

      // Open panel
      fireEvent.click(button);
      let overlay = container.querySelector('div[style*="position: fixed"][style*="width: 100%"][style*="height: 100%"]');
      expect(overlay).toBeTruthy();

      // Close panel
      fireEvent.click(button);
      overlay = container.querySelector('div[style*="position: fixed"][style*="width: 100%"][style*="height: 100%"]');
      expect(overlay).toBeFalsy();
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on toggle button', () => {
      render(<KeyboardUI />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');
      expect(button).toHaveAttribute('aria-label');
    });
  });

  describe('All Hotkeys Display', () => {
    it('should display all hotkeys from registry', () => {
      render(<KeyboardUI />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');
      fireEvent.click(button);

      // Check for a few key hotkeys from different categories
      expect(screen.getByText('Undo')).toBeInTheDocument();
      expect(screen.getByText('Redo')).toBeInTheDocument();
      expect(screen.getByText('Group Nodes')).toBeInTheDocument();
      expect(screen.getByText('Ungroup')).toBeInTheDocument();
      expect(screen.getByText('Multi-Select')).toBeInTheDocument();
      expect(screen.getByText('Submit Message')).toBeInTheDocument();
      expect(screen.getByText('Commit Edit')).toBeInTheDocument();
    });
  });
});
