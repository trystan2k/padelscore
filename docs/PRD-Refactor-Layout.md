# PRD: UI Layout System Refactor

**Version:** 1.0 | **Updated:** 2026-03-05 | **Task:** #67  
**Status:** Approved  
**Created:** 2026-02-25  
**Author:** AI Assistant  
**Target:** Padel Buddy v1.0 (Zepp OS)

> **Note:** For confirmed product decisions, see [PRD-Review.md](./PRD-Review.md) - the authoritative source for all confirmed decisions.

---

## 1. Problem Statement

The current UI positioning implementation has several issues:

1. **Scattered inline math** - Positions calculated inline throughout each page
2. **No visual hierarchy** - Cannot see layout structure from reading code
3. **Cascading dependencies** - Changes ripple unpredictably through code
4. **Repetitive boilerplate** - Same `Math.round(height * scale)` pattern everywhere
5. **Duplicated logic** - Round screen handling, token definitions repeated across pages
6. **Inconsistent values** - Similar elements use different font sizes/spacing on different pages

---

## 2. Goals

### Primary Goals
- Centralize all design tokens (colors, typography, spacing) in one location
- Create a declarative layout system that resolves to pixel coordinates
- Establish a consistent page structure (header/body/footer) across all pages
- Extract reusable UI components for common patterns

### Non-Goals
- ❌ Theme switching implementation (structure only, not functionality)
- ❌ Abstracting scroll list complexity
- ❌ Creating separate layout files per page
- ❌ Advanced layout features (flexbox-like, auto-sizing)

---

## 3. Solution Overview

### Architecture Layers

```
┌─────────────────────────────────────────────────────────────┐
│                      PAGE FILES                              │
│  (Contain layout schema + use components + tokens)           │
├─────────────────────────────────────────────────────────────┤
│                   UI COMPONENTS                              │
│  createButton, createText, createCard, etc.                  │
├─────────────────────────────────────────────────────────────┤
│                   LAYOUT PRESETS                             │
│  Standard header/body/footer structure                       │
├─────────────────────────────────────────────────────────────┤
│                   LAYOUT ENGINE                              │
│  Resolves declarative schema to pixel coordinates            │
├─────────────────────────────────────────────────────────────┤
│                   SCREEN UTILITIES                           │
│  Screen metrics, round screen helpers                        │
├─────────────────────────────────────────────────────────────┤
│                   DESIGN TOKENS                              │
│  Colors, typography (semantic), spacing                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. Design Tokens

### 4.1 Token Categories

| Category | Description | Example Keys |
|----------|-------------|--------------|
| Colors | All color values | `background`, `text`, `accent`, `primaryButton`, `mutedText` |
| Typography | Semantic font sizes | `pageTitle`, `sectionTitle`, `body`, `score`, `caption`, `button` |
| Spacing | Scale factors for positioning | `pageTop`, `pageBottom`, `sectionGap`, `headerToContent` |
| Sizing | Fixed and scaled dimensions | `iconLarge`, `buttonHeight`, `minTouchTarget` |

### 4.2 Semantic Typography

Instead of raw scale factors, use semantic names:

```javascript
typography: {
  pageTitle: 0.0825,      // Main page title
  sectionTitle: 0.068,    // Section/card titles
  body: 0.055,            // Body text
  bodyLarge: 0.08,        // Large body text (scores in lists)
  score: 0.11,            // Section scores
  scoreDisplay: 0.28,     // Game page main score (special case)
  caption: 0.036,         // Small labels
  button: 0.05,           // Button text
  buttonLarge: 0.055      // Large button text
}
```

### 4.3 Theming Preparation

Structure tokens to support future theming:

```javascript
// Current: flat structure
colors: {
  primaryButton: 0x1eb98c
}

// Future-ready: nested structure (implement later)
colors: {
  light: { primaryButton: 0x1eb98c },
  dark: { primaryButton: 0x1eb98c }
}
```

For now, use flat structure but document that theming is planned.

---

## 5. Layout Engine

### 5.1 Schema Structure

```javascript
const PAGE_LAYOUT = {
  sections: {
    header: {
      top: '4%',           // Percentage of screen height
      height: '11%',       // Percentage of screen height
      sideInset: '6%'      // Percentage of screen width
    },
    body: {
      after: 'header',     // Position after another section
      gap: '6%',           // Gap after previous section
      height: 'fill',      // Fill remaining space
      sideInset: '7%'
    },
    footer: {
      bottom: '7%',        // Position from bottom
      height: '15%',
      sideInset: 0
    }
  },
  
  elements: {
    pageTitle: {
      section: 'header',   // Parent section
      x: '0%',
      y: '0%',
      width: '100%',
      height: '100%',
      align: 'center'      // Optional alignment override
    },
    primaryButton: {
      section: 'footer',
      x: '15%',
      y: '10%',
      width: '70%',
      height: '80%',
      align: 'center'
    }
  }
}
```

### 5.2 Position Resolution

The layout engine resolves:

| Input | Resolution |
|-------|------------|
| `'10%'` | `Math.round(dimension * 0.10)` |
| `'header.bottom'` | `sections.header.y + sections.header.h` |
| `'header.bottom + 2%'` | Section reference + offset |
| `'fill'` | Remaining space until next section/bottom |
| `50` | Literal pixel value |

### 5.3 Round Screen Handling

- Centralize existing `calculateRoundSafeSideInset` logic in `screen-utils.js`
- Layout engine applies round-safe insets automatically when `isRound: true`
- Sections can opt out with `roundSafeInset: false`

### 5.4 Error Handling

- Invalid references → fallback to 0
- Missing sections → use full screen bounds
- Invalid percentages → clamp to 0-100%
- App remains functional even with layout errors

---

## 6. Page Structure

### 6.1 Standard 3-Section Layout

All pages follow this structure:

```
┌─────────────────────────────────────┐
│             HEADER                   │  ← pageTitle, sectionTitle
│         (variable height)            │
├─────────────────────────────────────┤
│                                      │
│             BODY                     │  ← main content, cards
│        (fills remaining)             │
│                                      │
├─────────────────────────────────────┤
│             FOOTER                   │  ← action buttons, navigation
│        (fixed height)                │
└─────────────────────────────────────┘
```

### 6.2 Layout Presets

Provide factory functions for common patterns:

```javascript
// Standard page with header, body, footer
createStandardPageLayout()

// Page with title in header, icon button in footer
createPageWithFooterButton(options)

// Two-column layout (for game page score area)
createTwoColumnLayout(parentSection)
```

### 6.3 Card Handling

Cards are containers within the body section, not separate sections:

```javascript
sections: {
  header: { ... },
  body: { after: 'header', height: 'fill' },
  footer: { bottom: '7%', height: '15%' }
},
elements: {
  card: {
    section: 'body',
    x: '7%',
    y: '5%',
    width: '86%',
    height: '90%'
  }
}
```

---

## 7. UI Components

### 7.1 Component List

| Component | Description |
|-----------|-------------|
| `createBackground()` | Full-screen background fill |
| `createCard()` | Rounded rectangle container |
| `createDivider()` | Horizontal/vertical divider line |
| `createButton()` | Button with variants (primary, secondary, icon, danger) |
| `createText()` | Text element with semantic styles |
| `createPageTitle()` | Page title text (semantic helper) |
| `createSectionTitle()` | Section title text (semantic helper) |
| `createBodyText()` | Body text (semantic helper) |

### 7.2 Button API

Single function with variants:

```javascript
// Primary button
createButton(widget, bounds, {
  text: 'Start Game',
  variant: 'primary',
  onClick: () => handleStart()
})

// Secondary button
createButton(widget, bounds, {
  text: 'Resume',
  variant: 'secondary',
  onClick: () => handleResume(),
  visible: hasSavedGame
})

// Icon button
createButton(widget, bounds, {
  variant: 'icon',
  icon: 'home-icon.png',
  onClick: () => navigateHome()
})

// Danger button
createButton(widget, bounds, {
  text: 'Clear Data',
  variant: 'danger',
  onClick: () => handleClear()
})
```

### 7.3 Scroll Lists

Keep scroll list logic in pages (too complex to abstract well), but use tokens for styling:

```javascript
// In page file - use tokens for consistent sizing
const itemTextSize = getFontSize('body', width)
const textColor = TOKENS.colors.text
const iconSize = TOKENS.sizing.iconMedium
```

---

## 8. File Structure

```
utils/
├── design-tokens.js      # All design tokens
├── screen-utils.js       # Screen metrics, round screen helpers
├── layout-engine.js      # Layout resolution engine
├── layout-presets.js     # Common page structures
└── ui-components.js      # Reusable widget factories

docs/
└── UI-SYSTEM.md          # Comprehensive documentation

page/
├── index.js              # Layout schema embedded
├── setup.js              # Layout schema embedded
├── game.js               # Layout schema embedded
├── summary.js            # Layout schema embedded
├── settings.js           # Layout schema embedded
├── history.js            # Layout schema embedded
└── history-detail.js     # Layout schema embedded
```

---

## 9. Migration Plan

### 9.1 Phase Order

| Phase | Tasks | Validation |
|-------|-------|------------|
| **1** | Create `design-tokens.js`, `screen-utils.js` | No QA needed (foundation) |
| **2** | Create `layout-engine.js`, `layout-presets.js` | Unit test resolution |
| **3** | Create `ui-components.js` | Manual component verification |
| **4** | Migrate `index.js` (home page) | `npm run complete-check` |
| **5** | Migrate `setup.js` | `npm run complete-check` |
| **6** | Migrate `game.js` (most complex) | `npm run complete-check` |
| **7** | Migrate `summary.js` | `npm run complete-check` |
| **8** | Migrate `settings.js`, `history.js`, `history-detail.js` | `npm run complete-check` |
| **9** | Remove old TOKENS constants | `npm run complete-check` |
| **10** | Create `docs/UI-SYSTEM.md` | Documentation review |

### 9.2 Migration Strategy

- **Replace immediately** - Delete old TOKENS and layout code as each page is migrated
- **QA after each page** - Run `npm run complete-check` to verify no regressions
- **Incremental delivery** - Working system after each phase

### 9.3 Rollback Plan

If issues arise:
1. Git revert the specific page migration commit
2. Previous page version restored immediately
3. Fix issue in new system, re-migrate

---

## 10. Technical Specifications

### 10.1 Device Support

| Device | Design Width | Screen Shape |
|--------|--------------|--------------|
| GTR 3 | 454px | Round |
| GTS 3 | 390px | Square |

- Use **runtime calculation** based on actual screen dimensions
- Percentage-based positioning scales automatically
- Round screen insets calculated dynamically

### 10.2 Round Screen Detection

```javascript
function isRoundScreen(width, height) {
  return Math.abs(width - height) <= Math.round(width * 0.04)
}
```

### 10.3 Performance Considerations

- Layout resolution happens once per `build()` call
- No runtime layout recalculation needed
- Token lookups are O(1) object property access
- **Note:** In Zepp OS v1.0, `build()` is called on every page creation
  - Pages are destroyed and recreated on each navigation
  - See [PRD-Review.md](./PRD-Review.md) Section 1, Decision 4 for lifecycle semantics

---

## 11. Documentation

### 11.1 UI-SYSTEM.md Contents

1. Overview and architecture
2. Design tokens reference
3. Layout schema syntax
4. Component API reference
5. Migration guide for new pages
6. Examples for common patterns

### 11.2 Code Comments

- JSDoc comments on all public functions
- Inline comments for complex resolution logic
- Examples in documentation strings

---

## 12. Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Token values | Standardize across pages | Consistency over preserving differences |
| Typography | Semantic tokens | Most flexible, clear intent |
| Theming | Prepare structure only | Future-proof without over-engineering |
| Page structure | Strict 3-section | Simplest mental model |
| Cards | Container inside body | Consistent with other pages |
| Layout engine | Simple schema | Covers 95% of cases, easy to debug |
| Components | All types extracted | Maximum reuse |
| Buttons | One function with variants | Clean API |
| Scroll lists | Keep in pages | Too complex to abstract well |
| Migration order | Foundation → simple → complex | Validate system early |
| Code transition | Replace immediately | Cleaner codebase |
| Validation | QA after each page | Catch issues early |
| Round screens | Centralize current logic | Works well, just needs one home |
| Error handling | Graceful fallbacks | App stays functional |
| Device support | Runtime calculation | Handles both devices automatically |
| File location | All in utils/ | Consistent with project structure |
| Layout schemas | In page files | Simpler, fewer files |
| Documentation | Single UI-SYSTEM.md | Easier to maintain |

---

## 13. Success Criteria

- [ ] All design tokens centralized in one file
- [ ] All pages use consistent header/body/footer structure
- [ ] Layout code is readable (declarative schema vs inline math)
- [ ] Button variants handled by single function
- [ ] Round screen logic in one location
- [ ] `npm run complete-check` passes after each migration
- [ ] Visual appearance unchanged after migration
- [ ] Documentation complete

---

## 14. Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Layout resolution bugs | Graceful fallbacks, extensive testing |
| Performance regression | Profile after each phase |
| Visual differences | Side-by-side comparison during QA |
| Complex pages (game) | Migrate last, validate foundation first |
| Round screen edge cases | Keep proven algorithm, just centralize |

---

## 15. Timeline Estimate

| Phase | Effort |
|-------|--------|
| Phase 1-3 (Foundation) | 1-2 hours |
| Phase 4-5 (Simple pages) | 1-2 hours |
| Phase 6 (Game page) | 1-2 hours |
| Phase 7-8 (Remaining pages) | 1-2 hours |
| Phase 9-10 (Cleanup & docs) | 0.5-1 hour |

**Total: 4-8 hours** (depending on complexity discovered during migration)

---

## Appendix A: Example Migrated Page

### Before (index.js - current)

```javascript
const HOME_TOKENS = Object.freeze({
  colors: {
    background: 0x000000,
    buttonText: 0x000000,
    primaryButton: 0x1eb98c,
    // ... many more
  },
  fontScale: {
    button: 0.055,
    logo: 0.068,
    title: 0.0825
  },
  spacingScale: {
    contentTop: 0.1,
    logoToTitle: 0.012,
    // ... more spacing
  },
  buttonSize: {
    height: 0.2,
    width: 0.7,
    // ... more sizing
  }
})

// In build():
const logoY = Math.round(height * HOME_TOKENS.spacingScale.contentTop)
const logoHeight = Math.round(height * 0.08)
const titleY = logoY + logoHeight + Math.round(height * HOME_TOKENS.spacingScale.logoToTitle)
// ... many more calculations
```

### After (index.js - migrated)

```javascript
import { TOKENS, getFontSize } from '../utils/design-tokens.js'
import { resolveLayout } from '../utils/layout-engine.js'
import { getScreenMetrics } from '../utils/screen-utils.js'
import { createBackground, createButton, createText } from '../utils/ui-components.js'
import { createStandardPageLayout } from '../utils/layout-presets.js'

const INDEX_LAYOUT = {
  sections: {
    header: {
      top: TOKENS.spacing.pageTop,
      height: '20%',
      sideInset: 0
    },
    body: {
      after: 'header',
      gap: '2%',
      height: 'fill',
      sideInset: TOKENS.spacing.pageSide
    },
    footer: {
      bottom: TOKENS.spacing.footerBottom,
      height: '15%',
      sideInset: 0
    }
  },
  elements: {
    logo: {
      section: 'header',
      x: 0, y: '10%', width: '100%', height: '40%',
      align: 'center'
    },
    pageTitle: {
      section: 'header',
      x: 0, y: '55%', width: '100%', height: '40%',
      align: 'center'
    },
    primaryButton: {
      section: 'body',
      x: '15%', y: '10%', width: '70%', height: '35%'
    },
    secondaryButton: {
      section: 'body',
      x: '15%', y: '55%', width: '70%', height: '35%'
    },
    settingsButton: {
      section: 'footer',
      x: 0, y: 0, width: '100%', height: '100%',
      align: 'center'
    }
  }
}

Page({
  build() {
    const metrics = getScreenMetrics()
    const layout = resolveLayout(INDEX_LAYOUT, metrics)
    
    createBackground(this, metrics)
    
    createText(this, layout.elements.logo, {
      text: gettext('home.logo'),
      style: 'pageTitle',
      color: TOKENS.colors.accent
    })
    
    createText(this, layout.elements.pageTitle, {
      text: gettext('home.title'),
      style: 'pageTitle'
    })
    
    createButton(this, layout.elements.primaryButton, {
      text: gettext('home.startNewGame'),
      variant: 'primary',
      onClick: () => this.handleStartNewGame()
    })
    
    createButton(this, layout.elements.secondaryButton, {
      text: gettext('home.resumeGame'),
      variant: 'secondary',
      visible: this.hasSavedGame,
      onClick: () => this.handleResumeGame()
    })
    
    createButton(this, layout.elements.settingsButton, {
      variant: 'icon',
      icon: 'setting-icon.png',
      onClick: () => this.navigateToSettings()
    })
  }
})
```

---

## Appendix B: Token Migration Mapping

| Page | Current Token | New Token |
|------|---------------|-----------|
| index | `HOME_TOKENS.fontScale.title` | `TOKENS.typography.pageTitle` |
| index | `HOME_TOKENS.fontScale.button` | `TOKENS.typography.buttonLarge` |
| game | `GAME_TOKENS.fontScale.points` | `TOKENS.typography.scoreDisplay` |
| game | `GAME_TOKENS.fontScale.headerLabel` | `TOKENS.typography.caption` |
| setup | `SETUP_TOKENS.fontScale.title` | `TOKENS.typography.sectionTitle` |
| setup | `SETUP_TOKENS.fontScale.option` | `TOKENS.typography.button` |
| summary | `SUMMARY_TOKENS.fontScale.winner` | `TOKENS.typography.bodyLarge` |
| settings | `SETTINGS_TOKENS.fontScale.item` | `TOKENS.typography.body` |

---

**End of PRD**
