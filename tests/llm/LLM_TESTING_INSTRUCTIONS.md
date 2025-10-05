# LLM Quality Testing Instructions

## Purpose
These tests verify that the Groq LLM correctly generates tool calls for various user requests.

## Prerequisites
1. **Environment**: Ensure `.env` file has `GROQ_API_KEY` configured
2. **Dependencies**: Run `npm install` if not already done
3. **Test Data**: Tests create temporary files in `tests/test-data/`

## Running Tests

```bash
# Run all LLM quality tests
NODE_OPTIONS=--experimental-vm-modules npx jest tests/llm/llmQuality.test.js

# Run with verbose output
NODE_OPTIONS=--experimental-vm-modules npx jest tests/llm/llmQuality.test.js --verbose

# Run specific test suite
NODE_OPTIONS=--experimental-vm-modules npx jest tests/llm/llmQuality.test.js -t "addNode tool"
```

## What's Being Tested

### 1. Tool Coverage (16 tests)
- **addNode**: Single node creation, multiple node creation
- **updateNode**: Label changes, position updates
- **deleteNode**: Node deletion
- **addEdge**: Simple connections, labeled connections
- **updateEdge**: Edge label changes
- **deleteEdge**: Edge removal
- **undo/redo**: History navigation

### 2. Edge Cases (3 tests)
- Pure questions (should NOT generate tool calls)
- Greetings (should NOT generate tool calls)
- Ambiguous requests (should NOT make assumptions)

### 3. Format Validation (4 tests)
- Presence of `<thinking>` tags
- Presence of `<response>` tags
- Valid JSON structure
- Required fields (id, name, params)

## Expected Behavior

✅ **Pass**: LLM generates correct tool calls with valid parameters
✅ **Pass**: LLM includes thinking process in `<thinking>` tags
✅ **Pass**: LLM outputs valid JSON in `<response>` tags
✅ **Pass**: LLM does NOT generate tools for questions/greetings

❌ **Fail**: Parse errors (invalid JSON)
❌ **Fail**: Missing required fields
❌ **Fail**: Wrong tool selected for request
❌ **Fail**: Tool calls for questions/greetings

## Common Issues

### API Rate Limits
If tests fail with rate limit errors, add delays between tests or reduce concurrent runs.

### Flaky Tests
LLMs can be non-deterministic. If a test occasionally fails:
1. Check if the LLM's reasoning is valid but different than expected
2. Consider adjusting test expectations to be more flexible
3. Run the test multiple times to see if it's consistently failing

### Timeout Errors
Each test has 30s timeout. If tests timeout:
1. Check GROQ_API_KEY is valid
2. Check network connection
3. Verify Groq API is responding

## Debugging Failed Tests

1. **Check LLM Response**: Tests log the full `llmResponse` on failure
2. **Check Parse Errors**: Look at `parsed.parseError` for JSON issues
3. **Check Tool Calls**: Inspect `parsed.toolCalls` array
4. **Manual Testing**: Use `test-mock.sh` to manually test specific prompts

## Adding New Tests

When adding new test cases:
1. Use `callAndParse(message, flowState)` helper
2. Always check `parsed.parseError` first
3. Validate both tool name and parameters
4. Consider edge cases and ambiguous inputs
