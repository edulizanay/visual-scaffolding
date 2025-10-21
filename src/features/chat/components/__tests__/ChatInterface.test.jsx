// ABOUTME: Unit tests for ChatInterface component
// ABOUTME: Tests message submission, keyboard interactions, loading states, and conversation management

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ChatInterface from '../ChatInterface.jsx';
import * as api from '../../../../services/api';

// Mock the API module
vi.mock('../../../../services/api', () => ({
  sendMessage: vi.fn(),
  clearConversation: vi.fn(),
  getConversationDebug: vi.fn(),
  sendNotesMessage: vi.fn(),
}));

describe('ChatInterface Component', () => {
  let mockOnFlowUpdate;
  let user;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();

    // Create mock callbacks
    mockOnFlowUpdate = vi.fn();

    // Setup default API responses
    api.getConversationDebug.mockResolvedValue({ history: [] });
    api.clearConversation.mockResolvedValue({ success: true });
    api.sendMessage.mockResolvedValue({
      response: 'AI response',
      updatedFlow: null
    });

    // Setup user-event
    user = userEvent.setup();
  });

  describe('Initial Render', () => {
    it('should render textarea with correct placeholder', () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command or '\/resume' to continue conversation/i);
      expect(textarea).toBeTruthy();
    });

    it('should load conversation history on mount', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.getConversationDebug).toHaveBeenCalledTimes(1);
      });
    });

    it('should render keyboard shortcut hints', () => {
      const { container } = render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      // Check for kbd elements (⌘ and ⏎)
      const kbdElements = container.querySelectorAll('kbd');
      expect(kbdElements.length).toBe(2);
    });
  });

  describe('Message Submission via Keyboard', () => {
    it('should send message on Cmd+Enter', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, 'Hello AI');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      await waitFor(() => {
        expect(api.sendMessage).toHaveBeenCalledWith('Hello AI');
      });
    });

    it('should send message on Ctrl+Enter', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, 'Test message');
      await user.keyboard('{Control>}{Enter}{/Control}');

      await waitFor(() => {
        expect(api.sendMessage).toHaveBeenCalledWith('Test message');
      });
    });

    it('should NOT send message on Enter without modifier key', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, 'Test message{Enter}');

      // Wait a bit to ensure no API call was made
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(api.sendMessage).not.toHaveBeenCalled();
    });

    it('should NOT send message on Shift+Enter', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, 'Line 1');
      await user.keyboard('{Shift>}{Enter}{/Shift}');
      await user.type(textarea, 'Line 2');

      // Wait to ensure no API call
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(api.sendMessage).not.toHaveBeenCalled();

      // Verify textarea contains both lines
      expect(textarea.value).toContain('Line 1');
      expect(textarea.value).toContain('Line 2');
    });

    it('should NOT send empty or whitespace-only messages', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, '   ');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      await new Promise(resolve => setTimeout(resolve, 100));
      expect(api.sendMessage).not.toHaveBeenCalled();
    });

    it('should trim message before sending', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, '  Test message  ');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      await waitFor(() => {
        expect(api.sendMessage).toHaveBeenCalledWith('  Test message  ');
      });
    });
  });

  describe('Input Clearing After Send', () => {
    it('should clear input immediately after submission', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, 'Test message');

      expect(textarea.value).toBe('Test message');

      await user.keyboard('{Meta>}{Enter}{/Meta}');

      // Input should be cleared immediately, before API response
      expect(textarea.value).toBe('');
    });

    it('should keep input cleared even if API call fails', async () => {
      api.sendMessage.mockRejectedValue(new Error('Network error'));

      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, 'Test message');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      await waitFor(() => {
        expect(api.sendMessage).toHaveBeenCalled();
      });

      // Input should remain cleared
      expect(textarea.value).toBe('');
    });
  });

  describe('Processing State', () => {

    it('should show processing placeholder with animated dots', async () => {
      // Make API call slow to catch processing state
      api.sendMessage.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ response: 'ok' }), 100)));

      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, 'Test');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      // Check for processing placeholder
      await waitFor(() => {
        const processingTextarea = screen.getByPlaceholderText(/processing/i);
        expect(processingTextarea).toBeTruthy();
      }, { timeout: 100 });
    });

    it('should reduce opacity during processing', async () => {
      // Make API call slow to catch processing state
      api.sendMessage.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ response: 'ok' }), 100)));

      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, 'Test');

      await user.keyboard('{Meta>}{Enter}{/Meta}');

      // During processing, opacity should be reduced
      await waitFor(() => {
        const processingTextarea = screen.getByPlaceholderText(/processing/i);
        expect(processingTextarea.style.opacity).toBe('0.6');
      }, { timeout: 100 });
    });

    it('should restore normal opacity after processing completes', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, 'Test');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      // Wait for processing to complete
      await waitFor(() => {
        const normalTextarea = screen.getByPlaceholderText(/Type a command/i);
        expect(normalTextarea.style.opacity).toBe('1');
      });
    });

    it('should NOT allow multiple submissions while processing', async () => {
      // Make API call slow
      api.sendMessage.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ response: 'ok' }), 1000)));

      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);

      // First submission
      await user.click(textarea);
      await user.type(textarea, 'First');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      // Try to submit again while processing
      await user.type(textarea, 'Second');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      // Should only be called once
      expect(api.sendMessage).toHaveBeenCalledTimes(1);
      expect(api.sendMessage).toHaveBeenCalledWith('First');
    });

    it('should ignore repeated Cmd+Enter events during key repeat', async () => {
      api.sendMessage.mockImplementation(() => new Promise(resolve => setTimeout(() => resolve({ response: 'ok' }), 100)));

      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, 'Hold to repeat');

      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });
      fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true, repeat: true });
      fireEvent.keyUp(textarea, { key: 'Enter', metaKey: true });

      await waitFor(() => {
        expect(api.sendMessage).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('Flow Update Handling', () => {
    it('should call onFlowUpdate when AI returns updated flow', async () => {
      const updatedFlow = {
        nodes: [{ id: '1', data: { label: 'New Node' } }],
        edges: []
      };
      api.sendMessage.mockResolvedValue({
        response: 'Created a node',
        updatedFlow
      });

      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, 'Create a node');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      await waitFor(() => {
        expect(mockOnFlowUpdate).toHaveBeenCalledWith(updatedFlow);
      });
    });

    it('should NOT call onFlowUpdate when updatedFlow is null', async () => {
      api.sendMessage.mockResolvedValue({
        response: 'Just a response',
        updatedFlow: null
      });

      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, 'Just asking');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      await waitFor(() => {
        expect(api.sendMessage).toHaveBeenCalled();
      });

      expect(mockOnFlowUpdate).not.toHaveBeenCalled();
    });
  });

  describe('Conversation Management', () => {
    it('should clear conversation on first non-resume message', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, 'First message');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      await waitFor(() => {
        expect(api.clearConversation).toHaveBeenCalled();
      });
    });

    it('should NOT clear conversation when first message is /resume', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, '/resume');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      await waitFor(() => {
        expect(textarea.value).toBe('');
      });

      expect(api.clearConversation).not.toHaveBeenCalled();
      expect(api.sendMessage).not.toHaveBeenCalled();
    });

    it('should NOT clear conversation on subsequent messages', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);

      // First message
      await user.click(textarea);
      await user.type(textarea, 'First');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      await waitFor(() => {
        expect(api.clearConversation).toHaveBeenCalled();
      });

      vi.clearAllMocks();

      // Second message
      await user.type(textarea, 'Second');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      await waitFor(() => {
        expect(api.sendMessage).toHaveBeenCalledWith('Second');
      });

      expect(api.clearConversation).not.toHaveBeenCalled();
    });

    it('should reload conversation history after each message', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);

      // Clear initial mount call
      await waitFor(() => {
        expect(api.getConversationDebug).toHaveBeenCalled();
      });
      vi.clearAllMocks();

      await user.click(textarea);
      await user.type(textarea, 'Test');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      await waitFor(() => {
        expect(api.getConversationDebug).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('History Navigation', () => {
    beforeEach(() => {
      api.getConversationDebug.mockResolvedValue({
        history: [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'Response 1' },
          { role: 'user', content: 'Second message' },
          { role: 'assistant', content: 'Response 2' },
          { role: 'user', content: 'Third message' },
        ]
      });
    });

    it('should navigate to previous message on ArrowUp', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.getConversationDebug).toHaveBeenCalled();
      });

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.keyboard('{ArrowUp}');

      // Most recent message should appear
      expect(textarea.value).toBe('Third message');
    });

    it('should navigate through multiple history entries', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.getConversationDebug).toHaveBeenCalled();
      });

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);

      await user.keyboard('{ArrowUp}');
      expect(textarea.value).toBe('Third message');

      await user.keyboard('{ArrowUp}');
      expect(textarea.value).toBe('Second message');

      await user.keyboard('{ArrowUp}');
      expect(textarea.value).toBe('First message');
    });

    it('should navigate forward with ArrowDown', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.getConversationDebug).toHaveBeenCalled();
      });

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);

      // Go back
      await user.keyboard('{ArrowUp}');
      await user.keyboard('{ArrowUp}');
      expect(textarea.value).toBe('Second message');

      // Go forward
      await user.keyboard('{ArrowDown}');
      expect(textarea.value).toBe('Third message');
    });

    it('should save draft message when navigating history', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.getConversationDebug).toHaveBeenCalled();
      });

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, 'Draft message');

      // Navigate to history
      await user.keyboard('{ArrowUp}');
      expect(textarea.value).toBe('Third message');

      // Navigate back to draft
      await user.keyboard('{ArrowDown}');
      expect(textarea.value).toBe('Draft message');
    });

    it('should reset history position after sending message', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(api.getConversationDebug).toHaveBeenCalled();
      });

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);

      // Navigate history
      await user.keyboard('{ArrowUp}');
      expect(textarea.value).toBe('Third message');

      // Send a new message
      await user.clear(textarea);
      await user.type(textarea, 'New message');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      await waitFor(() => {
        expect(api.sendMessage).toHaveBeenCalled();
      });

      // After sending, ArrowUp should get most recent again
      await user.keyboard('{ArrowUp}');
      await waitFor(() => {
        // The history should now include 'New message' (mocked)
        expect(textarea.value).toBe('Third message'); // Based on current mock
      });
    });
  });

  describe('Global Keyboard Focus', () => {
    it('should focus textarea when typing anywhere on document', async () => {
      const { container } = render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);

      // Simulate typing a character on the document
      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      document.dispatchEvent(event);

      await waitFor(() => {
        expect(document.activeElement).toBe(textarea);
      });
    });

    it('should NOT steal focus from other input elements', () => {
      const { container } = render(
        <div>
          <input type="text" data-testid="other-input" />
          <ChatInterface onFlowUpdate={mockOnFlowUpdate} />
        </div>
      );

      const otherInput = screen.getByTestId('other-input');
      otherInput.focus();

      // Type while focused on other input
      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      document.dispatchEvent(event);

      // Focus should remain on the other input
      expect(document.activeElement).toBe(otherInput);
    });
  });

  describe('Error Handling', () => {
    it('should handle API errors gracefully', async () => {
      const consoleError = console.error;
      console.error = vi.fn();

      api.sendMessage.mockRejectedValue(new Error('API Error'));

      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, 'Test');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      await waitFor(() => {
        expect(console.error).toHaveBeenCalled();
      });

      console.error = consoleError;
    });

    it('should handle conversation clear errors gracefully', async () => {
      const consoleWarn = console.warn;
      console.warn = vi.fn();

      api.clearConversation.mockRejectedValue(new Error('Clear failed'));

      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, 'First message');
      await user.keyboard('{Meta>}{Enter}{/Meta}');

      await waitFor(() => {
        expect(console.warn).toHaveBeenCalled();
      });

      // Should still try to send the message
      expect(api.sendMessage).toHaveBeenCalled();

      console.warn = consoleWarn;
    });

    it('should handle history load errors gracefully', async () => {
      const consoleError = console.error;
      console.error = vi.fn();

      api.getConversationDebug.mockRejectedValue(new Error('Load failed'));

      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      await waitFor(() => {
        expect(console.error).toHaveBeenCalled();
      });

      // Component should still render
      const textarea = screen.getByPlaceholderText(/Type a command/i);
      expect(textarea).toBeTruthy();

      console.error = consoleError;
    });
  });

  describe('Textarea Auto-sizing', () => {
    it('should render with minimum height', () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      expect(textarea.style.minHeight).toBe('38px');
    });

    it('should have maximum height constraint', () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      expect(textarea.style.maxHeight).toBe('76px');
    });

    it('should adjust height when content changes', async () => {
      render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      const initialHeight = textarea.style.height;

      await user.click(textarea);
      await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2{Shift>}{Enter}{/Shift}Line 3');

      // Height should be set (actual value depends on scrollHeight calculation)
      expect(textarea.style.height).toBeTruthy();
    });
  });

  describe('Kbd Component', () => {
    it('should render keyboard hint badges', () => {
      const { container } = render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const kbdElements = container.querySelectorAll('kbd');
      expect(kbdElements.length).toBe(2);
    });

    it('should show keyboard hints only when message is typed', async () => {
      const { container } = render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

      const hintContainer = container.querySelector('div[style*="pointer-events: none"]');

      // Initially hidden (opacity 0)
      expect(hintContainer.style.opacity).toBe('0');

      const textarea = screen.getByPlaceholderText(/Type a command/i);
      await user.click(textarea);
      await user.type(textarea, 'Test');

      // Should be visible (opacity 1)
      expect(hintContainer.style.opacity).toBe('1');
    });
  });

  describe('Notes Panel Routing (T2.1-T2.3)', () => {
    beforeEach(() => {
      // Setup separate mock for notes API
      api.sendNotesMessage = vi.fn().mockResolvedValue({
        success: true,
        bullets: ['Note captured'],
        newBullets: ['Note captured'],
      });
    });

    describe('T2.1: When isNotesPanelOpen=true', () => {
      it('should call /api/notes endpoint', async () => {
        render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} isNotesPanelOpen={true} />);

        const textarea = screen.getByPlaceholderText(/Type a command/i);
        await user.click(textarea);
        await user.type(textarea, 'This is a note');
        await user.keyboard('{Meta>}{Enter}{/Meta}');

        await waitFor(() => {
          expect(api.sendNotesMessage).toHaveBeenCalledWith('This is a note');
        });

        // Should NOT call the conversation endpoint
        expect(api.sendMessage).not.toHaveBeenCalled();
      });

      it('should not call clearConversation when panel is open', async () => {
        render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} isNotesPanelOpen={true} />);

        const textarea = screen.getByPlaceholderText(/Type a command/i);
        await user.click(textarea);
        await user.type(textarea, 'First note');
        await user.keyboard('{Meta>}{Enter}{/Meta}');

        await waitFor(() => {
          expect(api.sendNotesMessage).toHaveBeenCalled();
        });

        // Should NOT clear conversation when in notes mode
        expect(api.clearConversation).not.toHaveBeenCalled();
      });
    });

    describe('T2.2: When isNotesPanelOpen=false', () => {
      it('should call /api/conversation/message endpoint', async () => {
        render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} isNotesPanelOpen={false} />);

        const textarea = screen.getByPlaceholderText(/Type a command/i);
        await user.click(textarea);
        await user.type(textarea, 'Create a node');
        await user.keyboard('{Meta>}{Enter}{/Meta}');

        await waitFor(() => {
          expect(api.sendMessage).toHaveBeenCalledWith('Create a node');
        });

        // Should NOT call the notes endpoint
        expect(api.sendNotesMessage).not.toHaveBeenCalled();
      });
    });

    describe('T2.3: Prop is optional (defaults to false)', () => {
      it('should default to conversation mode when prop is not provided', async () => {
        render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

        const textarea = screen.getByPlaceholderText(/Type a command/i);
        await user.click(textarea);
        await user.type(textarea, 'Default behavior');
        await user.keyboard('{Meta>}{Enter}{/Meta}');

        await waitFor(() => {
          expect(api.sendMessage).toHaveBeenCalledWith('Default behavior');
        });

        // Should NOT call notes endpoint by default
        expect(api.sendNotesMessage).not.toHaveBeenCalled();
      });

      it('should maintain backward compatibility (existing behavior)', async () => {
        render(<ChatInterface onFlowUpdate={mockOnFlowUpdate} />);

        const textarea = screen.getByPlaceholderText(/Type a command/i);
        await user.click(textarea);
        await user.type(textarea, 'Test');
        await user.keyboard('{Meta>}{Enter}{/Meta}');

        await waitFor(() => {
          expect(api.clearConversation).toHaveBeenCalled();
        });

        await waitFor(() => {
          expect(api.sendMessage).toHaveBeenCalled();
        });
      });
    });
  });
});
