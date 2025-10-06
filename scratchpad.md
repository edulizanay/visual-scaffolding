# Scratchpad

## 2025-10-05

(Previous session history removed for brevity)

---

## 2025-10-06 - Native Groq Tool Format Migration

### 2:00 AM - Problem Discovery
- **Issue:** Edges not created when LLM tries to use placeholder IDs
- **Root Cause:** LLM uses strings like `"PLACEHOLDER_PARENT_ID"` but we don't resolve them
- **Decision:** Migrate to native Groq tool format with agentic loop

### 2:30 AM - Test Implementation
- Created `tests/agentic-comparison.test.js`
- Implemented manual agentic loop with native Groq API
- **Result:** ✅ Works! Creates parent → child → grandchild with edge labels
- API calls showing in Groq dashboard

### 3:00 AM - Original Prompt Testing
- Updated test to use ORIGINAL SYSTEM_PROMPT from llmService.js
- Added flow state to messages (like production)
- **Finding:** LLM calls 1 tool per iteration for dependent hierarchy (OPTIMAL!)
  - Parent → Child → Grandchild CANNOT be batched (each needs previous ID)
  - 3 API calls is the minimum possible for this scenario

### Next Steps:
- Test scenarios where batching SHOULD help (e.g., creating 3 independent siblings)
- Add metrics tracking (tokens, cost)
- Document when to expect batching vs. sequential calls

### 3:30 AM - Schema Fix & Batching Investigation
- **Problem Found:** Tool schema didn't allow `null` for optional params
- **Error:** `parentNodeId: expected string, but got null`
- **Fix:** Changed schema to `type: ['string', 'null']` for optional fields
- **Result:** ✅ No more errors with null values

**Batching Test Results:**
- Prompt: "Create grandfather, father, and son nodes"
- Result: LLM creates only 1 node per call (even with nullable schema)
- Even with EXPLICIT instruction: "Create these 3 nodes in one batch"
- **Finding:** `openai/gpt-oss-120b` appears to be conservative, prefers 1 tool/call

**Current Status:**
- ✅ Agentic loop works (edges created successfully)
- ✅ Schema allows null (no more 400 errors)
- ❌ LLM doesn't batch even when instructed
- **Conclusion:** 3 API calls for parent→child→grandchild is likely optimal for this model

**Next Decision:**
1. Accept 3 calls as optimal and proceed to production?
2. Try different model (llama-3.3-70b) that might batch better?
3. Live with current approach - it WORKS, just not as optimized as hoped

### 4:00 AM - [CLAUDE] Error Recovery Loop
**Files Modified:** server/server.js (POST endpoint + buildRetryMessage helper)

**Approach:** Loop on any failure with verbose retry messages (max 3 iterations)

**Test:** "Delete all nodes, create grandfather → father → son with 'spawned' edge labels"
- Iteration 1: Created 3 nodes ✅, tried edges with labels instead of IDs ❌
- Iteration 2: LLM used correct IDs from retry message, edges created ✅
- **Result:** 2 API calls total, all tests passing

