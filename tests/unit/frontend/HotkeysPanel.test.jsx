// ABOUTME: Tests for HotkeysPanel component
// ABOUTME: Validates rendering, toggle behavior, and hotkey display

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import HotkeysPanel from '../../../src/HotkeysPanel';

// Mock the THEME constant
jest.mock('../../../src/constants/theme.jsx', () => ({
  THEME: {
    colors: {
      primary: '#6366f1',
      nodeDefault: '#1e293b',
      edgeDefault: '#64748b',
    },
  },
}));

describe('HotkeysPanel Component', () => {
  describe('Toggle Button', () => {
    it('should render toggle button', () => {
      render(<HotkeysPanel />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');
      expect(button).toBeInTheDocument();
      expect(button.textContent).toBe('?');
    });

    it('should open panel when button is clicked', () => {
      const { container } = render(<HotkeysPanel />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');

      // Panel should be closed initially (off-screen)
      const panel = container.querySelector('div[style*="right"]');
      expect(panel.style.right).toBe('-400px');

      // Click to open
      fireEvent.click(button);

      // Panel should be open (on-screen)
      expect(panel.style.right).toBe('0px');
    });

    it('should close panel when button is clicked again', () => {
      const { container } = render(<HotkeysPanel />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');
      const panel = container.querySelector('div[style*="right"]');

      // Open panel
      fireEvent.click(button);
      expect(panel.style.right).toBe('0px');

      // Close panel
      fireEvent.click(button);
      expect(panel.style.right).toBe('-400px');
    });
  });

  describe('Panel Content', () => {
    it('should display panel title', () => {
      render(<HotkeysPanel />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');
      fireEvent.click(button);

      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });

    it('should display all categories', () => {
      render(<HotkeysPanel />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');
      fireEvent.click(button);

      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('Group Operations')).toBeInTheDocument();
      expect(screen.getByText('Chat')).toBeInTheDocument();
    });

    it('should display hotkey labels', () => {
      render(<HotkeysPanel />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');
      fireEvent.click(button);

      expect(screen.getByText('Undo')).toBeInTheDocument();
      expect(screen.getByText('Redo')).toBeInTheDocument();
      expect(screen.getByText('Group Nodes')).toBeInTheDocument();
      expect(screen.getByText('Ungroup')).toBeInTheDocument();
    });

    it('should display hotkey descriptions', () => {
      render(<HotkeysPanel />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');
      fireEvent.click(button);

      expect(screen.getByText('Undo the last action')).toBeInTheDocument();
      expect(screen.getByText('Combine 2+ selected nodes into a group')).toBeInTheDocument();
    });

    it('should display formatted key combinations', () => {
      render(<HotkeysPanel />);
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
      const { container } = render(<HotkeysPanel />);
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

    it('should close panel when clicking overlay', () => {
      const { container } = render(<HotkeysPanel />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');
      const panel = container.querySelector('div[style*="right"]');

      // Open panel
      fireEvent.click(button);
      expect(panel.style.right).toBe('0px');

      // Click overlay
      const overlay = container.querySelector('div[style*="position: fixed"][style*="width: 100%"][style*="height: 100%"]');
      fireEvent.click(overlay);

      // Panel should be closed
      expect(panel.style.right).toBe('-400px');
    });

    it('should hide overlay when panel is closed', () => {
      const { container } = render(<HotkeysPanel />);
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

  describe('Panel State', () => {
    it('should start with panel closed', () => {
      const { container } = render(<HotkeysPanel />);
      const panel = container.querySelector('div[style*="right"]');
      expect(panel.style.right).toBe('-400px');
    });

    it('should maintain independent state across multiple renders', () => {
      const { container, rerender } = render(<HotkeysPanel />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');
      const panel = container.querySelector('div[style*="right"]');

      // Open panel
      fireEvent.click(button);
      expect(panel.style.right).toBe('0px');

      // Re-render
      rerender(<HotkeysPanel />);

      // Panel should still be open
      expect(panel.style.right).toBe('0px');
    });
  });

  describe('Accessibility', () => {
    it('should have aria-label on toggle button', () => {
      render(<HotkeysPanel />);
      const button = screen.getByLabelText('Toggle keyboard shortcuts panel');
      expect(button).toHaveAttribute('aria-label');
    });
  });

  describe('All Hotkeys Display', () => {
    it('should display all hotkeys from registry', () => {
      render(<HotkeysPanel />);
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
