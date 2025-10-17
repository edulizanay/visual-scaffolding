---
name: Root Cause Debugger
description: Use when debugging errors, investigating failures, troubleshooting issues, or when code doesn't work as expected and the cause is unknown. 
allowed-tools: Read, Grep, Glob, Bash
---

# Root Cause Debugger

NEVER fix symptoms or add workarounds. ALWAYS find the root cause of any issue.

## Phase 1: Root Cause Investigation (BEFORE attempting fixes)

### Step 1: Read Error Messages Carefully
- Don't skip past errors or warnings - they often contain the exact solution
- Copy the full error message, stack trace, and context
- Look for file paths, line numbers, and specific error codes

### Step 2: Reproduce Consistently
- Ensure you can reliably reproduce the issue before investigating
- Document the exact steps to trigger the problem
- Note any conditions that affect reproduction (timing, environment, data)

### Step 3: Check Recent Changes
- What changed that could have caused this?
- Run `git diff` to see uncommitted changes
- Run `git log --oneline -10` to see recent commits
- Run `git blame` on relevant files to understand change history

## Phase 2: Pattern Analysis

### Step 1: Find Working Examples
- Locate similar working code in the same codebase
- Use Grep to find patterns: `grep -r "similarPattern" --include="*.js"`
- Read working implementations completely

### Step 2: Compare Against References
- If implementing a pattern, read the reference implementation completely
- Don't assume - verify how it's supposed to work
- Check official documentation or examples

### Step 3: Identify Differences
- What's different between working and broken code?
- Create a side-by-side comparison
- Look for missing imports, configuration, initialization

### Step 4: Understand Dependencies
- What other components/settings does this pattern require?
- Check package.json, config files, environment variables
- Verify all prerequisites are met

## Phase 3: Hypothesis and Testing

### Step 1: Form Single Hypothesis
- State clearly: "I think the root cause is X because Y"
- Don't guess multiple causes at once
- Base hypothesis on evidence from Phase 1-2

### Step 2: Test Minimally
- Make the SMALLEST possible change to test your hypothesis
- Change only ONE thing at a time
- Document what you're testing

### Step 3: Verify Before Continuing
- Did your test work? Yes/No - be honest
- If NO: Form new hypothesis, don't add more fixes
- If YES: Verify it fixes the root cause, not just symptoms

### Step 4: When You Don't Know
- Say "I don't understand X" rather than pretending to know
- Ask for clarification or additional context
- Research the specific unknowns

## Phase 4: Implementation Rules

### Always Have a Failing Test
- Write the simplest possible failing test case
- If there's no test framework, write a one-off test script
- The test should fail for the RIGHT reason

### Never Add Multiple Fixes at Once
- One hypothesis = one fix = one test
- If first fix doesn't work, STOP and re-analyze
- Don't pile fixes on top of each other

### Never Claim to Implement Without Reading
- Read reference implementations COMPLETELY first
- Don't implement based on memory or assumptions
- Verify every detail

### Always Test After Each Change
- Run tests after every change
- Verify the fix actually works
- Check for unintended side effects

## Red Flags (Stop Immediately If You Catch Yourself):

- ❌ "Let me try adding this just in case..."
- ❌ "I'll add a fallback/workaround to handle this..."
- ❌ "Maybe if I change these 3 things..."
- ❌ "I think this might work..."
- ❌ Fixing something without understanding WHY it was broken

## Success Criteria

✅ You can explain WHY the bug happened
✅ You can explain WHY your fix addresses the root cause
✅ You have a test that fails without the fix and passes with it
✅ The fix doesn't introduce workarounds or special cases
✅ You understand what you changed

## Example Workflow

```
1. Error: "Cannot read property 'x' of undefined"

2. Phase 1: Investigation
   - Read full stack trace: points to line 42 in foo.js
   - Reproduce: happens every time on button click
   - Recent changes: git diff shows new function added yesterday

3. Phase 2: Pattern Analysis
   - Find working examples: grep for similar button handlers
   - Compare: working handlers check if object exists first
   - Difference: new code assumes object is always present
   - Dependencies: object comes from async API call that might fail

4. Phase 3: Hypothesis
   - "Root cause: assuming API always returns object, but it can be null on error"
   - Test: add null check before accessing property
   - Verify: error gone, button works even when API fails

5. Phase 4: Implementation
   - Write test: "should handle null API response"
   - Test fails (good)
   - Add null check
   - Test passes
   - Done
```

## Notes

- This Skill enforces Edu's "no workarounds" policy
- Fixing symptoms instead of root causes is considered FAILURE
- When in doubt, investigate deeper - never guess
- It's okay to say "I need more information to find the root cause"
