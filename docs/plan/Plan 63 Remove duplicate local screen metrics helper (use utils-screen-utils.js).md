# Plan 63: Remove Duplicate Local Screen Metrics Helper

## Task Analysis

### Main Objective
Consolidate duplicate screen metrics helper implementations into the centralized `utils/screen-utils.js` file, eliminating code duplication and ensuring consistent screen dimension access across the codebase.

### Identified Dependencies
- **Task #41**: ~~Created~~ **COMPLETED** - `utils/screen-utils.js` exists with `getScreenMetrics()`, `clamp()`, `ensureNumber()`, `pct()`, and round screen inset helpers
- **Affected files**:
  - `page/game.js` - contains local `getScreenMetrics()` method
  - `utils/ui-components.js` - contains local `getScreenDimensions()` function
  - `utils/design-tokens.js` - contains local `ensureNumber()` function and inline screen width retrieval

### System Impact
- Low risk refactor - replacing duplicate implementations with imports from existing utility
- No algorithm changes - only code consolidation
- All affected files are utility/helper modules, not core business logic

### User Clarifications (Updated)

| Clarification | Decision |
|---------------|----------|
| **Scope** | Focus ONLY on actual duplicates found: `getScreenMetrics()`, `getScreenDimensions()`, `ensureNumber()`. DPR and orientation helpers NOT needed (not used anywhere). |
| **Backward Compatibility** | Clean replacement - no backward compatibility required. Remove all duplicate code. |
| **Testing Approach** | Implement BOTH unit tests AND UI/layout testing equally. |
| **Task #41 Status** | Complete - can proceed immediately. |
| **Physical Device Testing** | User has Round and Square devices available for testing. |

### Duplicate Implementations Found

| Location | Function | Returns | Used By |
|----------|----------|---------|---------|
| `page/game.js:339-350` | `getScreenMetrics()` | `{width, height}` | GamePage class methods |
| `utils/ui-components.js:31-43` | `getScreenDimensions()` | `{width, height}` | `createBackground`, `createDivider`, `createText`, `createButton` |
| `utils/design-tokens.js:19-21` | `ensureNumber()` | number | `getColor`, `getFontSize` |
| `utils/design-tokens.js:137-145` | inline | screenWidth | `getFontSize` |

### Key Finding: Proposed Functions Not Needed
The task description proposed adding `getDPR()` and `getOrientation()` functions, but codebase analysis found:
- **No DPR (device pixel ratio) usage** anywhere in the codebase
- **No screen orientation detection** - only divider orientation (horizontal/vertical) in UI components

Following YAGNI principle, these functions should **NOT** be added unless a concrete use case emerges.

---

## Chosen Approach

### Proposed Solution
Replace all local screen metrics implementations with imports from `utils/screen-utils.js`:

1. **`page/game.js`**: Remove local `getScreenMetrics()` method, add import, update all call sites
2. **`utils/ui-components.js`**: Remove local `getScreenDimensions()` function, add import
3. **`utils/design-tokens.js`**: Remove local `ensureNumber()` function, add import, refactor inline screen retrieval

### Justification for Simplicity
- **No new functions needed** - existing `getScreenMetrics()` already provides required functionality
- **Minimal changes** - only 3 files need modification
- **No algorithm changes** - purely code consolidation
- **Clean replacement** - no backward compatibility baggage

### Components to be Modified

| File | Change Type | Risk |
|------|-------------|------|
| `page/game.js` | Remove method, add import + destructuring | Low |
| `utils/ui-components.js` | Remove function, add import | Low |
| `utils/design-tokens.js` | Remove function, add import, refactor inline code | Low |

---

## Implementation Steps

### Step 1: Audit Verification (Subtask 63.1)
**Goal**: Confirm all duplicate implementations are identified

1.1. Run grep search to verify no missed implementations:
```bash
grep -r "hmSetting.getDeviceInfo" --include="*.js" page/ utils/
grep -r "getScreenDimensions\|getScreenMetrics" --include="*.js" page/ utils/
```

1.2. Document findings in this plan (completed above)

**Validation**: No additional duplicates found beyond documented locations

---

### Step 2: Update utils/ui-components.js (Subtask 63.4)
**Goal**: Replace local `getScreenDimensions()` with centralized import

2.1. Add import at top of file:
```javascript
import { getScreenMetrics } from './screen-utils.js'
```

2.2. Remove local `getScreenDimensions()` function (lines 31-43)

2.3. Update all call sites to use destructuring:
```javascript
// Before
const { width, height } = getScreenDimensions()

// After  
const { width, height } = getScreenMetrics()
```

**Affected functions**:
- `createBackground()` (line 61)
- `createDivider()` (line 104)
- `createText()` (line 158)
- `createButton()` (line 265)

**Validation**: File compiles, no syntax errors

---

### Step 3: Update utils/design-tokens.js (Subtask 63.4)
**Goal**: Replace local `ensureNumber()` and inline screen retrieval with centralized imports

3.1. Add import at top of file:
```javascript
import { getScreenMetrics, ensureNumber } from './screen-utils.js'
```

3.2. Remove local `ensureNumber()` function (lines 19-21)

3.3. Update `getFontSize()` to use centralized metrics (lines 137-145):
```javascript
// Before
let screenWidth = 390
if (typeof hmSetting !== 'undefined' && typeof hmSetting.getDeviceInfo === 'function') {
  const deviceInfo = hmSetting.getDeviceInfo()
  screenWidth = ensureNumber(deviceInfo?.width, 390)
}

// After
const { width } = getScreenMetrics()
const screenWidth = width
```

**Validation**: File compiles, no syntax errors

---

### Step 4: Update page/game.js (Subtask 63.3)
**Goal**: Replace local `getScreenMetrics()` method with centralized import

4.1. Add import at top of file:
```javascript
import { getScreenMetrics } from '../utils/screen-utils.js'
```

4.2. Remove local `getScreenMetrics()` method (lines 339-350)

4.3. Update all call sites in the GamePage class:
```javascript
// Before
const { width, height } = this.getScreenMetrics()

// After
const { width, height } = getScreenMetrics()
```

**Note**: Need to verify all call sites within the class use `this.getScreenMetrics()`

**Validation**: File compiles, no syntax errors

---

### Step 5: Unit Testing (NEW - Per User Clarification)
**Goal**: Create unit tests for the consolidation

5.1. Create/update test file for screen-utils:
```javascript
// test/screen-utils.test.js
describe('screen-utils consolidation', () => {
  it('getScreenMetrics returns width and height', () => {
    const metrics = getScreenMetrics()
    expect(metrics).toHaveProperty('width')
    expect(metrics).toHaveProperty('height')
    expect(typeof metrics.width).toBe('number')
    expect(typeof metrics.height).toBe('number')
  })
  
  it('ensureNumber returns fallback for invalid values', () => {
    expect(ensureNumber(null, 100)).toBe(100)
    expect(ensureNumber(undefined, 100)).toBe(100)
    expect(ensureNumber(50, 100)).toBe(50)
  })
})
```

5.2. Test imports work correctly:
```javascript
describe('imports from screen-utils', () => {
  it('ui-components imports getScreenMetrics', () => {
    // Verify the import path resolves
  })
  
  it('design-tokens imports getScreenMetrics and ensureNumber', () => {
    // Verify the import path resolves
  })
  
  it('game.js imports getScreenMetrics', () => {
    // Verify the import path resolves
  })
})
```

**Validation**: `npm test` passes all unit tests

---

### Step 6: UI/Layout Testing (Per User Clarification)
**Goal**: Verify no visual regressions on both screen types

6.1. **Simulator Testing**:
- Build for round screen simulator (GTR 3)
- Build for square screen simulator (GTS 3)
- Navigate through all screens

6.2. **Physical Device Testing** (User has devices available):
- Test on physical Round device
- Test on physical Square device
- Compare layouts before/after - should be identical

**Testing Screens**:
- [ ] Home screen renders correctly
- [ ] Game screen renders correctly
- [ ] Score buttons are responsive
- [ ] Navigation between screens works
- [ ] Round screen safe areas respected
- [ ] Square screen layouts correct

**Validation**: No visual differences on simulators and physical devices

---

### Step 7: Verify Consolidation (Subtask 63.5)
**Goal**: Confirm all duplicates removed and functionality preserved

7.1. Run grep verification:
```bash
# Should only find references in screen-utils.js and imports
grep -r "hmSetting.getDeviceInfo" --include="*.js" page/ utils/

# Should only find imports from screen-utils.js
grep -r "getScreenDimensions" --include="*.js" page/ utils/
```

7.2. Run full test suite:
```bash
npm run complete-check
```

**Validation**: 
- No duplicate implementations found by grep
- All tests pass
- No visual regressions on simulators and physical devices

---

## Validation

### Success Criteria
1. **No duplicates**: Only `utils/screen-utils.js` contains screen metrics retrieval logic
2. **All imports correct**: All affected files import from `utils/screen-utils.js`
3. **Unit tests pass**: All new and existing unit tests pass
4. **UI tests pass**: No visual regressions on simulators
5. **Physical device tests pass**: No visual regressions on Round and Square devices
6. **Complete check passes**: `npm run complete-check` completes without errors

### Checkpoints

| Checkpoint | Step | Verification Method |
|------------|------|---------------------|
| Audit complete | 1 | Grep confirms all duplicates documented |
| ui-components updated | 2 | Import present, local function removed |
| design-tokens updated | 3 | Import present, local function removed |
| game.js updated | 4 | Import present, local method removed |
| Unit tests created | 5 | `npm test` passes |
| UI/Layout tested | 6 | Simulators and physical devices verified |
| Consolidation verified | 7 | Grep finds no duplicates, all tests pass |

### Rollback Notes
If issues arise, each file can be independently reverted:
1. Git revert specific file changes
2. Each change is isolated to a single file
3. No interdependencies between file changes

---

## Test Strategy

### Code Review Verification
```bash
# Verify no direct hmSetting.getDeviceInfo() calls (except in screen-utils.js)
grep -rn "hmSetting.getDeviceInfo" --include="*.js" page/ utils/ | grep -v "screen-utils.js"

# Verify no local getScreenDimensions implementations
grep -rn "function getScreenDimensions" --include="*.js" page/ utils/

# Verify correct imports exist
grep -rn "from.*screen-utils" --include="*.js" page/ utils/
```

### Unit Tests (Equal Priority)
1. **Create test file**: `test/screen-utils-consolidation.test.js`
2. **Test coverage**:
   - `getScreenMetrics()` returns valid width/height
   - `ensureNumber()` handles null, undefined, valid values
   - Import paths resolve correctly
   - No runtime errors from missing imports
3. **Run tests**: `npm test`

### UI Layout Testing (Equal Priority)
1. **Simulator Testing**:
   - Round screen simulator (GTR 3)
   - Square screen simulator (GTS 3)

2. **Physical Device Testing** (Available):
   - Physical Round device
   - Physical Square device

3. **Test Navigation**:
   - Home screen
   - Game screen
   - Summary screen
   - Settings screen

4. **Compare layouts** before/after - should be identical

### Functional Testing Checklist
- [ ] Home screen renders correctly (simulator)
- [ ] Game screen renders correctly (simulator)
- [ ] Score buttons are responsive (simulator)
- [ ] Navigation between screens works (simulator)
- [ ] Round screen safe areas respected (simulator)
- [ ] Square screen layouts correct (simulator)
- [ ] Home screen renders correctly (physical Round)
- [ ] Game screen renders correctly (physical Round)
- [ ] Home screen renders correctly (physical Square)
- [ ] Game screen renders correctly (physical Square)

---

## Files Changed Summary

| File | Lines Removed | Lines Added | Net Change |
|------|---------------|-------------|------------|
| `page/game.js` | ~12 | ~1 | -11 |
| `utils/ui-components.js` | ~13 | ~1 | -12 |
| `utils/design-tokens.js` | ~10 | ~3 | -7 |
| `test/screen-utils-consolidation.test.js` | 0 | ~30 | +30 |
| **Total** | ~35 | ~35 | **0** (consolidated) |

**Result**: ~30 lines of duplicate code removed, single source of truth established, test coverage added.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Missed call site | Low | Medium | Comprehensive grep search before changes |
| Import path error | Low | Low | Build will fail immediately |
| Test environment mock | Low | Medium | screen-utils.js already has fallback for test env |
| Visual regression | Very Low | Medium | Test on simulators AND physical devices |
| Unit test failure | Low | Low | Tests validate the consolidation |

**Overall Risk**: **Low** - Straightforward consolidation with comprehensive testing strategy

---

## Scope Clarification

### What This Task DOES
- Consolidate `getScreenMetrics()` from `page/game.js` into centralized import
- Consolidate `getScreenDimensions()` from `utils/ui-components.js` into centralized import
- Consolidate `ensureNumber()` from `utils/design-tokens.js` into centralized import
- Remove inline screen width retrieval in `utils/design-tokens.js`

### What This Task DOES NOT
- ❌ Add `getDPR()` function - not used anywhere in codebase (YAGNI)
- ❌ Add `getOrientation()` function - not used anywhere in codebase (YAGNI)
- ❌ Maintain backward compatibility with old function names
- ❌ Add any new functionality beyond consolidation

### Rationale
The original task description mentioned DPR and orientation helpers, but codebase analysis confirmed these are not needed. Following YAGNI (You Aren't Gonna Need It) principle, we only consolidate what exists and is actually used.
