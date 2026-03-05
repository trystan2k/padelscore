# Release Process

This document explains how releases work in the Padel Buddy repository.

## Overview

Padel Buddy uses an **automated release system** powered by [semantic-release](https://semantic-release.gitbook.io/) and GitHub Actions. Releases are triggered automatically when code is merged to the `main` branch or maintenance branches matching `v*` (for example, `v1.0.x`), eliminating manual version management and ensuring consistent, predictable releases.

**Key Benefits:**
- Fully automated versioning based on commit messages
- Automatic CHANGELOG.md generation
- GitHub Releases with detailed release notes
- No manual version bumps required

---

## How Releases Work

### Trigger Conditions

A release workflow is triggered when:

1. Code is pushed or merged to the `main` branch or a maintenance branch matching `v*` (for example, `v1.0.x`)
2. The commit message does **not** contain `[skip ci]`
3. Changes are detected in releasable file paths

### Supported Branches

| Branch Pattern | Description |
|----------------|-------------|
| `main` | Primary release branch (`latest` channel) |
| `v*` (for example, `v1.0.x`) | Maintenance release branches (channel/range derived from branch name without `v`) |

---

## What Triggers a Release

### Commit Types That Trigger Releases

| Commit Type | Example | Version Impact |
|-------------|---------|----------------|
| `feat:` | `feat: add match timer feature` | Minor bump |
| `fix:` | `fix: correct score calculation` | Patch bump |
| `perf:` | `perf: optimize match history loading` | Patch bump |
| `refactor:` | `refactor: simplify score logic` | Patch bump |

### Releasable File Paths

Changes to these paths will trigger a release (when combined with a release-triggering commit type):

```
page/          # UI pages/screens
app.js         # Main application entry
app.json       # App configuration
app-side/      # App-side service code
setting/       # Settings page code
utils/         # Utility functions
assets/        # Images, icons, fonts
shared/        # Shared modules
```

---

## What Does NOT Trigger a Release

### Commit Types That Skip Releases

| Commit Type | Example | Version Impact |
|-------------|---------|----------------|
| `chore:` | `chore: update dependencies` | No release |
| `docs:` | `docs: update README` | No release |
| `test:` | `test: add unit tests for score` | No release |
| `style:` | `style: format code with biome` | No release |

### Path Filtering: CI vs. Release

This repository uses **two different path filtering mechanisms** for different purposes:

| Mechanism | Purpose | Configured In | Effect |
|-----------|---------|---------------|--------|
| **CI paths-ignore** | Skip CI workflow entirely | `.github/workflows/ci.yml` | Push to main/v* with only these paths won't trigger CI (PRs always trigger CI) |
| **Release releasable paths** | Determine if release should happen | `.github/workflows/release.yml` | Changes must be in these paths to trigger a release |

**CI paths-ignore** (prevents CI from running):
```
.opencode/     # Agent configurations
.taskmaster/   # Task management
.husky/        # Git hooks
docs/          # Documentation folder
README.md      # Main readme
AGENTS.md      # Agent instructions
CONTEXT.md     # Project context
```

**Release releasable paths** (triggers a release when changed):
```
page/          # UI pages/screens
app.js         # Main application entry
app.json       # App configuration
app-side/      # App-side service code
setting/       # Settings page code
utils/         # Utility functions
assets/        # Images, icons, fonts
shared/        # Shared modules
```

> **Note**: Paths not in the "releasable paths" list (like `.github/`, `*.md`, `LICENSE`) won't trigger a release, even if they're not in the CI paths-ignore list.

### Other Paths That Don't Trigger Releases

Changes to these paths won't trigger a release (even though they may trigger CI):

```
.github/       # GitHub workflows
*.md           # Markdown files (except README.md, AGENTS.md, CONTEXT.md which are in CI paths-ignore)
LICENSE        # License file
.gitignore     # Git ignore rules
```

### Skip CI Explicitly

Include `[skip ci]` in your commit message to skip the release workflow entirely:

```bash
git commit -m "docs: update internal documentation [skip ci]"
```

---

## Version Bump Rules

The version bump is determined by the commit type and whether the commit introduces a breaking change.

| Commit Type | Breaking Change | Version Bump | Example |
|-------------|-----------------|--------------|---------|
| `feat:` | No | Minor (1.0.0 → 1.1.0) | New feature |
| `feat:` | Yes | Major (1.0.0 → 2.0.0) | Breaking feature |
| `fix:` | No | Patch (1.0.0 → 1.0.1) | Bug fix |
| `fix:` | Yes | Major (1.0.0 → 2.0.0) | Breaking fix |
| `perf:` | No | Patch (1.0.0 → 1.0.1) | Performance improvement |
| `perf:` | Yes | Major (1.0.0 → 2.0.0) | Breaking performance change |
| `refactor:` | No | Patch (1.0.0 → 1.0.1) | Code refactoring |
| `refactor:` | Yes | Major (1.0.0 → 2.0.0) | Breaking refactor |
| `chore:` | - | No release | Maintenance tasks |
| `docs:` | - | No release | Documentation only |
| `test:` | - | No release | Test changes |
| `style:` | - | No release | Code formatting |

---

## Developer/Contributor Guide

### Writing Commit Messages

Use the **Conventional Commits** format for all commit messages:

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Good Commit Message Examples

#### Feature (Minor Version Bump)
```bash
feat: add match timer with pause functionality

Implement a countdown timer that can be paused and resumed
during matches. Timer state is persisted across app restarts.
```

#### Bug Fix (Patch Version Bump)
```bash
fix: correct tie-break score display

The tie-break score was showing incorrect values when
players reached 10-10. Now properly displays the extended
score format.
```

#### Performance Improvement (Patch Version Bump)
```bash
perf: optimize match history loading

Reduce match history load time by 60% using lazy loading
and caching of match data.
```

#### Refactoring (Patch Version Bump)
```bash
refactor: simplify score calculation logic

Extract score calculation into a dedicated utility module
for better testability and maintainability.
```

#### Breaking Change (Major Version Bump)

There are **three ways** to indicate a breaking change:

**Method 1: `BREAKING CHANGE:` footer (recommended)**
```bash
feat: redesign match history data structure

BREAKING CHANGE: Match history data format has changed.
Previous match history will not be compatible with this
version. Users will need to start fresh.
```

**Method 2: `!` after type/scope**
```bash
feat!: remove deprecated score API endpoints
```

**Method 3: Combined with footer**
```bash
refactor!: migrate to new storage API

BREAKING CHANGE: Storage API has been completely rewritten.
Any code relying on the old storage interface will need
to be updated.
```

#### Non-Releasing Commits
```bash
docs: update installation instructions
chore: update biome configuration
test: add tests for score utility functions
style: format code according to style guide
```

### Commit Message Best Practices

1. **Use lowercase** for the first letter of the description
2. **No period** at the end of the subject line
3. **Keep subject under 72 characters**
4. **Use imperative mood** ("add feature" not "added feature")
5. **Reference issues** in the footer when applicable:

```bash
feat: add spanish language support

Add complete Spanish translation for all UI strings.

Closes #42
```

---

## Admin Guide

### Maintaining Version Branches

For maintaining older release lines (for example, security fixes on `v1.0.x` while `main` moves forward):

```bash
# Create a maintenance branch
git checkout -b v1.0.x main
git push -u origin v1.0.x

# Make fixes on the maintenance branch
git checkout v1.0.x
git cherry-pick <commit-hash>  # or make new commits
git push
```

Releases will be created automatically for branches matching `v*` (for example, `v1.0.x`).

### Skipping CI for Specific Commits

Use `[skip ci]` when you want to commit changes without triggering a release:

```bash
# For documentation-only changes
git commit -m "docs: update internal wiki [skip ci]"

# For work-in-progress commits on main (not recommended)
git commit -m "wip: partial feature implementation [skip ci]"
```

> ⚠️ **Warning**: Avoid pushing `[skip ci]` commits to `main` for actual code changes. They will not be included in release notes.

### Monitoring Releases

1. **GitHub Actions**: Check the [Actions tab](../../actions) for release workflow status
2. **Releases**: View all releases in the [Releases page](../../releases)
3. **Changelog**: Review [CHANGELOG.md](CHANGELOG.md) for release history

### Manual Release (Emergency)

If you need to trigger a release manually:

```bash
# Dry run to see what would happen
npm run release:dry

# Trigger a release (requires proper setup)
npm run release
```

> Note: Manual releases should only be used in emergencies. The automated workflow is the preferred method.

### Dry-Run Validation (No Extra Remote Branches)

Validate release behavior locally before opening a PR. You do **not** need to create extra remote test branches.

```bash
# 1) Validate main stream behavior from main branch context
git switch main
npm run release:dry -- --no-ci --debug

# 2) Validate maintenance stream behavior from a v* branch context
git switch v1.0.x
npm run release:dry -- --no-ci --debug
```

If `v1.0.x` does not exist locally, create/switch to a local branch that matches `v*` first (for example, `git switch -c v1.0.x --track origin/v1.0.x`). Keep this validation local unless you actually intend to ship a maintenance release.

---

## Workflow Details

When a release is triggered, the following steps execute automatically:

### 1. Workflow Initialization
- GitHub Actions release workflow runs after successful CI for `push` events on `main` and maintenance branches matching `v*`
- Checks if commit message contains `[skip ci]` (skips if present)

### 2. Change Detection
- Compares changed files against releasable paths
- If no releasable files changed, the workflow exits early

### 3. Quality Checks
```bash
npm run lint              # Biome linter
npm run format:check      # Format check (no auto-fix)
npm run test              # Unit test suite
npm run test:unification  # Unification regression suite
```

### 4. Build
```bash
npm run build:all  # Build all device targets
```

### 5. Semantic Release Process
The `semantic-release` tool takes over:

1. **Analyze Commits**: Scans commits since last release
2. **Determine Version**: Calculates new version number
3. **Generate Notes**: Creates release notes from commits
4. **Update Files**:
   - `package.json` - npm package version
   - `package-lock.json` - lockfile version
   - `app.json` - Zepp OS app version
   - `utils/version.js` - runtime version constant
   - `CHANGELOG.md` - changelog entry
5. **Create Commit**: Commits version changes with `[skip ci]`
6. **Create Tag**: Creates git tag (e.g., `v1.2.0`)
7. **Push Changes**: Pushes commit and tag to repository
8. **GitHub Release**: Creates GitHub Release with notes

### Generated Artifacts

Each release includes:
- Versioned git tag
- GitHub Release with release notes
- Updated CHANGELOG.md
- Updated version files

---

## Troubleshooting

### Release Didn't Happen

**Check these common causes:**

| Issue | Solution |
|-------|----------|
| Commit type doesn't trigger release | Use `feat`, `fix`, `perf`, or `refactor` |
| No releasable files changed | Ensure changes are in `page/`, `app.js`, etc. |
| Commit contains `[skip ci]` | Remove `[skip ci]` from commit message |
| Workflow failed | Check GitHub Actions logs for errors |
| No new commits since last release | Make sure there are new commits to release |

### Checking Why Release Was Skipped

1. Go to **Actions** tab in GitHub
2. Find the latest "Release" workflow run
3. Check the "Check for releasable changes" step output
4. Look for messages like:
   - "No releasable changes - skipping release"
   - "Releasable changes detected"

### Tests or Lint Failed

If the quality checks fail:

```bash
# Run locally to diagnose
npm run complete-check

# Fix issues
npm run lint:fix
npm run format

# Re-run tests
npm run test
```

### Version Files Out of Sync

If version files become inconsistent:

```bash
# The sync script updates app.json and utils/version.js
node scripts/sync-version.js
```

### Need to Fix a Release

1. **Delete the GitHub Release** (in Releases page)
2. **Delete the git tag**:
   ```bash
   git tag -d v1.2.0
   git push origin :refs/tags/v1.2.0
   ```
3. **Revert or fix the commit**
4. **Force a new release** by making a new commit

---

## Quick Reference

### Commit Type Quick Reference

| Type | Triggers Release | Version Bump |
|------|------------------|--------------|
| `feat` | ✅ Yes | Minor |
| `fix` | ✅ Yes | Patch |
| `perf` | ✅ Yes | Patch |
| `refactor` | ✅ Yes | Patch |
| `chore` | ❌ No | - |
| `docs` | ❌ No | - |
| `test` | ❌ No | - |
| `style` | ❌ No | - |

### File Path Quick Reference

| Path | Triggers Release |
|------|------------------|
| `page/**` | ✅ Yes |
| `app.js` | ✅ Yes |
| `app.json` | ✅ Yes |
| `app-side/**` | ✅ Yes |
| `setting/**` | ✅ Yes |
| `utils/**` | ✅ Yes |
| `assets/**` | ✅ Yes |
| `shared/**` | ✅ Yes |
| `.opencode/**` | ❌ No |
| `.taskmaster/**` | ❌ No |
| `.github/**` | ❌ No |
| `docs/**` | ❌ No |
| `*.md` | ❌ No |

---

## Additional Resources

- [Semantic Versioning Specification](https://semver.org/)
- [Conventional Commits Specification](https://www.conventionalcommits.org/)
- [semantic-release Documentation](https://semantic-release.gitbook.io/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
