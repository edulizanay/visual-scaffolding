---
name: TDD Cycle Enforcer
description: Enforce strict TDD with red-green-refactor cycles. Use when implementing new features or adding functionality.
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# TDD Cycle Enforcer

Enforce strict Test-Driven Development: Write failing test → Implement minimal code → Verify → Refactor.

## Core Rule

**NEVER write implementation code without a failing test first.**

If you catch yourself writing implementation before tests, STOP immediately.

## The Red-Green-Refactor Cycle

### 🔴 RED: Write a Failing Test

**Step 1: Understand the requirement**
- What exact behavior are we testing?
- What should the input be?
- What should the output be?
- What edge cases exist?

**Step 2: Write the test**
- Test ONE specific behavior
- Use descriptive test names: `it('should return empty array when input is null')`
- Write assertions for expected behavior
- Don't mock the functionality you're testing

**Step 3: Run the test and verify it fails**
```bash
npm test -- path/to/test.test.js
```

**Verify failure reason:**
- ✅ Good: "function is not defined" or "expected X but got Y"
- ❌ Bad: Test passes (you're testing existing behavior)
- ❌ Bad: Syntax error (fix syntax first, then verify failure)

**If test passes unexpectedly:** The feature already exists or test is wrong. STOP and clarify.

### 🟢 GREEN: Make the Test Pass

**Step 1: Write MINIMAL implementation**
- Write ONLY enough code to make THIS test pass
- Don't add extra features
- Don't worry about perfect code yet
- Simplest solution that works

**Step 2: Run the test again**
```bash
npm test -- path/to/test.test.js
```

**Verify success:**
- ✅ Test passes
- ✅ All other tests still pass (no regressions)

**If test still fails:**
- Read the error message carefully
- Is your implementation correct?
- Is your test correct?
- Don't add more code blindly - understand why it's failing

### 🔵 REFACTOR: Improve the Code

**Only after tests are green:**
- Clean up implementation
- Remove duplication
- Improve naming
- Add comments if needed

**After each refactor:**
```bash
npm test
```

**All tests must stay green.** If tests fail, revert refactoring.

## One Test at a Time

Write one test → implement → verify passes → next test. Never batch multiple tests before implementing.

## Test Quality Rules

**DO:**
- Test real behavior, not mocks
- Use real data and APIs in E2E tests
- Capture expected errors with assertions

**DON'T:**
- Test mocked behavior (don't mock what you're testing)
- Mock everything in E2E tests
- Let tests pass with stray console errors/warnings

## Test Output Must Be Pristine

Zero tolerance for stray logs or errors. If tests pass but output shows errors/warnings, capture expected errors with assertions and make output clean.

## Red Flags (STOP if you catch yourself)

- ❌ "Let me implement this first, then write tests"
- ❌ "I'll write all the tests at once"
- ❌ "Tests are passing, good enough" (without verifying they failed first)
- ❌ "This is too simple to test"
- ❌ "I'll add tests later"
- ❌ Mocking the function you're trying to test
- ❌ Ignoring test failures

## Success Criteria

✅ Every feature has a failing test first
✅ Each test fails for the RIGHT reason before implementation
✅ Tests pass after minimal implementation
✅ All tests stay green after refactoring
✅ Test output is pristine (no errors/warnings)
✅ Tests use real data and APIs (especially E2E)
✅ One test at a time, one cycle at a time

## Notes

- This Skill enforces Edu's "NO EXCEPTIONS" testing policy
- The only way to skip tests: Edu explicitly says "I AUTHORIZE YOU TO SKIP WRITING TESTS THIS TIME"
- Test failures are YOUR responsibility - never ignore them
- TDD is not optional - it's the process
