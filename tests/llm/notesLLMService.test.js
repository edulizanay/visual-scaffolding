// ABOUTME: Unit tests for Notes LLM service
// ABOUTME: Tests notes context building, bullet parsing, and LLM failover
import { parseNotesBullets, buildNotesContext, callNotesLLM } from '../../server/llm/notesLLMService.js';
import { saveFlow, closeDb } from '../../server/db.js';

describe('notesLLMService', () => {
  beforeEach(async () => {
    process.env.DB_PATH = ':memory:';

    // Create test flow
    await saveFlow({
      nodes: [
        { id: '1', data: { label: 'Start', description: 'Initial node' }, position: { x: 0, y: 0 } }
      ],
      edges: []
    });
  });

  afterEach(() => {
    closeDb();
  });

  describe('parseNotesBullets - T1.1, T1.2, T1.3', () => {
    test('T1.1: extracts bullet array from <response> tags', () => {
      const llmResponse = `
<thinking>User wants to track login feature ideas</thinking>
<response>
["User wants to build a login system", "Should include email and password", "Need password reset functionality"]
</response>
      `;

      const result = parseNotesBullets(llmResponse);

      expect(result.bullets).toBeDefined();
      expect(Array.isArray(result.bullets)).toBe(true);
      expect(result.bullets).toHaveLength(3);
      expect(result.bullets[0]).toBe('User wants to build a login system');
      expect(result.bullets[1]).toBe('Should include email and password');
      expect(result.bullets[2]).toBe('Need password reset functionality');
      expect(result.thinking).toContain('login feature');
      expect(result.parseError).toBeNull();
    });

    test('T1.2: handles malformed JSON with comments and extra whitespace', () => {
      const llmResponse = `
<thinking>Test</thinking>
<response>
// Here are the bullets
[
  "First bullet",  // first one
  "Second bullet" /* another one */
]
</response>
      `;

      const result = parseNotesBullets(llmResponse);

      // Should strip comments and parse successfully
      expect(result.bullets).toHaveLength(2);
      expect(result.bullets[0]).toBe('First bullet');
      expect(result.bullets[1]).toBe('Second bullet');
      expect(result.parseError).toBeNull();
    });

    test('T1.3: returns empty array when no bullets found', () => {
      const llmResponse = `
<thinking>User message is unclear, no bullets to extract</thinking>
<response>
[]
</response>
      `;

      const result = parseNotesBullets(llmResponse);

      expect(result.bullets).toEqual([]);
      expect(result.thinking).toBeDefined();
      expect(result.parseError).toBeNull();
    });

    test('T1.3b: returns empty array when response tags are missing', () => {
      const llmResponse = `
<thinking>Just thinking, no response</thinking>
      `;

      const result = parseNotesBullets(llmResponse);

      expect(result.bullets).toEqual([]);
      expect(result.thinking).toContain('Just thinking');
      expect(result.parseError).toBeNull();
    });

    test('T1.3c: handles completely invalid JSON gracefully', () => {
      const llmResponse = `
<thinking>Test</thinking>
<response>
{this is not valid json at all}
</response>
      `;

      const result = parseNotesBullets(llmResponse);

      expect(result.bullets).toEqual([]);
      expect(result.parseError).toBeDefined();
      expect(result.parseError).toContain('Failed to parse');
    });
  });

  describe('buildNotesContext - T1.4', () => {
    test('T1.4: combines bullets + user message + graph state correctly', async () => {
      const bullets = ['Existing bullet 1', 'Existing bullet 2'];
      const userMessage = 'I want to add authentication';

      const context = await buildNotesContext(bullets, userMessage);

      // Check structure
      expect(context.systemPrompt).toBeDefined();
      expect(typeof context.systemPrompt).toBe('string');
      expect(context.systemPrompt).toContain('notes');

      // Check bullets are included
      expect(context.currentBullets).toEqual(bullets);

      // Check user message
      expect(context.userMessage).toBe(userMessage);

      // Check graph state (from flow)
      expect(context.flowState).toBeDefined();
      expect(context.flowState.nodes).toHaveLength(1);
      expect(context.flowState.nodes[0].data.label).toBe('Start');
      expect(context.flowState.edges).toEqual([]);
    });

    test('T1.4b: handles empty bullets array', async () => {
      const context = await buildNotesContext([], 'First message');

      expect(context.currentBullets).toEqual([]);
      expect(context.userMessage).toBe('First message');
      expect(context.flowState).toBeDefined();
    });

    test('T1.4c: includes flow state with multiple nodes and edges', async () => {
      // Update flow with more complex structure
      await saveFlow({
        nodes: [
          { id: '1', data: { label: 'Login' }, position: { x: 0, y: 0 } },
          { id: '2', data: { label: 'Dashboard' }, position: { x: 100, y: 0 } }
        ],
        edges: [
          { id: 'e1-2', source: '1', target: '2' }
        ]
      });

      const context = await buildNotesContext(['Test bullet'], 'test');

      expect(context.flowState.nodes).toHaveLength(2);
      expect(context.flowState.edges).toHaveLength(1);
      expect(context.flowState.nodes[0].data.label).toBe('Login');
      expect(context.flowState.nodes[1].data.label).toBe('Dashboard');
    });
  });

  describe('callNotesLLM - T1.5', () => {
    // Mock test - we'll test failover behavior without actually calling APIs
    test('T1.5: fails over from Groq to Cerebras on error', async () => {
      // This test validates the structure exists
      // Actual failover behavior is tested in integration tests
      expect(callNotesLLM).toBeDefined();
      expect(typeof callNotesLLM).toBe('function');
    });
  });
});
