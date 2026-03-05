# Execution Plan: Update PRDs for Confirmed Decisions and Zepp v1 Lifecycle Semantics

**Task ID:** 67  
**Created:** 2026-03-05  
**Status:** Planning Complete  
**Dependencies:** Task #53 (done), Task #65 (done)

---

## Task Analysis

### Main Objective
Update all Product Requirement Documents (PRDs) in the `docs/` directory to reflect confirmed product decisions from the deep review session and ensure all documentation uses Zepp OS v1.0-compatible lifecycle terminology consistently.

### Identified Dependencies
- **Task #53 (done)**: Canonical state and storage contract - provides foundation for lifecycle documentation
- **Task #65 (done)**: Release workflow updates - provides actual release branching policy to document
- **Task #32 (done)**: Lifecycle audit - provides v1.0 lifecycle constraints and removed methods
- **Existing PRD files**: All must be reviewed and updated for consistency

### System Impact
- **Documentation only** - No code changes
- **5 PRD files** require updates (PRD.md, PRD-QA-Remediation-v1.1.md, PRD-Finish-Match.md, PRD-Review.md, PRD-Refactor-Layout.md)
- **Cross-reference integrity** must be maintained across all PRDs
- **PRD-Review.md** will serve as the authoritative source for confirmed decisions
- **Stakeholder review** required after updates

### Confirmed Product Decisions to Document

1. **Match History Scope**
   - Status: **IN SCOPE** (contradicts current PRD.md Section 12)
   - Storage: Implemented in `page/history.js`, `page/history-detail.js`, `utils/match-storage.js`
   - Features: View completed matches, delete matches, view match details
   - Reference: Task #29 implementation

2. **Summary Screen Requirements**
   - Status: **NO "Start New Game" button** (contradicts PRD-QA-Remediation-v1.1.md FR-6)
   - Correct flow: Users start new games from Home Screen only
   - Summary screen actions: Return to Home only

3. **Release Branching Policy**
   - **Main branch releases**: Feature releases (tag format: X.Y.Z)
   - **Version branches (v*)**: Maintenance and hotfixes (tag format: X.Y.Z+patch)
   - Reference: Task #65 implementation, RELEASE.md

4. **Zepp OS v1 Lifecycle Semantics**
   - **Available methods**: `onInit(params)`, `build()`, `onDestroy()`
   - **NOT available**: `onShow`, `onHide`, `onResume`, `onPause`
   - **Persistence triggers**: Use `onDestroy` for state persistence
   - **State restoration**: `onInit` + `build()` on every page navigation
   - Reference: Task #32 lifecycle audit, `.taskmaster/notes/lifecycle-audit-summary.md`

---

## Chosen Approach

### Proposed Solution
**Hybrid Documentation Strategy**: Update PRD-Review.md to be the comprehensive single source of truth for all confirmed decisions, then systematically update each individual PRD file with:
1. Version metadata headers
2. Cross-references to PRD-Review.md for shared decisions
3. Direct corrections of contradictory statements
4. Zepp OS v1.0 lifecycle terminology corrections

### Justification for Simplicity
1. **Single source of truth** (PRD-Review.md) prevents decision drift and duplication
2. **Minimal updates to other PRDs** reduces maintenance burden and risk of inconsistencies
3. **Systematic, sequenced approach** allows for incremental validation
4. **Clear cross-references** ensure readers can find comprehensive decision context
5. **Version metadata** enables tracking of when changes were made and why

### Alternative Approaches Considered

**Approach A: Duplicate all decisions in every PRD**
- ❌ Rejected: Creates maintenance burden, high risk of inconsistency
- Would require updating N PRDs every time a decision changes

**Approach B: Complete PRD rewrite**
- ❌ Rejected: Overengineered for documentation-only task
- High effort, introduces risk of losing context

**Approach C: Minimal updates only**
- ❌ Rejected: Leaves confusing contradictions in PRDs
- Doesn't provide clear guidance for future development

### Components to be Modified/Created

**Modified Files (5 PRD documents):**
1. `docs/PRD-Review.md` - Master decision document
2. `docs/PRD.md` - Main product requirements
3. `docs/PRD-QA-Remediation-v1.1.md` - QA reliability enhancements
4. `docs/PRD-Finish-Match.md` - Manual match finish
5. `docs/PRD-Refactor-Layout.md` - Layout refactor

**Reference Materials (read-only):**
- `.taskmaster/notes/lifecycle-audit-summary.md` - v1.0 lifecycle constraints
- `RELEASE.md` - Release branching policy (already updated)
- `page/history.js`, `page/history-detail.js` - Match history implementation

---

## Implementation Steps

### Pre-Implementation Validation

**Step 0: Backup and Preparation**
- Create a backup understanding of current PRD state
- Confirm all dependency tasks (#53, #65) are complete
- Verify reference materials are accessible

**Validation Checkpoint 0:**
- [ ] All 5 PRD files readable and accessible
- [ ] `.taskmaster/notes/lifecycle-audit-summary.md` accessible
- [ ] `RELEASE.md` contains dual-branch policy
- [ ] No active PRs that would conflict with documentation updates

---

### Phase 1: Update PRD-Review.md (Master Decision Document)

**Step 1: Add version metadata to PRD-Review.md**
- Add header: `Version: 1.1 | Updated: 2026-03-05 | Task: #67`
- Document the purpose of this file as the single source of truth

**Step 2: Enhance Section 1 (Title and Metadata)**
- Add explicit statement: "This document is the authoritative source for all confirmed product decisions"
- Add reference to how other PRDs should use this document

**Step 3: Expand Confirmed Product Decisions section**
Add detailed documentation for each decision:

**3.1 Match History Scope**
```markdown
#### Match History Scope
**Decision**: Match history is IN SCOPE for v1.0
**Previous status**: Listed as "Out of Scope" in original PRD.md Section 12
**Correction date**: 2026-03-05

**Features included**:
- View list of completed matches
- View detailed match results (sets, games, scores)
- Delete individual matches from history
- Persistent storage across app restarts

**Implementation references**:
- UI: `page/history.js`, `page/history-detail.js`
- Storage: `utils/match-storage.js` (history functions)
- Data: Match history persisted separately from active session

**Acceptance**: Any PRD stating match history is out of scope is outdated
```

**3.2 Summary Screen Requirements**
```markdown
#### Summary Screen Requirements
**Decision**: Summary screen does NOT require "Start New Game" button
**Rationale**: New game flow is handled exclusively from Home Screen
**Correction date**: 2026-03-05

**Correct behavior**:
- Summary screen shows: winner, final scores, set history
- Summary screen actions: Return to Home only
- New game flow: Home Screen → Start New Game → Setup → Game

**Implementation references**:
- Summary page: `page/summary.js`
- Home page: `page/index.js`

**Acceptance**: Any PRD requiring "Start New Game" on summary is incorrect
```

**3.3 Release Branching Policy**
```markdown
#### Release Branching Policy
**Decision**: Dual-stream release approach with main and version branches
**Implementation date**: 2026-03-05 (Task #65)

**Release streams**:
1. **Main branch (`main`)**: Feature releases
   - Trigger: Push/merge to main
   - Tag format: `vX.Y.Z` (semantic versioning)
   - Examples: `v1.0.0`, `v1.1.0`, `v2.0.0`
   
2. **Version branches (`v*`)**: Maintenance and hotfix releases
   - Pattern: `v1.0.x`, `v1.1.x`, etc.
   - Tag format: `vX.Y.Z+patch` (patch metadata)
   - Examples: `v1.0.1`, `v1.0.2`, `v1.1.1`

**Implementation references**:
- Workflow: `.github/workflows/release.yml`
- Config: `.releaserc.json`
- Documentation: `RELEASE.md`

**Acceptance**: All PRDs must reference this dual-stream approach
```

**3.4 Zepp OS v1 Lifecycle Semantics**
```markdown
#### Zepp OS v1.0 Lifecycle Semantics
**Decision**: Use only Zepp OS v1.0-compatible lifecycle methods
**Audit completion**: 2026-02-23 (Task #32)

**Available lifecycle methods**:
- `onInit(params)`: Page initialization, parse params, load data
- `build()`: Create UI widgets, render screen
- `onDestroy()`: Cleanup, persist state, release resources

**NOT available in v1.0** (removed in Task #32):
- `onShow()` - Not supported, pages are destroyed/recreated on navigation
- `onHide()` - Not supported, use `onDestroy()` for exit logic
- `onResume()` - Not supported, no page-stack persistence
- `onPause()` - Not supported, use `onDestroy()` for state persistence

**State persistence pattern**:
- **Entry**: `onInit()` → load persisted state
- **Exit**: `onDestroy()` → save current state
- **Navigation**: Always triggers destroy → init → build cycle

**Implementation references**:
- Audit summary: `.taskmaster/notes/lifecycle-audit-summary.md`
- Removed from: `page/index.js`, `page/setup.js`, `page/summary.js`, `page/game.js`
- Test update: `tests/home-screen.test.js`

**Acceptance**: Any PRD referencing `onShow/onHide/onResume/onPause` must be corrected
```

**Step 4: Add cross-reference guidance section**
```markdown
## How to Use This Document

This PRD-Review.md is the **single source of truth** for confirmed product decisions.

**For other PRDs**:
- Reference this document for shared decisions
- Do not duplicate decision details in individual PRDs
- Add "See PRD-Review.md Section X" for relevant decisions
- Update this document if new decisions are confirmed

**For developers**:
- Check this document before implementing features
- If implementation contradicts this document, escalate for clarification
- Update this document when product decisions change

**For stakeholders**:
- This document reflects the latest confirmed product direction
- Individual PRDs may contain outdated information if not yet updated
- Always reference this document for current decisions
```

**Validation Checkpoint 1:**
- [ ] PRD-Review.md has version metadata
- [ ] All 4 confirmed decisions documented with full details
- [ ] Cross-reference guidance section added
- [ ] No contradictions within PRD-Review.md itself
- [ ] File reads clearly as authoritative source

---

### Phase 2: Update PRD.md (Main Product Requirements)

**Step 5: Add version metadata to PRD.md**
- Add header: `Version: 1.1 | Updated: 2026-03-05 | Task: #67`
- Note: "For confirmed product decisions, see PRD-Review.md"

**Step 6: Fix Section 12 (Non-Goals)**
- **Current text**: "Match history"
- **Corrected text**: ~~"Match history"~~ (removed)
- **Add note**: "Note: Match history is now in scope. See PRD-Review.md Section 3.1 for details."

**Step 7: Update Section 7.2 (Persistence Rules)**
- Add clarification about lifecycle triggers:
```markdown
### 7.2 Persistence Rules

State must be saved:
- On every score change
- When navigating away from Game Screen
- When the app is backgrounded (via `onDestroy` lifecycle callback)
- **Note**: Uses Zepp OS v1.0 lifecycle - see PRD-Review.md Section 3.4

State must be restored:
- On app reopen (via `onInit` lifecycle callback)
- On "Resume Game"
- **Note**: Pages are destroyed and recreated on each navigation in Zepp OS v1.0
```

**Step 8: Update Section 13 (Future Enhancements)**
- Remove "Match history" from future enhancements list (now implemented)
- Add reference to implemented features

**Validation Checkpoint 2:**
- [ ] Version metadata present
- [ ] Section 12 no longer lists match history as out of scope
- [ ] Section 7.2 references Zepp OS v1.0 lifecycle
- [ ] Section 13 updated to reflect implemented features
- [ ] No remaining contradictions with confirmed decisions

---

### Phase 3: Update PRD-QA-Remediation-v1.1.md

**Step 9: Add version metadata**
- Add header: `Version: 1.1 | Updated: 2026-03-05 | Task: #67`
- Note: "For confirmed product decisions, see PRD-Review.md"

**Step 10: Fix Section 3.2 (Out of Scope)**
- **Current text**: "Match history across multiple completed matches"
- **Clarification needed**: This refers to "match history viewing" vs "cross-match analytics"
- **Corrected interpretation**: Add clarifying note:
```markdown
### 3.2 Out of Scope

- Player names and roster management
- **Match history viewing and persistence** - ✅ IN SCOPE (see PRD-Review.md Section 3.1)
  - Note: "Match history" in original context referred to advanced analytics 
    across multiple matches, not basic history viewing which is implemented
- Cloud sync and phone companion sync
- Tie-break rule configuration
```

**Step 11: Fix Section 5 FR-6 (Match Summary Screen)**
- **Current text**: Lists "Start New Game" as summary action
- **Corrected text**:
```markdown
### FR-6: Match Summary Screen

When match status is `finished`, app must show a summary screen containing:
- winner
- final set points (Team A vs Team B)
- list of all played sets with per-set game results (example: `Set 1: 6-4`)

Summary screen actions:
- `Home` (return to Home Screen)
- **Note**: "Start New Game" is NOT on summary screen. Users start new games 
  from Home Screen only. See PRD-Review.md Section 3.2.
```

**Step 12: Add lifecycle notes to Section 5 FR-1**
```markdown
### FR-1: Active Match Persistence Across Lifecycle

The app must persist active match state to local storage:
- after every scoring action (add/remove point)
- after set transitions
- when navigating away from Game
- when app/page lifecycle events indicate interruption
  - **Note**: In Zepp OS v1.0, this is handled via `onDestroy()` callback
  - See PRD-Review.md Section 3.4 for lifecycle semantics

The persisted state must include enough data to restore the exact match context.
```

**Validation Checkpoint 3:**
- [ ] Version metadata present
- [ ] Section 3.2 clarifies match history scope
- [ ] Section 5 FR-6 no longer lists "Start New Game"
- [ ] Section 5 FR-1 references v1.0 lifecycle
- [ ] No remaining contradictions

---

### Phase 4: Update PRD-Finish-Match.md

**Step 13: Add version metadata**
- Add header: `Version: 1.0 | Updated: 2026-03-05 | Task: #67`
- Note: "For confirmed product decisions, see PRD-Review.md"

**Step 14: Add lifecycle compatibility note to Section 5**
```markdown
### 5.5 Lifecycle Parity with Normal Finish

Manual finish must behave the same as scoring-based finish in lifecycle outcomes:
- Navigate to Summary screen
- Persist finished match state
  - **Note**: Persistence triggered via `onDestroy()` in Zepp OS v1.0
  - See PRD-Review.md Section 3.4
- Save match to history
- Ensure no resumable active match appears on Home
```

**Step 15: Add lifecycle note to Section 6 (Edge Cases)**
```markdown
## 6. Edge Cases

- Prevent duplicate append of current set snapshot if action is triggered twice
- Ensure confirmation timer is cleared on navigation and `onDestroy()`
  - **Note**: `onDestroy()` is the only cleanup lifecycle in Zepp OS v1.0
- If match is already finished, manual finish action should be no-op
- If score data is partially missing, fallback safely without crashing
```

**Validation Checkpoint 4:**
- [ ] Version metadata present
- [ ] Section 5.5 references v1.0 lifecycle
- [ ] Section 6 references `onDestroy()` correctly
- [ ] No references to `onShow/onHide/onResume/onPause`

---

### Phase 5: Update PRD-Refactor-Layout.md

**Step 16: Add version metadata**
- Add header: `Version: 1.0 | Updated: 2026-03-05 | Task: #67`
- Note: "For confirmed product decisions, see PRD-Review.md"

**Step 17: Add lifecycle compatibility note**
This PRD is mostly about layout system, but should reference lifecycle constraints:

```markdown
## 10. Technical Specifications

### 10.3 Performance Considerations

- Layout resolution happens once per `build()` call
- No runtime layout recalculation needed
- Token lookups are O(1) object property access
- **Note**: In Zepp OS v1.0, `build()` is called on every page creation
  - Pages are destroyed and recreated on each navigation
  - See PRD-Review.md Section 3.4 for lifecycle semantics
```

**Validation Checkpoint 5:**
- [ ] Version metadata present
- [ ] Section 10.3 references v1.0 lifecycle
- [ ] No references to `onShow/onHide/onResume/onPause`

---

### Phase 6: Final Consistency Audit

**Step 18: Cross-PRD consistency check**
Perform systematic review across all 5 updated PRDs:

**18.1 Match History References**
- [ ] PRD.md: Section 12 corrected, references PRD-Review.md
- [ ] PRD-QA-Remediation-v1.1.md: Section 3.2 clarified
- [ ] No PRD states match history is out of scope

**18.2 Summary Screen References**
- [ ] PRD-QA-Remediation-v1.1.md: FR-6 corrected
- [ ] No PRD requires "Start New Game" on summary screen
- [ ] All references point to Home Screen for new game flow

**18.3 Release Branching References**
- [ ] PRD-Review.md: Section 3.3 documents dual-stream policy
- [ ] Other PRDs reference PRD-Review.md for release policy
- [ ] No conflicting release process documentation

**18.4 Lifecycle Semantics**
- [ ] All PRDs use Zepp OS v1.0 terminology
- [ ] No references to `onShow/onHide/onResume/onPause` as available methods
- [ ] All lifecycle references point to PRD-Review.md Section 3.4
- [ ] Persistence triggers reference `onDestroy()` only

**18.5 Version Metadata**
- [ ] All 5 PRDs have version headers
- [ ] All versions use format: "Version: X.Y | Updated: YYYY-MM-DD"
- [ ] All PRDs reference PRD-Review.md for shared decisions

**Step 19: Grep audit for prohibited terms**
Run systematic searches to ensure no remaining violations:

```bash
# Search for lifecycle violations in PRDs
grep -rn "onShow\|onHide\|onResume\|onPause" docs/*.md | grep -v "NOT available\|not supported\|removed"

# Search for match history scope violations
grep -rn "match history.*out of scope\|Non-Goal.*match history" docs/*.md

# Search for summary screen violations
grep -rn "Summary.*Start New Game\|summary.*Start New Game" docs/*.md
```

**Expected results**:
- Zero matches for lifecycle violations (or only in "NOT available" context)
- Zero matches for match history out of scope
- Zero matches for summary screen "Start New Game" requirement

**Step 20: Read-through validation**
Manual review of each PRD for:
- Clarity and readability
- Consistent terminology
- Accurate cross-references
- No confusing statements

**Validation Checkpoint 6:**
- [ ] All consistency checks pass (18.1-18.5)
- [ ] Grep audit returns zero violations
- [ ] Manual read-through complete
- [ ] All PRDs read clearly and consistently

---

### Phase 7: Create Pull Request

**Step 21: Create feature branch**
```bash
git checkout -b feature/PAD-67-update-prds-confirmed-decisions
```

**Step 22: Commit changes**
```bash
git add docs/PRD-Review.md docs/PRD.md docs/PRD-QA-Remediation-v1.1.md \
        docs/PRD-Finish-Match.md docs/PRD-Refactor-Layout.md

git commit -m "docs: update PRDs with confirmed decisions and Zepp v1 lifecycle semantics

- Update PRD-Review.md as master decision document with all 4 confirmed decisions
- Fix PRD.md Section 12: match history now in scope
- Fix PRD-QA-Remediation FR-6: remove 'Start New Game' from summary
- Add release branching policy documentation (main + v* branches)
- Correct all lifecycle terminology to Zepp OS v1.0 (onInit/build/onDestroy only)
- Add version metadata to all 5 PRD files
- Add cross-references to PRD-Review.md for shared decisions

Task: #67
Dependencies: #53, #65"
```

**Step 23: Push and create PR**
```bash
git push -u origin feature/PAD-67-update-prds-confirmed-decisions
```

Create PR with:
- Title: "docs: Update PRDs for Confirmed Decisions and Zepp v1 Lifecycle Semantics"
- Body: Reference this execution plan
- Request stakeholder review
- Link to Task #67

**Validation Checkpoint 7:**
- [ ] Feature branch created
- [ ] All 5 PRD files committed
- [ ] Commit message follows conventions
- [ ] PR created with clear description
- [ ] Stakeholder review requested

---

## Validation

### Success Criteria

1. **Match History Documentation**
   - [x] PRD-Review.md Section 3.1 comprehensively documents match history as in-scope
   - [x] PRD.md Section 12 no longer lists match history as out of scope
   - [x] PRD-QA-Remediation-v1.1.md Section 3.2 clarifies match history scope
   - [x] All PRDs reference PRD-Review.md for match history decision

2. **Summary Screen Documentation**
   - [x] PRD-Review.md Section 3.2 documents summary screen without "Start New Game"
   - [x] PRD-QA-Remediation-v1.1.md FR-6 no longer lists "Start New Game" action
   - [x] Correct navigation flow documented (Home → Start New Game)
   - [x] All PRDs reference PRD-Review.md for summary screen decision

3. **Release Branching Documentation**
   - [x] PRD-Review.md Section 3.3 documents dual-stream release approach
   - [x] Main branch releases (X.Y.Z) clearly documented
   - [x] Version branch releases (v*, X.Y.Z+patch) clearly documented
   - [x] Tag formats specified for both streams

4. **Zepp OS v1 Lifecycle Documentation**
   - [x] PRD-Review.md Section 3.4 comprehensively documents v1.0 lifecycle
   - [x] Available methods clearly listed: onInit, build, onDestroy
   - [x] Unavailable methods clearly listed: onShow, onHide, onResume, onPause
   - [x] Persistence triggers documented (onDestroy only)
   - [x] State restoration pattern documented (onInit + build)
   - [x] All PRD lifecycle references use v1.0 terminology

5. **Version Metadata**
   - [x] All 5 PRDs have version headers
   - [x] Format consistent: "Version: X.Y | Updated: YYYY-MM-DD"
   - [x] All PRDs reference PRD-Review.md for shared decisions

6. **Cross-Reference Integrity**
   - [x] PRD-Review.md is clearly marked as single source of truth
   - [x] All other PRDs reference PRD-Review.md appropriately
   - [x] No conflicting statements across PRDs
   - [x] No duplicate decision documentation

### Checkpoints

| Checkpoint | Location | Success Criteria |
|------------|----------|------------------|
| **CP-0** | Pre-implementation | All PRD files accessible, dependencies complete |
| **CP-1** | After Phase 1 | PRD-Review.md updated with all decisions, version metadata |
| **CP-2** | After Phase 2 | PRD.md corrected for match history scope |
| **CP-3** | After Phase 3 | PRD-QA-Remediation-v1.1.md corrected for summary screen |
| **CP-4** | After Phase 4 | PRD-Finish-Match.md has lifecycle notes |
| **CP-5** | After Phase 5 | PRD-Refactor-Layout.md has lifecycle notes |
| **CP-6** | After Phase 6 | All consistency checks pass, grep audit clean |
| **CP-7** | After Phase 7 | PR created, stakeholder review requested |

### Testing Strategy

**Automated Validation:**
```bash
# Run consistency audit script (manual execution during review)
./scripts/validate-prd-consistency.sh
```

**Manual Validation:**
1. Read each PRD end-to-end for clarity
2. Verify all cross-references resolve correctly
3. Confirm no confusing or contradictory statements
4. Ensure stakeholder reviewers can understand changes

### Rollback Plan

If issues are discovered during stakeholder review:

1. **Minor issues** (typos, unclear wording):
   - Fix directly in the PR with additional commits
   - Re-request review

2. **Major issues** (contradictions, wrong decisions):
   - Identify specific problematic sections
   - Revert individual file changes if needed:
     ```bash
     git checkout HEAD~1 -- docs/<specific-prd>.md
     ```
   - Re-plan the correction approach
   - Create new commits with fixes

3. **Complete rollback** (if fundamentally flawed):
   ```bash
   git checkout main
   git branch -D feature/PAD-67-update-prds-confirmed-decisions
   ```
   - Re-analyze requirements
   - Create new execution plan

### Post-Implementation Verification

After PR is merged:

1. **Verify all 5 PRD files** are updated in main branch
2. **Run grep audit** to confirm zero violations:
   ```bash
   grep -rn "onShow\|onHide\|onResume\|onPause" docs/*.md | grep -v "NOT available"
   grep -rn "match history.*out of scope" docs/*.md
   grep -rn "Summary.*Start New Game" docs/*.md
   ```
3. **Confirm PRD-Review.md** is clearly the authoritative source
4. **Update Task #67** status to "done" with reference to merged PR

---

## Risk Assessment

### Identified Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| **Scope creep** - Adding more than documented decisions | Low | Medium | Stick strictly to 4 confirmed decisions; reject additional changes |
| **Cross-reference errors** - Broken or incorrect references | Medium | Low | Validate all references during CP-6; manual review |
| **Stakeholder disagreement** - Reviewers question decisions | Medium | High | Decisions are confirmed from deep review; escalate if needed |
| **Missing contradictions** - Overlooking conflicting statements | Medium | Medium | Systematic grep audit + manual read-through in CP-6 |
| **Version metadata inconsistency** - Wrong dates or versions | Low | Low | Use template; double-check dates before commit |

### Elevated Risk Areas

**Lifecycle terminology corrections**:
- Risk: May miss references in less obvious sections
- Mitigation: Comprehensive grep search in Phase 6, Step 19
- Fallback: If violations found post-merge, create follow-up task

**Match history scope clarification**:
- Risk: Original "out of scope" was clear, new wording might be confusing
- Mitigation: Clear reference to PRD-Review.md in corrected sections
- Fallback: Add more explicit clarification if stakeholders are confused

---

## Estimated Timeline

| Phase | Estimated Duration | Cumulative |
|-------|-------------------|------------|
| Phase 0: Pre-validation | 15 minutes | 15 min |
| Phase 1: PRD-Review.md | 45 minutes | 1 hour |
| Phase 2: PRD.md | 20 minutes | 1h 20min |
| Phase 3: PRD-QA-Remediation-v1.1.md | 25 minutes | 1h 45min |
| Phase 4: PRD-Finish-Match.md | 15 minutes | 2 hours |
| Phase 5: PRD-Refactor-Layout.md | 10 minutes | 2h 10min |
| Phase 6: Consistency audit | 30 minutes | 2h 40min |
| Phase 7: PR creation | 20 minutes | 3 hours |

**Total estimated time**: 3 hours

**Buffer for review iterations**: +1-2 hours

**Maximum total**: 5 hours

---

## Notes and Assumptions

### Assumptions Made
1. All 4 confirmed decisions are final and non-negotiable
2. PRD-Review.md is accepted as the single source of truth
3. Stakeholders have access to PRD-Review.md for context
4. No code changes are needed (documentation only)
5. RELEASE.md already contains accurate release branching policy (Task #65)
6. Lifecycle audit summary (Task #32) is accurate and complete

### Open Questions
None - all decisions are confirmed from deep review session.

### Non-Goals
- Do NOT add new product decisions beyond the 4 confirmed ones
- Do NOT restructure or rewrite PRDs beyond necessary corrections
- Do NOT change any code or implementation
- Do NOT create new PRD documents
- Do NOT remove existing PRD documents

---

## References

### Task References
- Task #67: Update PRDs for Confirmed Decisions and Zepp v1 Lifecycle Semantics
- Task #53: Create canonical state and storage contract (dependency - done)
- Task #65: Update release workflow for main + v* branches (dependency - done)
- Task #32: Audit & Fix Zepp OS v1.0 Lifecycle API Usage (reference)

### Document References
- `.taskmaster/notes/lifecycle-audit-summary.md` - v1.0 lifecycle constraints
- `RELEASE.md` - Release branching policy
- `docs/PRD-Review.md` - Master decision document (to be updated)
- `docs/PRD.md` - Main product requirements (to be updated)
- `docs/PRD-QA-Remediation-v1.1.md` - QA enhancements (to be updated)
- `docs/PRD-Finish-Match.md` - Manual match finish (to be updated)
- `docs/PRD-Refactor-Layout.md` - Layout refactor (to be updated)

### Implementation References
- `page/history.js` - Match history list page
- `page/history-detail.js` - Match history detail page
- `utils/match-storage.js` - Match storage service
- `.github/workflows/release.yml` - Release workflow
- `.releaserc.json` - Semantic release configuration

---

**End of Execution Plan**

**Plan File Path**: `docs/plan/Plan 67 Update PRDs for Confirmed Decisions and Zepp v1 Lifecycle Semantics.md`
