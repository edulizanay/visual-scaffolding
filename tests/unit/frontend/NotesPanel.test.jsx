// ABOUTME: Unit tests for NotesPanel component
// ABOUTME: Tests panel visibility, animations, text editing, and data flow

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
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
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('T3.1: Panel renders when isOpen=true, hidden when false', () => {
    it('should not render panel content when isOpen is false', () => {
      const { container } = render(
        <NotesPanel isOpen={false}  />
      );

      // Panel should be transformed off-screen (translateX(-100%))
      const panel = container.querySelector('[data-testid="notes-panel"]');
      expect(panel).toBeTruthy();
      expect(panel.style.transform).toContain('translateX(-100%)');
    });

    it('should render panel content when isOpen is true', async () => {
      render(<NotesPanel isOpen={true}  />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      // Panel should be visible (translateX(0))
      const panel = screen.getByTestId('notes-panel');
      expect(panel.style.transform).toContain('translateX(0)');
    });

    it('should load notes when panel opens', async () => {
      render(<NotesPanel isOpen={true}  />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalledTimes(1);
      });
    });

    it('should display loaded bullets as text (one per line)', async () => {
      render(<NotesPanel isOpen={true}  />);

      await waitFor(() => {
        const textarea = screen.getByLabelText(/notes text editor/i);
        expect(textarea.value).toBe('First note\nSecond note');
      });
    });

    it('should show empty textarea when no bullets exist', async () => {
      api.loadNotes.mockResolvedValue({
        bullets: [],
        conversationHistory: [],
      });

      render(<NotesPanel isOpen={true} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      // Should show empty textarea
      const textarea = screen.getByLabelText(/notes text editor/i);
      expect(textarea.value).toBe('');
    });
  });

  describe('T3.2: Slide animation uses TRANSITION_NORMAL and EASING_STANDARD', () => {
    it('should use TRANSITION_NORMAL (250ms) for animation duration', () => {
      const { container } = render(
        <NotesPanel isOpen={false}  />
      );

      const panel = container.querySelector('[data-testid="notes-panel"]');
      expect(panel.style.transition).toContain('250ms');
    });

    it('should use EASING_DECELERATE when opening', async () => {
      const { rerender, container } = render(
        <NotesPanel isOpen={false}  />
      );

      const panel = container.querySelector('[data-testid="notes-panel"]');

      // Rerender with isOpen=true to trigger open animation
      rerender(<NotesPanel isOpen={true}  />);

      // When open, should use decelerate easing
      await waitFor(() => {
        expect(panel.style.transition).toContain('cubic-bezier(0.0, 0.0, 0.2, 1)');
      });
    });

    it('should use EASING_ACCELERATE when closing', async () => {
      const { rerender, container } = render(
        <NotesPanel isOpen={true}  />
      );

      const panel = container.querySelector('[data-testid="notes-panel"]');

      // Rerender with isOpen=false to trigger close animation
      rerender(<NotesPanel isOpen={false}  />);

      // When closing, should use accelerate easing
      await waitFor(() => {
        expect(panel.style.transition).toContain('cubic-bezier(0.4, 0.0, 1, 1)');
      });
    });

    it('should have 320px width on desktop', async () => {
      const { container } = render(
        <NotesPanel isOpen={true}  />
      );

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const panel = container.querySelector('[data-testid="notes-panel"]');
      expect(panel.style.width).toBe('320px');
    });

    it('should have no backdrop (canvas stays interactive)', async () => {
      const { container } = render(
        <NotesPanel isOpen={true}  />
      );

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      // Should not have backdrop element
      const backdrop = container.querySelector('[data-testid="backdrop"]');
      expect(backdrop).toBeNull();
    });
  });

  describe('T3.3: Text is editable (simple textarea model)', () => {
    it('should display bullet markers (•) for each line', async () => {
      render(<NotesPanel isOpen={true}  />);

      await waitFor(() => {
        // Bullet markers should be rendered (2 bullets = 2 markers)
        const bullets = screen.getAllByText('•');
        expect(bullets.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should render single textarea for all notes', async () => {
      render(<NotesPanel isOpen={true}  />);

      await waitFor(() => {
        const textareas = screen.getAllByRole('textbox');
        expect(textareas).toHaveLength(1);
      });
    });

    it('should allow editing notes text', async () => {
      render(<NotesPanel isOpen={true}  />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const textarea = screen.getByLabelText(/notes text editor/i);

      await user.clear(textarea);
      await user.type(textarea, 'New note text');

      expect(textarea.value).toBe('New note text');
    });

    it('should allow adding new lines with Enter', async () => {
      render(<NotesPanel isOpen={true}  />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const textarea = screen.getByLabelText(/notes text editor/i);

      await user.clear(textarea);
      await user.type(textarea, 'Line 1{Enter}Line 2{Enter}Line 3');

      expect(textarea.value).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should allow deleting lines', async () => {
      render(<NotesPanel isOpen={true}  />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const textarea = screen.getByLabelText(/notes text editor/i);

      await user.clear(textarea);
      await user.type(textarea, 'Just one line');

      expect(textarea.value).toBe('Just one line');
    });
  });

  describe('T3.4: Edit triggers updateNotes() API call', () => {
    it('should call updateNotes when text is edited (debounced)', async () => {
      render(<NotesPanel isOpen={true}  />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const textarea = screen.getByLabelText(/notes text editor/i);

      await user.clear(textarea);
      await user.type(textarea, 'Updated note');

      // Wait for debounce (500ms + buffer)
      await waitFor(() => {
        expect(api.updateNotes).toHaveBeenCalled();
      }, { timeout: 2000 });
    });

    it('should send bullets array (split by newline) to API', async () => {
      render(<NotesPanel isOpen={true}  />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const textarea = screen.getByLabelText(/notes text editor/i);

      await user.clear(textarea);
      await user.type(textarea, 'Bullet 1{Enter}Bullet 2{Enter}Bullet 3');

      // Wait for debounce and check the call
      await waitFor(() => {
        expect(api.updateNotes).toHaveBeenCalledWith(['Bullet 1', 'Bullet 2', 'Bullet 3']);
      }, { timeout: 2000 });
    });
  });

  describe('T3.5: Panel header', () => {
    it('should display title in header', async () => {
      render(<NotesPanel isOpen={true} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      expect(screen.getByText(/notes & ideas/i)).toBeInTheDocument();
    });

    it('should not have close button (toggle button handles this)', async () => {
      render(<NotesPanel isOpen={true} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      // Should not find close button
      const closeButton = screen.queryByLabelText(/close notes panel/i);
      expect(closeButton).toBeNull();
    });
  });

  describe('Additional UI Requirements', () => {
    it('should display header with title', async () => {
      render(<NotesPanel isOpen={true}  />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      expect(screen.getByText(/notes & ideas/i)).toBeInTheDocument();
    });

    it('should use COLOR_DEEP_PURPLE background with 98% opacity', async () => {
      const { container } = render(
        <NotesPanel isOpen={true}  />
      );

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const panel = container.querySelector('[data-testid="notes-panel"]');
      expect(panel.style.backgroundColor).toContain('rgba(26, 25, 43, 0.98)');
    });

    it('should have right border with indigo color', async () => {
      const { container } = render(
        <NotesPanel isOpen={true}  />
      );

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const panel = container.querySelector('[data-testid="notes-panel"]');
      expect(panel.style.borderRight).toContain('#6366f1');
    });

    it('should have scrollable notes area', async () => {
      render(<NotesPanel isOpen={true}  />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const notesContainer = screen.getByTestId('notes-container');
      expect(notesContainer).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle loadNotes error gracefully', async () => {
      api.loadNotes.mockRejectedValue(new Error('Load failed'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<NotesPanel isOpen={true}  />);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      });

      // Wait for loading to finish
      await waitFor(() => {
        const textarea = screen.queryByLabelText(/notes text editor/i);
        expect(textarea).toBeInTheDocument();
      });

      // Panel should still render (with empty state)
      const textarea = screen.getByLabelText(/notes text editor/i);
      expect(textarea.value).toBe('');

      consoleErrorSpy.mockRestore();
    });

    it('should handle updateNotes error gracefully', async () => {
      api.updateNotes.mockRejectedValue(new Error('Update failed'));

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      render(<NotesPanel isOpen={true}  />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const textarea = screen.getByLabelText(/notes text editor/i);
      await user.type(textarea, 'x');

      // Wait for debounce and error
      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
      }, { timeout: 2000 });

      consoleErrorSpy.mockRestore();
    });
  });
});
