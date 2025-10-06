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

---

## 2025-10-06 - DaggerAgent: Dagre Auto-Layout Implementation

### Implementation Complete ✅
**Agent:** DaggerAgent
**Files Modified:**
- `package.json` - Added `@dagrejs/dagre@^1.1.5` dependency
- `src/App.jsx` - Added `getLayoutedElements()`, "Auto Layout" button, auto-trigger in `handleFlowUpdate`
- `tests/dagre-layout.test.js` - Isolated layout tests (3 tests, all passing)

### Features Implemented:
- ✅ **LR (left-to-right) hierarchical layout** - Dagre algorithm with 172x36 node dimensions
- ✅ **"Auto Layout" button** - Top-right canvas panel, triggers manual re-layout
- ✅ **Auto-trigger on LLM node creation** - Runs layout 100ms after `handleFlowUpdate`
- ✅ **Isolated testing** - Test reads production `flow.json`, verifies layout without modifying files

### Test Results:
```
Input:  grandfather (-261, -73), father (40, -76), son (392, -88)
Output: grandfather (0, 0), father (222, 0), son (444, 0)
✅ All 3 tests passed (LR hierarchy, empty graph, single node)
```

### Future Work (NOT implemented yet):
- **Remove `x`, `y` params from `addNode` tool** (`server/llm/tools.js`)
  - LLM shouldn't need to think about positions (layout handles it)
  - Simplifies tool schema
- **Keep position params in `updateNode` tool**
  - Allows LLM to manually reposition nodes (e.g., "move these nodes right")
- **Dynamic node dimensions**
  - Currently hardcoded to 172x36 (React Flow default)
  - Could use actual measured node sizes from `node.measured`

### Technical Notes:
- Dagre runs entirely on frontend (presentation logic, not business logic)
- 100ms timeout in auto-trigger prevents race conditions with React state updates
- Button styled to match existing dark theme UI

