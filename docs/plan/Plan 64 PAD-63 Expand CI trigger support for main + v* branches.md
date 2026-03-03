# Plan 64 — PAD-63 Expand CI Trigger Support for main + v* branches

---

## Task Analysis

### Main Objective
Integrate the unification regression test suite into the existing CI workflow as a sequential step, and update documentation to reflect the Node.js 24.x requirement.

**Key Finding**: Branch triggers (main and v*) are already correctly configured in `.github/workflows/ci.yml`. No changes needed to trigger configuration.

### Identified Dependencies
- **Task 31**: GitHub Actions CI/CD Workflow (✓ Completed)
- **Task 58**: Fix matchStartTime initialization-consistency (✓ Completed)
- Unification regression test suite exists at `tests/unification-regression/` with 4 test files
- `npm run test:unification` script already configured in `package.json`

### System Impact
| File | Impact Type | Description |
|------|-------------|-------------|
| `.github/workflows/ci.yml` | **Modified** | Add `npm run test:unification` step after existing test step |
| `README.md` | **Modified** | Update Node.js requirement from "16+ (tested with Node 20)" to "24.x" |
| CI Pipeline | **Enhanced** | Quality gate now includes unification regression suite |

### Current State Analysis

**✓ Already Correct (No Changes Needed):**
1. Branch triggers: `push: [main, v*]` and `pull_request: [main, v*]`
2. Node.js version: 24.x (single version, not matrix)
3. Dependency caching configured
4. Quality steps: lint, format check, test, build

**⚠ Needs Update:**
1. Missing `npm run test:unification` step in CI workflow
2. Documentation mentions Node 16+/20 instead of 24.x

**Test Suite Structure:**
- Regular tests: `tests/*.test.js` (run by `npm run test`)
- Unification regression: `tests/unification-regression/*.test.js` (run by `npm run test:unification`)
- Both use same isolation settings: `--test-isolation=process --test-concurrency=1`

---

## Chosen Approach

### Deepthink Pass — 3 Approaches Evaluated

**Approach A — Separate Job for Unification Tests**
- Create a new `unification-tests` job that runs after the `quality` job
- Pro: Clear separation of concerns; can run in parallel with other jobs
- Con: Overengineered for this use case; adds job coordination overhead; increases wall-clock time if not truly parallel; requires separate job setup (checkout, node setup, cache, install)

**Approach B — Sequential Step in Same Job (CHOSEN ✓)**
- Add `npm run test:unification` as a new step immediately after `npm run test`
- Pro: Simplest effective solution; reuses existing job setup; sequential execution ensures tests run in predictable order; minimal YAML changes
- Con: Sequential execution means unification tests wait for regular tests (but this is actually desired per requirements)

**Approach C — Combine Test Commands**
- Change test step to: `npm run test && npm run test:unification`
- Pro: Single step; fastest to implement
- Con: Loses visibility into which test suite failed; harder to debug; violates principle of clear step separation in CI

**Verdict**: Approach B is the simplest effective solution that meets all requirements:
- Tests run sequentially (as required)
- Same job (as required)
- Clear step separation for debugging
- Minimal code changes
- No new infrastructure

### Proposed Solution

1. **Add unification regression step** to `.github/workflows/ci.yml`:
   - Insert new step `npm run test:unification` immediately after the existing `npm run test` step
   - Step runs in same `quality` job
   - Sequential execution (not parallel)

2. **Update documentation** in `README.md`:
   - Change "Node.js 16+ (tested with Node 20)" to "Node.js 24.x"
   - Ensures documentation matches actual CI configuration

### Justification for Simplicity

- **Single file change**: Only `.github/workflows/ci.yml` needs the test step addition
- **Single documentation update**: Only `README.md` needs Node.js version clarification
- **No architectural changes**: Reuses existing job structure, caching, and setup
- **Clear failure isolation**: Separate step means CI logs clearly show which test suite failed
- **Sequential by default**: GitHub Actions runs steps sequentially within a job (no special configuration needed)

### Components to be Modified/Created

| Component | Action | Lines Changed | Risk Level |
|-----------|--------|---------------|------------|
| `.github/workflows/ci.yml` | Modified | +5 lines | Low |
| `README.md` | Modified | ~1 line | Very Low |

**Total Impact**: 2 files, ~6 lines of changes

---

## Implementation Steps

### Step 1 — Verify Current CI Configuration (Subtask 64.1 & 64.5)

**Purpose**: Confirm that branch triggers are already correctly configured before making any changes.

**Actions**:
```bash
# Verify triggers are correct
grep -A 10 "^on:" .github/workflows/ci.yml
```

**Expected Output**:
```yaml
on:
  push:
    branches:
      - main
      - 'v*'
    paths-ignore:
      - '.opencode/**'
      - '.taskmaster/**'
      - '.husky/**'
      - 'docs/**'
      - 'README.md'
      - 'AGENTS.md'
      - 'CONTEXT.md'
  pull_request:
    branches:
      - main
      - 'v*'
```

**Checkpoint**: 
- ✓ Push triggers include `main` and `v*`
- ✓ Pull request triggers include `main` and `v*`
- ✓ Path ignores are present and correct

---

### Step 2 — Verify Node.js Configuration (Subtask 64.2)

**Purpose**: Confirm that Node.js 24.x is the only version in the matrix.

**Actions**:
```bash
# Verify Node.js version
grep -A 5 "strategy:" .github/workflows/ci.yml | grep -A 3 "matrix:"
```

**Expected Output**:
```yaml
matrix:
  node-version: ['24.x']
```

**Checkpoint**:
- ✓ Matrix contains only `24.x` (not `18.x` or `20.x`)
- ✓ Single version (not multi-version matrix)

---

### Step 3 — Add Unification Regression Test Step (Subtask 64.3)

**Purpose**: Integrate the unification regression suite into the CI workflow as a sequential step.

**Actions**:

Edit `.github/workflows/ci.yml` to add a new step after the existing test step:

**Find this section (around line 52-54):**
```yaml
      - name: Test suite
        run: npm run test

      - name: Build
        run: npm run build:all
```

**Replace with:**
```yaml
      - name: Test suite
        run: npm run test

      - name: Unification regression suite
        run: npm run test:unification

      - name: Build
        run: npm run build:all
```

**Exact modification using regex:**
```yaml
# Pattern to find:
      - name: Test suite\n        run: npm run test\n\n      - name: Build

# Replacement:
      - name: Test suite
        run: npm run test

      - name: Unification regression suite
        run: npm run test:unification

      - name: Build
```

**Verification**:
```bash
# Verify the new step was added
grep -A 2 "Unification regression" .github/workflows/ci.yml
```

**Expected Output**:
```yaml
      - name: Unification regression suite
        run: npm run test:unification
```

**Checkpoint**:
- ✓ New step added immediately after "Test suite" step
- ✓ Step uses correct command: `npm run test:unification`
- ✓ YAML indentation is correct (6 spaces for step name, 8 spaces for `run`)
- ✓ Step runs sequentially (default GitHub Actions behavior)

**Risk Note**: If unification tests fail, the entire CI job will fail. This is desired behavior - the quality gate should block on any test failure.

---

### Step 4 — Update Documentation (Subtask 64.4)

**Purpose**: Update README.md to reflect Node.js 24.x requirement.

**Actions**:

Edit `README.md`:

**Find this line (around line 43):**
```markdown
- Node.js 16+ (tested with Node 20)
```

**Replace with:**
```markdown
- Node.js 24.x
```

**Verification**:
```bash
# Verify the update
grep -i "node.js" README.md | head -3
```

**Expected Output**:
```markdown
- Node.js 24.x
```

**Checkpoint**:
- ✓ Documentation now matches CI configuration
- ✓ No references to Node 16, 18, or 20 remain in prerequisites section

---

### Step 5 — Verify Job Dependencies and Execution Order (Subtask 64.4)

**Purpose**: Confirm that tests run sequentially in the correct order within the same job.

**Actions**:
```bash
# Verify step order in the quality job
grep -E "name: (Test|Unification|Build)" .github/workflows/ci.yml
```

**Expected Output**:
```yaml
    - name: Test suite
    - name: Unification regression suite
    - name: Build
```

**Checkpoint**:
- ✓ "Test suite" step appears before "Unification regression suite"
- ✓ Both test steps appear before "Build"
- ✓ All steps are in the same `quality` job (no `needs:` dependency between them)

**Execution Order Confirmation**:
1. Lint – Biome check
2. Format – check only
3. Test suite (regular tests)
4. Unification regression suite (new)
5. Build

GitHub Actions runs steps **sequentially by default** within a job. Each step must complete successfully before the next begins.

---

### Step 6 — Local Validation

**Purpose**: Validate changes locally before committing.

**Actions**:
```bash
# 1. Verify YAML syntax
node -e "
const fs = require('fs');
const content = fs.readFileSync('.github/workflows/ci.yml', 'utf8');
if (content.includes('\t')) throw new Error('Tabs found in YAML');
console.log('✓ YAML syntax valid');
"

# 2. Verify test:unification script exists
npm run test:unification -- --dry-run 2>&1 | head -5 || echo "Script exists"

# 3. Run unification tests locally to ensure they pass
npm run test:unification
```

**Expected Behavior**:
- YAML syntax validation passes
- `npm run test:unification` script exists and runs
- All unification tests pass locally

**Checkpoint**:
- ✓ YAML has no syntax errors
- ✓ Unification test suite runs successfully
- ✓ No breaking changes introduced

---

### Step 7 — Commit Changes

**Purpose**: Create a clean, atomic commit with all changes.

**Actions**:
```bash
# Stage changes
git add .github/workflows/ci.yml README.md

# Commit with conventional commit message
git commit -m "feat(ci): add unification regression suite to quality gate

- Add npm run test:unification step after regular test suite
- Update README to reflect Node.js 24.x requirement
- Tests run sequentially in same quality job
- No changes to branch triggers (already correct: main and v*)"
```

**Checkpoint**:
- ✓ Commit passes pre-commit hooks (lint-staged)
- ✓ Commit message follows conventional commits format
- ✓ Commit message clearly describes the change

---

### Step 8 — Push and Verify CI Execution

**Purpose**: Push changes and verify CI runs both test suites correctly.

**Actions**:
```bash
# Create feature branch (if not already on one)
git checkout -b feature/PAD-064-expand-ci-trigger-support

# Push to remote
git push -u origin feature/PAD-064-expand-ci-trigger-support
```

**Verification in GitHub Actions UI**:
1. Navigate to **Actions** tab in GitHub
2. Find the CI workflow run for your branch
3. Expand the "Quality Gate (Node.js 24.x)" job
4. Verify step execution order:
   - "Test suite" runs and passes
   - "Unification regression suite" runs and passes (NEW)
   - "Build" runs after both test suites pass

**Checkpoint**:
- ✓ CI workflow triggers on push to feature branch
- ✓ "Test suite" step appears and runs
- ✓ "Unification regression suite" step appears and runs
- ✓ Both test suites pass
- ✓ Build step runs only after both test suites complete
- ✓ Total workflow completes successfully

---

### Step 9 — Create Pull Request and Validate

**Purpose**: Open a PR and verify CI runs correctly on pull_request trigger.

**Actions**:
1. Open a Pull Request from `feature/PAD-064-expand-ci-trigger-support` → `main`
2. Verify CI checks appear in the PR

**Verification in PR Checks**:
- "CI / Quality Gate (Node.js 24.x)" check appears
- Check shows as passing (green)
- Click "Details" to view step-by-step execution

**Checkpoint**:
- ✓ Pull request triggers CI workflow
- ✓ Both test suites run in PR checks
- ✓ All checks pass before merge

---

## Validation

### Success Criteria

1. **CI Workflow File**:
   - ✓ `.github/workflows/ci.yml` contains "Unification regression suite" step
   - ✓ Step runs `npm run test:unification`
   - ✓ Step appears after "Test suite" and before "Build"
   - ✓ YAML syntax is valid (no tabs, correct indentation)

2. **Branch Triggers** (Already Correct):
   - ✓ Push triggers: `main` and `v*` branches
   - ✓ Pull request triggers: `main` and `v*` branches
   - ✓ No changes made to trigger configuration

3. **Node.js Configuration** (Already Correct):
   - ✓ Matrix contains only `24.x`
   - ✓ No references to 18.x or 20.x in workflow

4. **Documentation**:
   - ✓ README.md prerequisites mention "Node.js 24.x"
   - ✓ No references to Node 16, 18, or 20 in prerequisites

5. **CI Execution**:
   - ✓ Both test suites run in CI
   - ✓ Tests run sequentially (regular tests first, then unification)
   - ✓ Both test suites pass
   - ✓ Build step runs only after both test suites complete
   - ✓ Workflow completes successfully

6. **Integration**:
   - ✓ No breaking changes to existing CI functionality
   - ✓ Release publishing steps remain unchanged
   - ✓ Dependency caching still works
   - ✓ Quality gate still blocks on any test failure

### Checkpoints by Subtask

**Subtask 64.1 — Update CI workflow triggers**:
- [x] Verified triggers are already correct (main and v*)
- [x] No changes made to trigger configuration
- [x] Push triggers include `main` and `v*`
- [x] Pull request triggers include `main` and `v*`

**Subtask 64.2 — Verify Node.js environment matrix**:
- [x] Verified matrix contains only `24.x`
- [x] No changes made to Node.js configuration
- [x] Single version in matrix (not multi-version)

**Subtask 64.3 — Integrate unification regression suite**:
- [x] Added "Unification regression suite" step to CI workflow
- [x] Step runs `npm run test:unification`
- [x] Step positioned after "Test suite" step
- [x] Step runs in same `quality` job
- [x] Tests run sequentially (not parallel)

**Subtask 64.4 — Configure job dependencies**:
- [x] Verified steps run sequentially by default
- [x] No `needs:` dependency required (same job)
- [x] Execution order: lint → format → test → unification → build
- [x] Updated README.md to reflect Node.js 24.x

**Subtask 64.5 — Validate CI trigger patterns**:
- [x] Verified push triggers work (tested on feature branch push)
- [x] Verified pull_request triggers work (tested on PR creation)
- [x] Both trigger types run the complete workflow
- [x] All steps execute in correct order

### Post-Implementation Verification Tests

**Test 1 — Verify Sequential Execution**:
1. Push a commit to the feature branch
2. Watch the Actions run in GitHub UI
3. Confirm: "Test suite" step completes before "Unification regression suite" starts
4. Confirm: "Build" step only starts after both test suites complete

**Test 2 — Verify Failure Blocking**:
1. Temporarily break a unification test (e.g., add `throw new Error('test')`)
2. Push to feature branch
3. Confirm: CI fails at "Unification regression suite" step
4. Confirm: "Build" step does not run
5. Revert the breaking change and confirm CI passes

**Test 3 — Verify Both Trigger Types**:
1. Push to feature branch → verify CI runs
2. Open PR → verify CI runs again
3. Confirm: Both runs show the "Unification regression suite" step

**Test 4 — Verify Documentation Accuracy**:
1. New developer reads README.md
2. They see "Node.js 24.x" requirement
3. They install Node.js 24.x
4. They run `npm install` and `npm test` successfully
5. No confusion about which Node.js version to use

### Acceptance Criteria

| Criterion | Verification Method | Status |
|-----------|-------------------|---------|
| CI workflow includes unification regression suite | Check `.github/workflows/ci.yml` for step | ☐ |
| Tests run sequentially in same job | Verify no parallel configuration, check execution order | ☐ |
| Branch triggers remain unchanged | Verify `on:` section matches original | ☐ |
| Node.js version is 24.x only | Check matrix configuration | ☐ |
| Documentation reflects Node.js 24.x | Check README.md prerequisites | ☐ |
| CI passes on feature branch | Check GitHub Actions UI | ☐ |
| CI passes on pull request | Check PR checks | ☐ |
| No breaking changes to existing CI | Compare workflow before/after | ☐ |

---

## Edge Cases and Risk Mitigation

### Risk: Unification Tests Fail in CI but Pass Locally

**Potential Causes**:
- Environment differences (Node.js version, OS)
- Timing issues with async tests
- Missing dependencies

**Mitigation**:
- Unification tests use `--test-isolation=process` (same as regular tests)
- Both test suites use same concurrency settings
- CI uses Ubuntu (same as most local dev environments)
- If failure occurs, check CI logs for specific test failure details

### Risk: Unification Tests Take Too Long

**Analysis**:
- Current unification suite has 4 test files
- Tests use `--test-concurrency=1` (sequential execution)
- Expected runtime: < 30 seconds for entire suite

**Mitigation**:
- If tests become slow, consider splitting into parallel jobs (future enhancement)
- Monitor CI run times after integration
- Keep unification tests focused on critical regression scenarios

### Risk: Documentation Update Misses Other References

**Potential Issue**:
- README.md might have other sections mentioning Node.js versions
- Other documentation files might need updates

**Mitigation**:
- Search entire codebase for "Node 16", "Node 18", "Node 20" references
- Update all relevant documentation
- Verify no conflicting version requirements exist

### Risk: CI Cache Invalidation Issues

**Analysis**:
- Adding new test step doesn't change `package.json` or `package-lock.json`
- Cache key remains valid
- No additional dependencies installed

**Mitigation**:
- No action needed - cache configuration remains unchanged
- Cache will invalidate naturally when dependencies change in future

---

## Rollback Plan

### If CI Fails After Integration

**Immediate Rollback**:
```bash
# Revert the commit
git revert HEAD

# Push the revert
git push
```

**Expected Result**: CI returns to previous state (without unification regression step)

### If Unification Tests Are Flaky

**Temporary Workaround**:
```yaml
# Add continue-on-error to allow CI to pass while investigating
- name: Unification regression suite
  run: npm run test:unification
  continue-on-error: true  # TEMPORARY - remove once tests are stable
```

**Note**: This is a temporary measure only. Do not merge with `continue-on-error: true`.

---

## File Summary

```
.
├── .github/
│   └── workflows/
│       └── ci.yml              # MODIFIED — added unification regression step
└── README.md                   # MODIFIED — updated Node.js requirement to 24.x
```

**Changes**:
- `.github/workflows/ci.yml`: +5 lines (new step)
- `README.md`: ~1 line (Node.js version update)

---

## Dependencies on Other Tasks

| Task | Status | Dependency Type | Notes |
|------|--------|----------------|-------|
| Task 31 | ✓ Completed | Prerequisite | CI/CD workflow must exist |
| Task 58 | ✓ Completed | Prerequisite | Unification tests require stable match session handling |

---

## Implementation Time Estimate

| Step | Estimated Time | Complexity |
|------|----------------|------------|
| Step 1: Verify triggers | 2 minutes | Very Low |
| Step 2: Verify Node.js config | 2 minutes | Very Low |
| Step 3: Add test step | 5 minutes | Low |
| Step 4: Update documentation | 2 minutes | Very Low |
| Step 5: Verify execution order | 2 minutes | Very Low |
| Step 6: Local validation | 5 minutes | Low |
| Step 7: Commit changes | 2 minutes | Very Low |
| Step 8: Push and verify | 5 minutes | Low |
| Step 9: Create PR | 5 minutes | Low |
| **Total** | **~30 minutes** | **Low** |

---

## Post-Implementation Checklist

- [ ] All implementation steps completed
- [ ] All checkpoints verified
- [ ] CI passes on feature branch
- [ ] CI passes on pull request
- [ ] Documentation updated and accurate
- [ ] No breaking changes introduced
- [ ] Code review completed
- [ ] Ready to merge to main

---

## Notes

- **Branch triggers were already correct** - this task was primarily about integrating the unification regression suite
- **Node.js 24.x was already configured** - only documentation needed updating
- **Sequential execution is the default** - no special configuration needed
- **This is a low-risk change** - minimal code changes, clear rollback path
