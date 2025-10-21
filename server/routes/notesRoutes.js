// ABOUTME: Notes domain routes - handles note-taking with LLM assistance
// ABOUTME: Manages notes CRUD, bullet extraction, and conversation history
import { Router } from 'express';
import { getNotes, saveNotes, updateBullets } from '../repositories/notesRepository.js';
import { buildNotesContext, callNotesLLM } from '../llm/llmService.js';
import { checkLLMAvailability, logError } from '../llm/llmUtils.js';

const router = Router();

export function registerNotesRoutes(router) {
  router.get('/', async (req, res) => {
    try {
      const notes = await getNotes();
      res.json(notes);
    } catch (error) {
      logError('loading notes', error);
      res.status(500).json({ error: 'Failed to load notes' });
    }
  });

  router.post('/', async (req, res) => {
    try {
      const { message } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Message is required and must be a string'
        });
      }

      if (!checkLLMAvailability()) {
        return res.json({
          success: false,
          error: 'LLM is not configured. Provide GROQ_API_KEY or CEREBRAS_API_KEY to enable notes.',
          bullets: [],
          newBullets: []
        });
      }

      // Load current notes
      const currentNotes = await getNotes();
      const currentBullets = currentNotes.bullets;
      const conversationHistory = currentNotes.conversationHistory || [];

      // Build context and call LLM (now with conversation history!)
      const notesContext = await buildNotesContext(currentBullets, message, conversationHistory);
      const parsed = await callNotesLLM(notesContext);  // Already returns parsed result!

      if (parsed.parseError) {
        return res.json({
          success: false,
          error: parsed.parseError,
          thinking: parsed.thinking,
          bullets: currentBullets,
          newBullets: []
        });
      }

      // Combine existing bullets with new ones
      const newBullets = parsed.bullets;
      const allBullets = [...currentBullets, ...newBullets];

      // Save to conversation history
      const timestamp = new Date().toISOString();
      const updatedConversationHistory = [
        ...currentNotes.conversationHistory,
        {
          role: 'user',
          content: message,
          timestamp
        },
        {
          role: 'assistant',
          content: parsed.content,  // Use parsed.content instead of llmResponse
          timestamp
        }
      ];

      // Save notes
      await saveNotes(allBullets, updatedConversationHistory);

      res.json({
        success: true,
        bullets: allBullets,
        newBullets,
        thinking: parsed.thinking
      });

    } catch (error) {
      logError('processing notes message', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process notes message'
      });
    }
  });

  router.put('/', async (req, res) => {
    try {
      const { bullets } = req.body;

      if (!Array.isArray(bullets)) {
        return res.status(400).json({
          success: false,
          error: 'bullets array is required'
        });
      }

      // Update bullets only
      await updateBullets(bullets);

      res.json({
        success: true,
        bullets
      });

    } catch (error) {
      logError('updating notes', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update notes'
      });
    }
  });
}

export default router;
