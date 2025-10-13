# Vitest Migration - Execution Plan

**Date:** October 13, 2025
**Branch:** `feat-migrate-to-vitest`
**Approved:** Option A - Vitest Migration
**Estimated Time:** 6-9 hours

---

## Pre-Execution Checklist

- [x] Pre-migration inventory complete (34 files, 266 tests)
- [x] Technical research complete
- [x] Team aligned on approach
- [x] Git branch created (`feat-migrate-to-vitest`)
- [ ] Current tests baseline recorded
- [ ] Ready to proceed with Phase 1

---

## Execution Strategy

### **Approach: Codemod First, Manual Fixes Second**

We'll use a **two-pass strategy**:

1. **Automated Pass:** Run codemod to handle 70-80% of conversions
2. **Manual Pass:** Fix async mocks, setup files, and edge cases
3. **Verification Pass:** Run tests and fix any issues

This minimizes manual work and reduces human error.

---

## Phase 1: Baseline & Dependencies (Est. 1 hour)

### **Step 1.1: Record Current Test Baseline**

**Purpose:** Document exact test status before making any changes

**Commands:**
```bash
# Run current tests and save output
npm test > /tmp/jest-baseline-output.txt 2>&1

# Extract summary
grep -E "Test Suites:|Tests:" /tmp/jest-baseline-output.txt

# Count test files
find tests -name "*.test.js" -o -name "*.test.jsx" | wc -l

# List failing tests
grep "FAIL" /tmp/jest-baseline-output.txt
```

**Expected Output:**
```
Test Suites: 5 failed, 15 passed, 20 total
Tests:       266 passed, 266 total
34 test files
```

**Verification:** Confirm 266 tests, 5 failing suites (ESM issues)

---

### **Step 1.2: Install Vitest Dependencies**

**Commands:**
```bash
# Install Vitest and related packages
npm install -D vitest @vitest/ui happy-dom

# Verify installation
npm list vitest @vitest/ui happy-dom
```

**Expected Packages Added:**
- `vitest` (test runner)
- `@vitest/ui` (optional UI for debugging)
- `happy-dom` (faster DOM environment)

**Verification:** Check package.json has new devDependencies

---

### **Step 1.3: Commit Checkpoint**

**Commands:**
```bash
git add package.json package-lock.json
git commit -m "chore: install Vitest dependencies

- Add vitest, @vitest/ui, happy-dom
- Preparation for Jest to Vitest migration
- No test changes yet

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

**Why:** Safe checkpoint before making any code changes

---

## Phase 2: Configuration Files (Est. 1 hour)

### **Step 2.1: Create vitest.config.js**

**File:** `vitest.config.js` (new file)

**Content:**
```javascript
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // Enable globals for Jest-compatible API
    globals: true,

    // Multi-environment setup using projects
    projects: [
      // Backend tests - Node environment
      {
        test: {
          name: 'backend',
          environment: 'node',
          include: [
            'tests/unit/backend/**/*.test.js',
            'tests/integration/**/*.test.js',
            'tests/e2e/**/*.test.js',
            'tests/llm/**/*.test.js',
            'tests/api-*.test.js',
            'tests/conversationService.test.js',
            'tests/db.test.js',
            'tests/groupHelpers.test.js',
            'tests/historyService.test.js',
            'tests/schema-migration.test.js',
            'tests/toolExecution*.test.js',
            'tests/undo-redo-autosave.test.js',
          ],
        }
      },

      // Frontend API tests - Node environment
      {
        test: {
          name: 'frontend-api',
          environment: 'node',
          include: [
            'tests/unit/frontend/**/*.test.js',
          ],
        }
      },

      // Frontend UI tests - DOM environment
      {
        test: {
          name: 'frontend-ui',
          environment: 'happy-dom',
          include: [
            'tests/unit/frontend/**/*.test.jsx',
            'tests/security/**/*.test.jsx',
          ],
          setupFiles: ['./tests/setup-frontend.js'],
        }
      },

      // Security backend tests - Node environment
      {
        test: {
          name: 'security',
          environment: 'node',
          include: [
            'tests/security/**/*.test.js',
          ],
        }
      }
    ],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{js,jsx}', 'server/**/*.js'],
      exclude: [
        '**/*.test.{js,jsx}',
        'node_modules/**',
        'tests/**',
      ],
    },
  },
});
```

**Verification:**
```bash
# Validate config syntax
node -e "import('./vitest.config.js').then(() => console.log('✓ Config valid'))"
```

---

### **Step 2.2: Update package.json Scripts**

**Find & Replace in package.json:**

```json
// BEFORE:
{
  "scripts": {
    "test": "NODE_OPTIONS=--experimental-vm-modules jest",
    "test:watch": "NODE_OPTIONS=--experimental-vm-modules jest --watch",
  }
}

// AFTER:
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:ui": "vitest --ui",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Commands:**
```bash
# Verify new scripts work (will fail tests for now, that's OK)
npm run test -- --version
```

**Expected Output:** `vitest version X.X.X`

---

### **Step 2.3: Commit Checkpoint**

**Commands:**
```bash
git add vitest.config.js package.json
git commit -m "chore: add Vitest configuration

- Create vitest.config.js with 4 projects (backend, frontend-api, frontend-ui, security)
- Update npm scripts to use Vitest
- Maintain environment separation (node vs happy-dom)
- Map all test paths from Jest config

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 3: Automated Codemod (Est. 30 minutes)

### **Step 3.1: Run Codemod Tool**

**Tool:** Official Codemod.com jest-to-vitest transformer

**Commands:**
```bash
# Dry run first (preview changes without applying)
npx codemod@latest jest/vitest --dry

# If dry run looks good, apply changes
npx codemod@latest jest/vitest

# Alternative: Manual codemod if above fails
# npx jscodeshift -t node_modules/vitest-codemod/transforms/jest-to-vitest.js tests/
```

**What This Handles Automatically:**
- ✅ Import statements: `@jest/globals` → `vitest`
- ✅ Mock API: `jest.fn()` → `vi.fn()`
- ✅ Spy API: `jest.spyOn()` → `vi.spyOn()`
- ✅ Timer API: `jest.useFakeTimers()` → `vi.useFakeTimers()`
- ✅ Clear API: `jest.clearAllMocks()` → `vi.clearAllMocks()`
- ✅ Mock calls: `jest.mock()` → `vi.mock()`

**What This CANNOT Handle (requires manual fixes):**
- ❌ Async `vi.importActual()` calls
- ❌ `jest.unstable_mockModule` → `vi.mock()` conversion
- ❌ Setup file imports

---

### **Step 3.2: Review Codemod Changes**

**Commands:**
```bash
# See what changed
git diff --stat

# Review specific files
git diff tests/unit/frontend/ChatInterface.test.jsx | head -50

# Count changes
git diff --shortstat
```

**Expected Changes:**
- ~34 test files modified
- Import statements updated
- Mock API calls converted

**Verification Checklist:**
- [ ] No `jest.` references remain (except in comments)
- [ ] All test files have `vitest` imports
- [ ] Mock functions use `vi.` prefix

---

### **Step 3.3: Commit Checkpoint**

**Commands:**
```bash
git add tests/
git commit -m "refactor: apply Jest to Vitest codemod

- Convert all test imports from @jest/globals to vitest
- Replace jest.fn() with vi.fn() across all test files
- Replace jest.mock() with vi.mock()
- Replace jest.spyOn() with vi.spyOn()
- Update timer and mock clearing APIs

Applied via: npx codemod@latest jest/vitest

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 4: Manual Fixes (Est. 2-3 hours)

### **Step 4.1: Fix Async importActual Calls**

**Find affected files:**
```bash
# Search for importActual usage
grep -r "importActual" tests/ --include="*.test.js" --include="*.test.jsx"
```

**Expected Files (~10-15):**
- tests/unit/frontend/ChatInterface.test.jsx
- tests/unit/frontend/App-group-behavior.test.jsx
- tests/unit/frontend/Edge.test.jsx
- tests/security/xss-rendering.test.jsx
- (Others will be identified by grep)

**Pattern to Fix:**
```javascript
// BEFORE (will be broken after codemod):
vi.mock('../../../src/api.js', () => ({
  ...vi.importActual('../../../src/api.js'),  // ❌ Missing await
  sendMessage: vi.fn(),
}));

// AFTER (manual fix):
vi.mock('../../../src/api.js', async () => ({  // Add async
  ...(await vi.importActual('../../../src/api.js')),  // Add await + parens
  sendMessage: vi.fn(),
}));
```

**Process:**
1. For each file found by grep:
2. Add `async` to the factory function
3. Add `await` before `vi.importActual()`
4. Wrap awaited call in parentheses

**Verification:**
```bash
# Ensure no naked importActual calls remain
grep -r "importActual" tests/ | grep -v "await"
# Should only show comments or already-fixed lines
```

---

### **Step 4.2: Fix jest.unstable_mockModule**

**Find affected file:**
```bash
grep -r "unstable_mockModule" tests/
```

**Expected:** 1 file: `tests/integration/conversation-endpoint.test.js`

**Manual Fix:**
```javascript
// BEFORE:
vi.unstable_mockModule('../../server/llm/llmService.js', () => ({ ... }));

// AFTER:
vi.mock('../../server/llm/llmService.js', () => ({ ... }));
```

**Remove `unstable_` prefix - that's it!**

---

### **Step 4.3: Update Setup File**

**File:** `tests/setup-frontend.js`

**Changes Needed:**
```javascript
// BEFORE:
import '@testing-library/jest-dom';

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// AFTER:
import '@testing-library/jest-dom/vitest';  // Add /vitest suffix
import { vi } from 'vitest';  // Add import

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({  // jest → vi
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),  // jest → vi
    removeListener: vi.fn(),  // jest → vi
    addEventListener: vi.fn(),  // jest → vi
    removeEventListener: vi.fn(),  // jest → vi
    dispatchEvent: vi.fn(),  // jest → vi
  })),
});
```

**Changes:**
1. Add `/vitest` to `@testing-library/jest-dom` import
2. Add `import { vi } from 'vitest';`
3. Replace all `jest.fn()` with `vi.fn()`

---

### **Step 4.4: Commit Checkpoint**

**Commands:**
```bash
git add tests/
git commit -m "refactor: apply manual Vitest migration fixes

- Add async/await to vi.importActual() calls in ~10-15 files
- Remove unstable_ prefix from vi.mock() calls
- Update tests/setup-frontend.js with Vitest imports
- Replace jest.fn() with vi.fn() in setup file

Manual fixes required after codemod for ESM compatibility

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 5: First Test Run (Est. 1-2 hours)

### **Step 5.1: Run Full Test Suite**

**Commands:**
```bash
# Run all tests with verbose output
npm test 2>&1 | tee /tmp/vitest-first-run.txt

# Check summary
grep -E "Test Files|Tests|Duration" /tmp/vitest-first-run.txt
```

**Expected Outcomes:**

**Success Case:**
```
✓ Test Files  34 passed (34)
✓ Tests  266 passed (266)
Duration  X.XXs
```

**Partial Success Case:**
```
✓ Test Files  30 passed | 4 failed (34)
✓ Tests  250 passed | 16 failed (266)
```

**Analysis:**
- Compare to baseline: Was 266 tests, should still be 266 tests
- The 5 originally failing tests should now pass (ESM issues fixed)
- Any new failures need investigation

---

### **Step 5.2: Identify and Fix Failures**

**Common Issues & Fixes:**

**Issue 1: "Cannot find module"**
```bash
# Check import paths
grep -r "import.*from.*'.*'" tests/ | grep -v node_modules
```
**Fix:** Ensure file extensions are correct

---

**Issue 2: "ReferenceError: X is not defined"**
**Cause:** Globals not enabled or missing imports
**Fix:** Check `globals: true` in vitest.config.js

---

**Issue 3: Mock not working**
**Cause:** Mock hoisting issues
**Fix:** Review mock setup in affected test file

---

**Issue 4: Async timing issues**
**Cause:** Different async handling
**Fix:** Add `await` to async operations

---

### **Step 5.3: Run Tests by Project**

**If full suite fails, run projects individually:**

```bash
# Test each project separately
npm test -- --project=backend
npm test -- --project=frontend-api
npm test -- --project=frontend-ui
npm test -- --project=security
```

**Identify which project(s) have issues**

---

### **Step 5.4: Document Results**

**Commands:**
```bash
# Save test results
npm test > /tmp/vitest-results.txt 2>&1

# Compare to baseline
echo "=== BASELINE (Jest) ===" > /tmp/migration-comparison.txt
grep -E "Test Suites:|Tests:" /tmp/jest-baseline-output.txt >> /tmp/migration-comparison.txt
echo "" >> /tmp/migration-comparison.txt
echo "=== AFTER MIGRATION (Vitest) ===" >> /tmp/migration-comparison.txt
grep -E "Test Files|Tests" /tmp/vitest-results.txt >> /tmp/migration-comparison.txt

cat /tmp/migration-comparison.txt
```

**Expected:**
```
=== BASELINE (Jest) ===
Test Suites: 5 failed, 15 passed, 20 total
Tests:       266 passed, 266 total

=== AFTER MIGRATION (Vitest) ===
✓ Test Files  34 passed (34)
✓ Tests  266 passed (266)
```

---

## Phase 6: Cleanup (Est. 30 minutes)

### **Step 6.1: Remove Jest Dependencies**

**Only do this AFTER all tests pass!**

**Commands:**
```bash
# Remove Jest packages
npm uninstall jest @jest/globals babel-jest

# Verify removal
npm list jest @jest/globals babel-jest 2>&1 | grep "not found"
```

**Expected:** All three packages should be "not found"

---

### **Step 6.2: Remove Jest Config**

**Commands:**
```bash
# Remove Jest config file
rm jest.config.js

# Keep babel.config.cjs (might be used by other tools)
# Just note it's unused by Vitest

git status
```

---

### **Step 6.3: Final Verification**

**Checklist:**
```bash
# 1. All tests pass
npm test
# Expected: ✓ Test Files 34 passed (34), ✓ Tests 266 passed (266)

# 2. No Jest references remain
grep -r "jest\." tests/ | grep -v node_modules | grep -v "jest.config"
# Expected: No results (or only comments)

# 3. No @jest imports remain
grep -r "@jest/globals" tests/
# Expected: No results

# 4. Test count matches baseline
# Expected: 266 tests

# 5. Watch mode works
npm run test:watch -- --run
# Expected: Tests run successfully

# 6. UI works
npm run test:ui -- --run
# Expected: UI loads (can Ctrl+C after verification)

# 7. Coverage works
npm run test:coverage
# Expected: Coverage report generated
```

---

### **Step 6.4: Final Commit**

**Commands:**
```bash
git add -A
git commit -m "chore: complete Jest to Vitest migration

- Remove Jest, @jest/globals, babel-jest dependencies
- Remove jest.config.js (replaced by vitest.config.js)
- All 266 tests passing with Vitest
- ESM issues resolved (5 previously failing suites now pass)

Migration complete:
- 34 test files migrated
- 266 tests passing
- 4 project environments configured
- Faster watch mode with native ESM support

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Phase 7: Post-Migration Verification (Est. 30 minutes)

### **Step 7.1: Final Test Matrix**

Run comprehensive verification:

```bash
# Clean install to verify dependencies
rm -rf node_modules package-lock.json
npm install

# Full test suite
npm test

# Watch mode (manual test - Ctrl+C to exit)
npm run test:watch

# UI mode (manual test - Ctrl+C to exit)
npm run test:ui

# Coverage
npm run test:coverage

# Individual projects
npm test -- --project=backend
npm test -- --project=frontend-api
npm test -- --project=frontend-ui
npm test -- --project=security
```

**All should succeed**

---

### **Step 7.2: Create Migration Report**

**File:** `.agent/VITEST_MIGRATION_REPORT.md`

**Content Template:**
```markdown
# Vitest Migration - Completion Report

**Date:** [DATE]
**Duration:** [X hours]
**Status:** ✅ SUCCESS

## Results

### Test Metrics
- **Before:** 266 tests, 5 failing suites (ESM issues)
- **After:** 266 tests, 0 failing suites
- **Files Migrated:** 34 test files
- **Success Rate:** 100%

### Changes Made
- Created vitest.config.js (4 projects)
- Updated 34 test files (imports + API)
- Updated 1 setup file
- Removed jest.config.js
- Removed 3 Jest dependencies

### Issues Resolved
✅ ESM "Must use import" errors - FIXED
✅ Frontend UI tests - ALL PASSING
✅ Backend integration tests - ALL PASSING
✅ Supertest compatibility - CONFIRMED

### Performance
- Watch mode: [X]x faster
- First run: Similar/[X]% faster

## Rollback Information
- Branch: feat-migrate-to-vitest
- Previous branch: feat-finalize-token-migration
- Commits: [N] commits
- Can rollback via: git checkout feat-finalize-token-migration

## Next Steps
1. Team review of migration
2. Update CI/CD pipelines (if needed)
3. Merge to main branch
4. Document Vitest usage for team
```

---

## Emergency Rollback Procedure

**If critical issues arise at any point:**

```bash
# Stop immediately
# DO NOT proceed with next steps

# Rollback to previous branch
git checkout feat-finalize-token-migration

# Verify Jest still works
npm install
npm test

# Delete migration branch (if needed)
git branch -D feat-migrate-to-vitest

# Report issue
# Document what failed for future attempt
```

---

## Success Criteria

**Migration is complete when ALL are true:**

- [ ] All 266 tests pass (`npm test`)
- [ ] Test count matches baseline (266 tests)
- [ ] All 34 test files discovered
- [ ] No Jest dependencies remain
- [ ] No jest.* references in test files
- [ ] No @jest/globals imports remain
- [ ] Watch mode works (`npm run test:watch`)
- [ ] UI works (`npm run test:ui`)
- [ ] Coverage works (`npm run test:coverage`)
- [ ] All 4 projects run independently
- [ ] The 5 originally failing tests now pass
- [ ] No new test failures introduced

---

## Timeline

**Estimated Timeline:**
- Phase 1: Baseline & Dependencies - 1 hour
- Phase 2: Configuration - 1 hour
- Phase 3: Automated Codemod - 30 minutes
- Phase 4: Manual Fixes - 2-3 hours
- Phase 5: Test Run & Fixes - 1-2 hours
- Phase 6: Cleanup - 30 minutes
- Phase 7: Verification - 30 minutes

**Total: 6-9 hours**

---

## Team Alignment Checklist

Before proceeding, confirm:

- [ ] Team understands this will take 6-9 hours
- [ ] Team is available for testing/review
- [ ] CI/CD pipeline plan (if applicable)
- [ ] Rollback plan understood
- [ ] No blocking deadlines in next 2 days
- [ ] Approval to proceed

---

**Ready to Execute?**

Once team confirms the above checklist, we can begin Phase 1.

---

**Prepared by:** Claude
**Date:** October 13, 2025
**Status:** Awaiting Final Approval
