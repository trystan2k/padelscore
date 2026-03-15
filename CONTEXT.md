# Project Context - Zepp OS API Level 3.6+

> ⚠️ MANDATORY - Mainline targets Zepp OS API Level 3.6+ only.

## API Version

- Target: Zepp OS API Level `3.6+`
- Reference: https://docs.zepp.com/docs/intro/
- `app.json` is the source of truth for supported runtime versions
- Do not add new Zepp OS 1.x compatibility code to mainline

---

## Page Lifecycle

Device App pages in this project are built around the page lifecycle already used across the codebase:

```js
Page({
  onInit(params) {
    // Initialize page state
  },

  build() {
    // Render widgets
  },

  onDestroy() {
    // Cleanup page resources
  }
})
```

Use the lifecycle required by the current app architecture and the Zepp OS 3.x runtime APIs in use by the page. Do not reintroduce guidance that assumes Zepp OS 1.0-only constraints.

---

## Preferred APIs for Mainline

### Navigation
- `@zos/router` - `push`, `replace`, `back`, `home`

### Interaction
- `@zos/interaction` - `showToast`, `onGesture`, `offGesture`

### Device Info
- `@zos/device` - `getDeviceInfo()`

### Display
- `@zos/display` - `setPageBrightTime`, `resetPageBrightTime`, `pausePalmScreenOff`, `resetPalmScreenOff`, `pauseDropWristScreenOff`, `resetDropWristScreenOff`, `setWakeUpRelaunch`

### Storage
- `@zos/storage` - `LocalStorage`

### Haptics
- `@zos/sensor` - `Vibrator`

### UI
- `@zos/ui` widget APIs

---

## Mainline Rules

1. Prefer `@zos/*` module imports over `hm*` globals.
2. Do not add new `hmApp`, `hmSetting`, or `hmSensor` fallbacks in production code.
3. Keep routing payloads on the modern `{ url, params }` contract.
4. Keep persistence on the LocalStorage-based Zepp 3.x path.
5. Treat old Zepp OS 1.0 plans and development logs as historical context, not current implementation guidance.

---

## Verification

Before finishing runtime changes:
1. Check the implementation still matches `app.json` runtime `3.6`
2. Prefer simulator plus real-device verification for wake, haptics, routing, and layout flows
3. Run `npm run complete-check` unless the task explicitly excludes tests or full QA

---

## Version Management

This project maintains version consistency across three files:
- `package.json` - npm package version
- `app.json` - Zepp OS app version
- `utils/version.js` - runtime version constant

Version updates are handled automatically by the release workflow.
See `RELEASE.md` for details.

---

## Related Documentation

- `README.md` - project overview and development workflow
- `RELEASE.md` - release process and version management
- `CHANGELOG.md` - version history
- `docs/PLATFORM_ADAPTERS.md` - current adapter contract for Zepp OS 3.6+
- `docs/plan/Plan 79 Remove Remaining Legacy API 1.x Compatibility for API Level 3.6+.md` - cleanup plan for removing remaining 1.x compatibility code
- Zepp OS Documentation: https://docs.zepp.com/docs/intro/
