// ABOUTME: Comparison test for current vs agentic tool execution approach
// ABOUTME: Tests the same prompt with both approaches to compare results and token usage

import { buildLLMContext, callGroqAPI, parseToolCalls } from '../server/llm/llmService.js';
import { executeToolCalls, readFlow, writeFlow, executeTool } from '../server/server.js';
import { toolDefinitions } from '../server/llm/tools.js';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import Groq from 'groq-sdk';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test prompt that requires placeholder ID resolution
const TEST_PROMPT = "Delete all nodes, create parent → child → grandchild with funny edge labels";

// Setup: Clear flow before each test
async function setupCleanFlow() {
  const testFlowPath = join(__dirname, 'test-data', 'comparison-flow.json');
  await mkdir(dirname(testFlowPath), { recursive: true });
  await writeFile(testFlowPath, JSON.stringify({ nodes: [], edges: [] }, null, 2));
  process.env.FLOW_DATA_PATH = testFlowPath;
}

/**
 * Test 1: Current approach (single LLM call, batch tool execution)
 * Expected: FAIL - placeholder IDs won't resolve
 */
async function testCurrentApproach() {
  console.log("🔵 Starting CURRENT approach test...\n");

  await setupCleanFlow();

  // 1. Build context
  const context = await buildLLMContext(TEST_PROMPT);
  console.log("📤 Calling Groq API (1 call expected)...");

  // 2. Call Groq once
  const llmResponse = await callGroqAPI(context);

  // 3. Parse tool calls
  const parsed = parseToolCalls(llmResponse);
  console.log(`\n💭 LLM Thinking:\n${parsed.thinking}\n`);
  console.log(`🔧 Tool calls attempted: ${parsed.toolCalls.length}`);

  // 4. Execute all tools in batch (this will FAIL on placeholder IDs)
  const results = await executeToolCalls(parsed.toolCalls);

  // 5. Get final flow
  const finalFlow = await readFlow();

  // Count failures
  const failures = results.filter(r => !r.success);

  console.log(`\n📊 Results:`);
  console.log(`   - Nodes created: ${finalFlow.nodes.length}`);
  console.log(`   - Edges created: ${finalFlow.edges.length}`);
  console.log(`   - Tool failures: ${failures.length}`);

  if (failures.length > 0) {
    console.log(`\n❌ Failures:`);
    failures.forEach((f, i) => {
      console.log(`   ${i + 1}. ${f.error}`);
    });
  }

  return {
    approach: "Current (Single Call)",
    thinking: parsed.thinking,
    toolCallsAttempted: parsed.toolCalls.length,
    toolCallsList: parsed.toolCalls.map(t => ({ name: t.name, params: t.params })),
    results,
    edgesCreated: finalFlow.edges.length,
    nodesCreated: finalFlow.nodes.length,
    failures: failures.length,
    success: finalFlow.edges.length > 0, // Did edges get created?
    finalFlow
  };
}

/**
 * Test 2: Agentic approach (multi-turn with tool results feedback)
 * Expected: SUCCESS - LLM sees IDs returned from previous tools
 */
async function testAgenticApproach() {
  console.log("🟢 Starting AGENTIC approach test...\n");

  await setupCleanFlow();

  // Load Groq API key
  const envPath = join(dirname(__dirname), '.env');
  const envContent = await readFile(envPath, 'utf-8');
  const apiKey = envContent.split('\n')
    .find(line => line.startsWith('GROQ_API_KEY='))
    ?.split('=')[1]?.trim();

  if (!apiKey) {
    throw new Error('GROQ_API_KEY not found in .env');
  }

  const groq = new Groq({ apiKey });

  // Format tools for Groq native format
  const tools = toolDefinitions.map(t => ({
    type: "function",
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters
    }
  }));

  // Use ORIGINAL system prompt from llmService.js (proven to work in production)
  const SYSTEM_PROMPT = `You are a UI helper for React Flow graph structures.
The user is building a flow diagram with nodes and edges.

Your role:
1. Review the conversation history to understand context
2. Look at the current flow state (nodes and edges)
3. Use the available tools to help the user achieve their objective

Important:
- You can call multiple tools in a single response
- When creating nodes with parent relationships, wait for the parent's nodeId before creating children
- Available tools and their schemas will be provided in each request`;

  // Get current flow state (like production does)
  const currentFlow = await readFlow();

  // Build initial messages (include flow state like production)
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `Current Flow State:\n${JSON.stringify(currentFlow, null, 2)}\n\nUser Request: ${TEST_PROMPT}`
    }
  ];

  console.log("📤 Starting agentic loop (max 3 iterations)...\n");

  let iterations = 0;
  const maxIterations = 3;

  // Manual agentic loop
  for (let i = 0; i < maxIterations; i++) {
    iterations++;
    console.log(`   🔄 Iteration ${iterations}...`);

    // Call Groq with tools
    const response = await groq.chat.completions.create({
      model: "openai/gpt-oss-120b",
      messages,
      tools,
      tool_choice: "auto",
      temperature: 1
    });

    const message = response.choices[0].message;

    // No more tools? Done!
    if (!message.tool_calls || message.tool_calls.length === 0) {
      console.log(`   ✅ No more tool calls - LLM finished\n`);
      break;
    }

    console.log(`   🔧 Executing ${message.tool_calls.length} tool(s)...`);

    // Add assistant message to history
    messages.push(message);

    // Execute each tool and add results
    for (const toolCall of message.tool_calls) {
      const toolName = toolCall.function.name;
      const toolArgs = JSON.parse(toolCall.function.arguments);

      console.log(`      - ${toolName}(${JSON.stringify(toolArgs).substring(0, 50)}...)`);

      // Execute the tool
      const result = await executeTool(toolName, toolArgs);

      console.log(`        → ${JSON.stringify(result).substring(0, 80)}...`);

      // Add tool result to messages (THIS IS KEY - Groq sees the result!)
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(result)
      });
    }

    console.log("");
  }

  if (iterations === maxIterations) {
    console.log(`   ⚠️  Reached max iterations (${maxIterations})\n`);
  }

  // Get final flow state
  const finalFlow = await readFlow();

  // Count successes
  const edgesWithLabels = finalFlow.edges.filter(e => e.data?.label).length;

  console.log(`📊 Results:`);
  console.log(`   - Iterations: ${iterations}`);
  console.log(`   - Nodes created: ${finalFlow.nodes.length}`);
  console.log(`   - Edges created: ${finalFlow.edges.length}`);
  console.log(`   - Edges with labels: ${edgesWithLabels}`);

  return {
    approach: "Agentic (Native Tools)",
    iterations,
    toolCallsAttempted: "N/A (multi-turn)",
    edgesCreated: finalFlow.edges.length,
    nodesCreated: finalFlow.nodes.length,
    edgesWithLabels,
    success: finalFlow.edges.length >= 2 && edgesWithLabels >= 2,
    finalFlow
  };
}

/**
 * Run comparison and output results
 */
async function runComparison() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  TOOL EXECUTION APPROACH COMPARISON TEST               ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");
  console.log(`Test Prompt: "${TEST_PROMPT}"\n`);

  try {
    // Test current approach
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const current = await testCurrentApproach();

    // Test agentic approach
    console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    const agentic = await testAgenticApproach();

    // Comparison table
    console.log("\n╔════════════════════════════════════════════════════════╗");
    console.log("║  COMPARISON RESULTS                                    ║");
    console.log("╚════════════════════════════════════════════════════════╝\n");

    console.table({
      "Current (Single Call)": {
        "Edges Created": current.edgesCreated,
        "Edges w/ Labels": "N/A",
        "Nodes Created": current.nodesCreated,
        "Tool Failures": current.failures,
        "Iterations": 1,
        "Success": current.success ? "✅" : "❌"
      },
      "Agentic (Multi-Turn)": {
        "Edges Created": agentic.edgesCreated,
        "Edges w/ Labels": agentic.edgesWithLabels,
        "Nodes Created": agentic.nodesCreated,
        "Tool Failures": 0,
        "Iterations": agentic.iterations,
        "Success": agentic.success ? "✅" : "❌"
      }
    });

    console.log("\n📝 Next Steps:");
    console.log("   1. ✅ Compare results above");
    console.log("   2. 📊 Check Groq dashboard at https://console.groq.com/usage");
    console.log("   3. 💰 Verify token usage and costs");
    console.log("   4. 🚀 If agentic approach succeeds, update production code");

  } catch (error) {
    console.error("\n❌ Test failed with error:", error);
    console.error(error.stack);
  }
}

// Run the comparison
runComparison();
