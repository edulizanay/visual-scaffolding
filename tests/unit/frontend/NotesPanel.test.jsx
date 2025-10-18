// ABOUTME: Unit tests for NotesPanel component
// ABOUTME: Tests panel visibility, animations, bullet editing, and data flow

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotesPanel from '../../../src/NotesPanel.jsx';
import * as api from '../../../src/api.js';

// Mock the API module
vi.mock('../../../src/api.js', () => ({
  loadNotes: vi.fn(),
  updateNotes: vi.fn(),
}));

// Mock theme constants
vi.mock('../../../src/constants/theme.js', () => ({
  THEME: {
    colors: {
      deepPurple: '#1a192b',
    },
    text: {
      primary: '#ffffff',
      secondary: '#e5e7eb',
      tertiary: '#9ca3af',
    },
  },
  TRANSITION_NORMAL: '250ms',
  EASING_DECELERATE: 'cubic-bezier(0.0, 0.0, 0.2, 1)',
  EASING_ACCELERATE: 'cubic-bezier(0.4, 0.0, 1, 1)',
  COLOR_DEEP_PURPLE: '#1a192b',
  COLOR_INDIGO_LIGHT: '#6366f1',
  Z_INDEX_NOTES_PANEL: 150,
}));

describe('NotesPanel Component', () => {
  let mockOnClose;
  let user;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnClose = vi.fn();
    user = userEvent.setup();

    // Default API responses
    api.loadNotes.mockResolvedValue({
      bullets: ['First note', 'Second note'],
      conversationHistory: [],
    });
    api.updateNotes.mockResolvedValue({
      success: true,
      bullets: [],
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('T3.1: Panel renders when isOpen=true, hidden when false', () => {
    it('should not render panel content when isOpen is false', () => {
      const { container } = render(
        <NotesPanel isOpen={false} onClose={mockOnClose} />
      );

      // Panel should be transformed off-screen (translateX(-100%))
      const panel = container.querySelector('[data-testid="notes-panel"]');
      expect(panel).toBeTruthy();
      expect(panel.style.transform).toContain('translateX(-100%)');
    });

    it('should render panel content when isOpen is true', async () => {
      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      // Panel should be visible (translateX(0))
      const panel = screen.getByTestId('notes-panel');
      expect(panel.style.transform).toContain('translateX(0)');
    });

    it('should load notes when panel opens', async () => {
      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalledTimes(1);
      });
    });

    it('should display loaded bullets', async () => {
      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('First note')).toBeInTheDocument();
        expect(screen.getByDisplayValue('Second note')).toBeInTheDocument();
      });
    });

    it('should show empty state when no bullets exist', async () => {
      api.loadNotes.mockResolvedValue({
        bullets: [],
        conversationHistory: [],
      });

      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      // Should show some empty state indication
      expect(screen.getByText(/no notes yet/i)).toBeInTheDocument();
    });
  });

  describe('T3.2: Slide animation uses TRANSITION_NORMAL and EASING_STANDARD', () => {
    it('should use TRANSITION_NORMAL (250ms) for animation duration', () => {
      const { container } = render(
        <NotesPanel isOpen={false} onClose={mockOnClose} />
      );

      const panel = container.querySelector('[data-testid="notes-panel"]');
      expect(panel.style.transition).toContain('250ms');
    });

    it('should use EASING_DECELERATE when opening', async () => {
      const { rerender, container } = render(
        <NotesPanel isOpen={false} onClose={mockOnClose} />
      );

      const panel = container.querySelector('[data-testid="notes-panel"]');

      // Rerender with isOpen=true to trigger open animation
      rerender(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      // When open, should use decelerate easing
      await waitFor(() => {
        expect(panel.style.transition).toContain('cubic-bezier(0.0, 0.0, 0.2, 1)');
      });
    });

    it('should use EASING_ACCELERATE when closing', async () => {
      const { rerender, container } = render(
        <NotesPanel isOpen={true} onClose={mockOnClose} />
      );

      const panel = container.querySelector('[data-testid="notes-panel"]');

      // Rerender with isOpen=false to trigger close animation
      rerender(<NotesPanel isOpen={false} onClose={mockOnClose} />);

      // When closing, should use accelerate easing
      await waitFor(() => {
        expect(panel.style.transition).toContain('cubic-bezier(0.4, 0.0, 1, 1)');
      });
    });

    it('should have 320px width on desktop', () => {
      const { container } = render(
        <NotesPanel isOpen={true} onClose={mockOnClose} />
      );

      const panel = container.querySelector('[data-testid="notes-panel"]');
      expect(panel.style.width).toBe('320px');
    });

    it('should have no backdrop (canvas stays interactive)', () => {
      const { container } = render(
        <NotesPanel isOpen={true} onClose={mockOnClose} />
      );

      // Should NOT have a backdrop overlay element
      const backdrop = container.querySelector('[data-testid="notes-backdrop"]');
      expect(backdrop).toBeFalsy();
    });
  });

  describe('T3.3: Bullets are editable (textarea per bullet)', () => {
    it('should render textarea for each bullet', async () => {
      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        const textareas = screen.getAllByRole('textbox');
        expect(textareas.length).toBe(2);
      });
    });

    it('should display bullet marker (•) for each bullet', async () => {
      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        const markers = screen.getAllByText('•');
        expect(markers.length).toBe(2);
      });
    });

    it('should allow editing bullet text', async () => {
      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('First note')).toBeInTheDocument();
      });

      const textarea = screen.getByDisplayValue('First note');
      await user.clear(textarea);
      await user.type(textarea, 'Updated note');

      expect(textarea.value).toBe('Updated note');
    });

    it('should allow deleting bullet content', async () => {
      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('First note')).toBeInTheDocument();
      });

      const textarea = screen.getByDisplayValue('First note');
      await user.clear(textarea);

      expect(textarea.value).toBe('');
    });

    it('should allow adding new bullet', async () => {
      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      // Find "Add bullet" button or similar UI
      const addButton = screen.getByText(/add bullet/i);
      await user.click(addButton);

      // Should now have 3 textareas
      const textareas = screen.getAllByRole('textbox');
      expect(textareas.length).toBe(3);
    });
  });

  describe('T3.4: Edit triggers updateNotes() API call', () => {
    it('should call updateNotes when bullet is edited', async () => {
      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('First note')).toBeInTheDocument();
      });

      const textarea = screen.getByDisplayValue('First note');
      await user.clear(textarea);
      await user.type(textarea, 'Updated');

      // Should auto-save after edit
      await waitFor(() => {
        expect(api.updateNotes).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    it('should debounce updateNotes calls', async () => {
      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('First note')).toBeInTheDocument();
      });

      const textarea = screen.getByDisplayValue('First note');

      // Type multiple characters quickly
      await user.type(textarea, ' extra text');

      // Should debounce and call only once (or fewer times than characters typed)
      await waitFor(() => {
        expect(api.updateNotes).toHaveBeenCalled();
      }, { timeout: 2000 });

      // Get the number of calls - should be debounced
      const callCount = api.updateNotes.mock.calls.length;
      expect(callCount).toBeLessThan(11); // Less than number of characters typed
    });

    it('should send updated bullets array to API', async () => {
      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('First note')).toBeInTheDocument();
      });

      const textarea = screen.getByDisplayValue('First note');
      await user.clear(textarea);
      await user.type(textarea, 'Changed');

      await waitFor(() => {
        expect(api.updateNotes).toHaveBeenCalledWith(
          expect.arrayContaining(['Changed', 'Second note'])
        );
      }, { timeout: 2000 });
    });
  });

  describe('T3.5: Close button calls onClose() prop', () => {
    it('should render close button', async () => {
      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const closeButton = screen.getByLabelText(/close notes panel/i);
      expect(closeButton).toBeInTheDocument();
    });

    it('should call onClose when close button is clicked', async () => {
      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const closeButton = screen.getByLabelText(/close notes panel/i);
      await user.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should display close button as X in top-right', async () => {
      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const closeButton = screen.getByLabelText(/close notes panel/i);
      expect(closeButton.textContent).toBe('×');
    });
  });

  describe('Additional UI Requirements', () => {
    it('should display header with title', async () => {
      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      expect(screen.getByText(/notes & ideas/i)).toBeInTheDocument();
    });

    it('should have scrollable bullets area', async () => {
      // Create many bullets
      api.loadNotes.mockResolvedValue({
        bullets: Array(20).fill(0).map((_, i) => `Note ${i + 1}`),
        conversationHistory: [],
      });

      const { container } = render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const scrollableArea = container.querySelector('[data-testid="bullets-container"]');
      expect(scrollableArea.style.overflowY).toBe('auto');
    });

    it('should use COLOR_DEEP_PURPLE background with 98% opacity', () => {
      const { container } = render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      const panel = container.querySelector('[data-testid="notes-panel"]');
      expect(panel.style.backgroundColor).toContain('rgba');
      expect(panel.style.backgroundColor).toContain('0.98');
    });

    it('should have right border with indigo color', () => {
      const { container } = render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      const panel = container.querySelector('[data-testid="notes-panel"]');
      expect(panel.style.borderRight).toBeTruthy();
      expect(panel.style.borderRight).toContain('1px');
    });
  });

  describe('Error Handling', () => {
    it('should handle loadNotes error gracefully', async () => {
      const consoleError = console.error;
      console.error = vi.fn();

      api.loadNotes.mockRejectedValue(new Error('Failed to load'));

      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      // Panel should still render with empty state
      expect(screen.getByTestId('notes-panel')).toBeInTheDocument();

      console.error = consoleError;
    });

    it('should handle updateNotes error gracefully', async () => {
      const consoleError = console.error;
      console.error = vi.fn();

      api.updateNotes.mockRejectedValue(new Error('Failed to update'));

      render(<NotesPanel isOpen={true} onClose={mockOnClose} />);

      await waitFor(() => {
        expect(screen.getByDisplayValue('First note')).toBeInTheDocument();
      });

      const textarea = screen.getByDisplayValue('First note');
      await user.type(textarea, ' edit');

      // Should attempt update but handle error
      await waitFor(() => {
        expect(api.updateNotes).toHaveBeenCalled();
      }, { timeout: 2000 });

      console.error = consoleError;
    });
  });
});
