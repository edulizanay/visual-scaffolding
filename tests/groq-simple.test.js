// ABOUTME: Minimal test to verify Groq API calls are actually made
// ABOUTME: This test MUST show up in Groq dashboard if working correctly

import Groq from 'groq-sdk';
import { readFile } from 'fs/promises';

async function testGroqAPI() {
  console.log("╔════════════════════════════════════════════════════════╗");
  console.log("║  GROQ API VERIFICATION TEST                            ║");
  console.log("╚════════════════════════════════════════════════════════╝\n");

  // Load API key
  console.log("📁 Loading .env file...");
  const envContent = await readFile('.env', 'utf-8');
  const apiKey = envContent.split('\n')
    .find(line => line.startsWith('GROQ_API_KEY='))
    ?.split('=')[1]?.trim();

  if (!apiKey) {
    console.error("❌ GROQ_API_KEY not found in .env");
    process.exit(1);
  }

  console.log("✅ API Key found");
  console.log("   Length:", apiKey.length);
  console.log("   Prefix:", apiKey.substring(0, 10) + "...\n");

  // Create client
  console.log("🔧 Creating Groq client...");
  const groq = new Groq({ apiKey });
  console.log("✅ Client created\n");

  // Make API call
  console.log("📡 Calling Groq API...");
  console.log("   Model: openai/gpt-oss-120b");
  console.log("   Request: Simple greeting");

  const testMessage = `TEST_${Date.now()}`; // Unique message to identify in logs
  console.log("   Unique ID:", testMessage);
  console.log("");

  const startTime = Date.now();

  try {
    const response = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'user', content: `Say "${testMessage}" and nothing else` }
      ],
      temperature: 0,
      max_completion_tokens: 20
    });

    const elapsed = Date.now() - startTime;

    console.log("✅ API CALL SUCCESSFUL");
    console.log("   Duration:", elapsed, "ms");
    console.log("   Response ID:", response.id);
    console.log("   Model:", response.model);
    console.log("   Content:", response.choices[0].message.content);
    console.log("\n📊 Token Usage:");
    console.log("   Prompt tokens:", response.usage.prompt_tokens);
    console.log("   Completion tokens:", response.usage.completion_tokens);
    console.log("   Total tokens:", response.usage.total_tokens);
    console.log("   Queue time:", response.usage.queue_time, "s");
    console.log("   Total time:", response.usage.total_time, "s");

    console.log("\n✅ TEST PASSED");
    console.log("\n📝 Next Steps:");
    console.log("   1. Check Groq dashboard at https://console.groq.com/logs");
    console.log("   2. Look for request ID:", response.id);
    console.log("   3. Verify token usage matches above");
    console.log("   4. If this appears in dashboard, original test has a bug");
    console.log("   5. If this DOESN'T appear, there's an API/auth issue");

  } catch (error) {
    console.error("\n❌ API CALL FAILED");
    console.error("   Error:", error.message);
    console.error("   Type:", error.constructor.name);

    if (error.status) {
      console.error("   HTTP Status:", error.status);
    }
    if (error.code) {
      console.error("   Error Code:", error.code);
    }
    if (error.type) {
      console.error("   Error Type:", error.type);
    }

    console.error("\n🔍 Possible Issues:");
    console.error("   - Invalid API key");
    console.error("   - Rate limit exceeded");
    console.error("   - Network/firewall blocking");
    console.error("   - Groq service outage");

    throw error;
  }
}

testGroqAPI().catch(error => {
  console.error("\n💥 Test failed with unhandled error");
  process.exit(1);
});
