// ABOUTME: Manual test to verify Groq API call count
// ABOUTME: Run this to test if ONE request = ONE Groq call (not mocked)

import { callLLM, buildLLMContext } from '../server/llm/llmService.js';

async function testSingleGroqCall() {
  const timestamp = new Date().toISOString();
  console.log('\n================================================');
  console.log(`🧪 TEST STARTED AT: ${timestamp}`);
  console.log('================================================');
  console.log('Check your Groq dashboard logs NOW.');
  console.log('This test will make ONE LLM call with a simple request.\n');

  try {
    // Build context
    const context = await buildLLMContext('Create a login node');

    console.log('📤 About to call Groq API...');
    const startTime = Date.now();

    // Make ONE call
    const response = await callLLM(context);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);

    console.log(`✅ Call completed in ${duration}s`);
    console.log(`\n📊 Response preview (first 200 chars):`);
    console.log(response.substring(0, 200));
    console.log('\n================================================');
    console.log('🔍 CHECK YOUR GROQ DASHBOARD NOW:');
    console.log(`   Timestamp: ${timestamp}`);
    console.log('   Expected: 1 API call');
    console.log('   If you see MORE than 1 call, the issue is in backend logic');
    console.log('   If you see EXACTLY 1 call, the issue is in frontend/dev env');
    console.log('================================================\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error('\nFull error:', error);
  }
}

// Run the test
testSingleGroqCall();
