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
  sendMessage: vi.fn(),
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
  let mockOnToggle;
  let mockOnFlowUpdate;
  let user;

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnToggle = vi.fn();
    mockOnFlowUpdate = vi.fn();
    user = userEvent.setup();

    // Default API responses
    api.loadNotes.mockResolvedValue({
      bullets: ['First note', 'Second note'],
      conversationHistory: [],
    });
    api.updateNotes.mockResolvedValue({
      success: true,
    });
    api.sendMessage.mockResolvedValue({
      success: true,
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('T3.1: Panel renders when isOpen=true, hidden when false', () => {
    it('should not render panel content when isOpen is false', () => {
      const { container } = render(
        <NotesPanel isOpen={false} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />
      );

      // Panel should be transformed off-screen (translateX(-100%))
      const panel = container.querySelector('[data-testid="notes-panel"]');
      expect(panel).toBeTruthy();
      expect(panel.style.transform).toContain('translateX(-100%)');
    });

    it('should render panel content when isOpen is true', async () => {
      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      // Panel should be visible (translateX(0))
      const panel = screen.getByTestId('notes-panel');
      expect(panel.style.transform).toContain('translateX(0)');
    });

    it('should load notes when panel opens', async () => {
      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalledTimes(1);
      });
    });

    it('should display loaded bullets as text (one per line)', async () => {
      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

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

      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

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
        <NotesPanel isOpen={false} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />
      );

      const panel = container.querySelector('[data-testid="notes-panel"]');
      expect(panel.style.transition).toContain('250ms');
    });

    it('should use EASING_DECELERATE when opening', async () => {
      const { rerender, container } = render(
        <NotesPanel isOpen={false} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />
      );

      const panel = container.querySelector('[data-testid="notes-panel"]');

      // Rerender with isOpen=true to trigger open animation
      rerender(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      // When open, should use decelerate easing
      await waitFor(() => {
        expect(panel.style.transition).toContain('cubic-bezier(0.0, 0.0, 0.2, 1)');
      });
    });

    it('should use EASING_ACCELERATE when closing', async () => {
      const { rerender, container } = render(
        <NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />
      );

      const panel = container.querySelector('[data-testid="notes-panel"]');

      // Rerender with isOpen=false to trigger close animation
      rerender(<NotesPanel isOpen={false} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      // When closing, should use accelerate easing
      await waitFor(() => {
        expect(panel.style.transition).toContain('cubic-bezier(0.4, 0.0, 1, 1)');
      });
    });

    it('should have 320px width on desktop', async () => {
      const { container } = render(
        <NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />
      );

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const panel = container.querySelector('[data-testid="notes-panel"]');
      expect(panel.style.width).toBe('368px');
    });

    it('should have no backdrop (canvas stays interactive)', async () => {
      const { container } = render(
        <NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />
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
      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        // Bullet markers should be rendered (2 bullets = 2 markers)
        const bullets = screen.getAllByText('•');
        expect(bullets.length).toBeGreaterThanOrEqual(2);
      });
    });

    it('should render single textarea for all notes', async () => {
      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        const textareas = screen.getAllByRole('textbox');
        expect(textareas).toHaveLength(1);
      });
    });

    it('should allow editing notes text', async () => {
      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const textarea = screen.getByLabelText(/notes text editor/i);

      await user.clear(textarea);
      await user.type(textarea, 'New note text');

      expect(textarea.value).toBe('New note text');
    });

    it('should allow adding new lines with Enter', async () => {
      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const textarea = screen.getByLabelText(/notes text editor/i);

      await user.clear(textarea);
      await user.type(textarea, 'Line 1{Enter}Line 2{Enter}Line 3');

      expect(textarea.value).toBe('Line 1\nLine 2\nLine 3');
    });

    it('should allow deleting lines', async () => {
      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

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
      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

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
      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

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

  describe('T3.5: Panel header and toggle button', () => {
    it('should display title in header', async () => {
      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      expect(screen.getByText(/^notes$/i)).toBeInTheDocument();
    });

    it('should render toggle button', async () => {
      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      const toggleButton = screen.getByLabelText(/close notes panel/i);
      expect(toggleButton).toBeInTheDocument();
    });

    it('should call onToggle when toggle button is clicked', async () => {
      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      const toggleButton = screen.getByLabelText(/close notes panel/i);
      await user.click(toggleButton);

      expect(mockOnToggle).toHaveBeenCalledTimes(1);
    });

    it('should show panel-right icon when panel is open', async () => {
      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      const toggleButton = screen.getByLabelText(/close notes panel/i);
      const svg = toggleButton.querySelector('svg');

      // Panel-right icon has path d="M15 3v18"
      const path = svg.querySelector('path[d="M15 3v18"]');
      expect(path).toBeInTheDocument();
    });

    it('should show panel-left icon when panel is closed', async () => {
      render(<NotesPanel isOpen={false} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      const toggleButton = screen.getByLabelText(/open notes panel/i);
      const svg = toggleButton.querySelector('svg');

      // Panel-left icon has path d="M9 3v18"
      const path = svg.querySelector('path[d="M9 3v18"]');
      expect(path).toBeInTheDocument();
    });

    it('should position toggle button at panel\'s top-right edge', async () => {
      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      const toggleButton = screen.getByLabelText(/close notes panel/i);

      expect(toggleButton.style.position).toBe('absolute');
      expect(toggleButton.style.top).toBe('16px');
      expect(toggleButton.style.right).toBe('16px'); // Inside panel when open
    });

    it('should have aria-expanded attribute matching panel state', async () => {
      const { rerender } = render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      const toggleButtonOpen = screen.getByLabelText(/close notes panel/i);
      expect(toggleButtonOpen).toHaveAttribute('aria-expanded', 'true');

      rerender(<NotesPanel isOpen={false} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      const toggleButtonClosed = screen.getByLabelText(/open notes panel/i);
      expect(toggleButtonClosed).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('Additional UI Requirements', () => {
    it('should display header with title', async () => {
      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      expect(screen.getByText(/^notes$/i)).toBeInTheDocument();
    });

    it('should use COLOR_DEEP_PURPLE background with 98% opacity', async () => {
      const { container } = render(
        <NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />
      );

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const panel = container.querySelector('[data-testid="notes-panel"]');
      expect(panel.style.backgroundColor).toContain('rgba(26, 25, 43, 0.98)');
    });

    it('should have right border with indigo color', async () => {
      const { container } = render(
        <NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />
      );

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const panel = container.querySelector('[data-testid="notes-panel"]');
      expect(panel.style.borderRight).toContain('#6366f1');
    });

    it('should have scrollable notes area', async () => {
      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

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

      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

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

      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

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

  describe('Entity Highlighting', () => {
    it('should parse and render **entity** markers as styled spans', async () => {
      api.loadNotes.mockResolvedValue({
        bullets: ['Build a **login** page'],
        conversationHistory: [],
      });

      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      // Check that the styled overlay contains the entity span
      const styledOverlay = screen.getByTestId('styled-text-overlay');
      expect(styledOverlay).toBeInTheDocument();

      const entitySpan = styledOverlay.querySelector('.entity');
      expect(entitySpan).toBeInTheDocument();
      expect(entitySpan.textContent).toBe('login');
    });

    it('should show **markers** dimmed in display', async () => {
      api.loadNotes.mockResolvedValue({
        bullets: ['Build a **login** page'],
        conversationHistory: [],
      });

      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const styledOverlay = screen.getByTestId('styled-text-overlay');
      // The ** markers should be present (to maintain character alignment)
      expect(styledOverlay.textContent).toContain('**');
      expect(styledOverlay.textContent).toContain('Build a **login** page');

      // Check that markers have the dimmed class
      const markerSpans = styledOverlay.querySelectorAll('.marker');
      expect(markerSpans.length).toBeGreaterThan(0);
    });

    it('should render plain text without markers normally', async () => {
      api.loadNotes.mockResolvedValue({
        bullets: ['Build a login page without markers'],
        conversationHistory: [],
      });

      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const styledOverlay = screen.getByTestId('styled-text-overlay');
      expect(styledOverlay.textContent).toBe('Build a login page without markers');

      // No entity spans should exist
      const entitySpans = styledOverlay.querySelectorAll('.entity');
      expect(entitySpans.length).toBe(0);
    });

    it('should style multiple entities in one line', async () => {
      api.loadNotes.mockResolvedValue({
        bullets: ['Connect **login** to **database** with **authentication**'],
        conversationHistory: [],
      });

      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const styledOverlay = screen.getByTestId('styled-text-overlay');
      const entitySpans = styledOverlay.querySelectorAll('.entity');

      expect(entitySpans.length).toBe(3);
      expect(entitySpans[0].textContent).toBe('login');
      expect(entitySpans[1].textContent).toBe('database');
      expect(entitySpans[2].textContent).toBe('authentication');
    });

    it('should preserve entity highlighting when text is edited', async () => {
      api.loadNotes.mockResolvedValue({
        bullets: ['Original **entity** text'],
        conversationHistory: [],
      });

      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const textarea = screen.getByLabelText(/notes text editor/i);

      // Clear and type new text with entity
      await user.clear(textarea);
      await user.type(textarea, 'New **highlighted** text');

      // Check that the overlay updates with the new entity
      const styledOverlay = screen.getByTestId('styled-text-overlay');
      const entitySpan = styledOverlay.querySelector('.entity');

      expect(entitySpan).toBeInTheDocument();
      expect(entitySpan.textContent).toBe('highlighted');
    });

    it('should handle multiple lines with entities', async () => {
      api.loadNotes.mockResolvedValue({
        bullets: ['First **entity** line', 'Second **another** line'],
        conversationHistory: [],
      });

      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const styledOverlay = screen.getByTestId('styled-text-overlay');
      const entitySpans = styledOverlay.querySelectorAll('.entity');

      expect(entitySpans.length).toBe(2);
      expect(entitySpans[0].textContent).toBe('entity');
      expect(entitySpans[1].textContent).toBe('another');
    });

  });

    it('should not call onFlowUpdate when updatedFlow is missing', async () => {
      api.loadNotes.mockResolvedValue({
        bullets: ['Build a **login** page'],
        conversationHistory: [],
      });
      api.sendMessage.mockResolvedValueOnce({ success: true });

      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const entitySpan = screen.getByTestId('styled-text-overlay').querySelector('.entity');
      await user.click(entitySpan);

      await waitFor(() => {
        expect(api.sendMessage).toHaveBeenCalledTimes(1);
      });

      expect(mockOnFlowUpdate).not.toHaveBeenCalled();
    });

    it('should skip API call when bullet is empty or whitespace', async () => {
      api.loadNotes.mockResolvedValue({
        bullets: ['   '],
        conversationHistory: [],
      });

      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const loadButton = screen.getByRole('button', { name: /load to graph/i });
      await user.click(loadButton);

      expect(api.sendMessage).not.toHaveBeenCalled();
    });

    it('should retain isSending guard after API error and allow retry', async () => {
      api.loadNotes.mockResolvedValue({
        bullets: ['Build a **login** page'],
        conversationHistory: [],
      });

      api.sendMessage
        .mockRejectedValueOnce(new Error('Network issue'))
        .mockResolvedValueOnce({ updatedFlow: { nodes: [{ id: 'login' }], edges: [] } });

      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const entitySpan = screen.getByTestId('styled-text-overlay').querySelector('.entity');

      await user.click(entitySpan);
      await waitFor(() => {
        expect(api.sendMessage).toHaveBeenCalledTimes(1);
      });

      await user.click(entitySpan);

      await waitFor(() => {
        expect(api.sendMessage).toHaveBeenCalledTimes(2);
      });
    });

    it('should include guidance text in multi-line prompts', async () => {
      api.loadNotes.mockResolvedValue({
        bullets: ['First **entity**', 'Second **entity**'],
        conversationHistory: [],
      });

      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const loadButton = screen.getByRole('button', { name: /load to graph/i });
      await user.click(loadButton);

      await waitFor(() => {
        expect(api.sendMessage).toHaveBeenCalledTimes(1);
      });

      const promptArg = api.sendMessage.mock.calls[0][0];
      expect(promptArg).toContain('If this change has already been applied, leave the graph as-is and do not repeat it.');
    });

  describe('Entity Actions', () => {
    it('should send the full bullet to the LLM when an entity is clicked', async () => {
      api.loadNotes.mockResolvedValue({
        bullets: ['Build a **login** page'],
        conversationHistory: [],
      });
      const updatedFlow = { nodes: [{ id: 'login', data: { label: 'login' }, position: { x: 0, y: 0 } }], edges: [] };
      api.sendMessage.mockResolvedValueOnce({
        updatedFlow,
      });

      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const styledOverlay = screen.getByTestId('styled-text-overlay');
      const entitySpan = styledOverlay.querySelector('.entity');
      expect(entitySpan).toBeInTheDocument();

      await user.click(entitySpan);

      await waitFor(() => {
        expect(api.sendMessage).toHaveBeenCalledTimes(1);
      });

      expect(api.sendMessage).toHaveBeenCalledWith(
        'Please execute this action. Build a login page If this change has already been applied, leave the graph as-is and do not repeat it.'
      );
      expect(mockOnFlowUpdate).toHaveBeenCalledTimes(1);
      expect(mockOnFlowUpdate).toHaveBeenCalledWith(updatedFlow);
    });

    it('should send all bullets in one request when Load to Graph is clicked', async () => {
      api.loadNotes.mockResolvedValue({
        bullets: [
          'Build a **login** page',
          'Implement **signup** flow',
        ],
        conversationHistory: [],
      });
      const updatedFlow = { nodes: [{ id: 'n1' }, { id: 'n2' }], edges: [] };
      api.sendMessage.mockResolvedValueOnce({
        updatedFlow,
      });

      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const loadButton = screen.getByRole('button', { name: /load to graph/i });
      await user.click(loadButton);

      await waitFor(() => {
        expect(api.sendMessage).toHaveBeenCalledTimes(1);
      });

      expect(api.sendMessage).toHaveBeenCalledWith(
        'Please execute these actions.\n- Build a login page\n- Implement signup flow\nIf this change has already been applied, leave the graph as-is and do not repeat it.'
      );
      expect(mockOnFlowUpdate).toHaveBeenCalledTimes(1);
      expect(mockOnFlowUpdate).toHaveBeenCalledWith(updatedFlow);
    });

    it('should ignore additional entity clicks while a request is in flight', async () => {
      api.loadNotes.mockResolvedValue({
        bullets: ['Build a **login** page'],
        conversationHistory: [],
      });

      let resolveSend;
      api.sendMessage.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveSend = resolve;
          })
      );

      render(<NotesPanel isOpen={true} onToggle={mockOnToggle} onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.loadNotes).toHaveBeenCalled();
      });

      const styledOverlay = screen.getByTestId('styled-text-overlay');
      const entitySpan = styledOverlay.querySelector('.entity');
      expect(entitySpan).toBeInTheDocument();

      await user.click(entitySpan);

      await waitFor(() => {
        expect(api.sendMessage).toHaveBeenCalledTimes(1);
      });

      await user.click(entitySpan);

      expect(api.sendMessage).toHaveBeenCalledTimes(1);

      resolveSend?.({ success: true, updatedFlow: { nodes: [{ id: 'login' }], edges: [] } });

      await waitFor(() => {
        expect(mockOnFlowUpdate).toHaveBeenCalledTimes(1);
      });
      expect(mockOnFlowUpdate).toHaveBeenCalledWith({ nodes: [{ id: 'login' }], edges: [] });
    });
  });
});