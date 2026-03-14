# Platform Adapters

Task 75 adds a single adapter contract for platform-facing runtime APIs without migrating existing pages or utilities to use it yet. The goal is to give later Zepp 3.6 migration tasks one stable surface for routing, gestures, toast messages, device info, keep-awake behavior, storage, and haptics.

## Scope

- Added in this task: `utils/platform-adapters.js`, manual mocks, adapter tests, and migration guidance.
- Not changed in this task: existing pages and components still call raw `hm*` APIs directly.
- Mainline target: Zepp OS 3.6 migration work, while still tolerating the current repo's legacy runtime globals and Node test environment.

## Adapter Overview

`utils/platform-adapters.js` exports seven named adapters:

```js
import {
  router,
  gesture,
  toast,
  deviceInfo,
  keepAwake,
  storage,
  haptics
} from '../utils/platform-adapters.js'
```

### `router`

```js
router.navigateTo(pagePath, params)
router.redirectTo(pagePath, params)
router.navigateBack(delta)
router.goHome()
```

- Preferred intent: future Zepp 3.6 routing calls.
- Current compatibility path: uses modern-style router shims when available, otherwise falls back to legacy `hmApp.gotoPage()`, `hmApp.goBack()`, and `hmApp.gotoHome()`.
- Param behavior: params are preserved in the payload, appended to the legacy URL as a query string, and passed through the legacy `param` field for v1 `onInit(params)` compatibility.

Before:

```js
hmApp.gotoPage({ url: 'page/setup' })
```

After:

```js
router.navigateTo('page/setup')
router.goHome()
```

Current migration examples:

- `page/game.js` currently navigates with `hmApp.gotoPage({ url: 'page/setup' })`.
- `page/settings.js` currently navigates with `hmApp.gotoPage({ url: 'page/history' })`.
- `page/game-settings.js` currently falls back from `hmApp.goBack()` to `hmApp.gotoPage({ url: 'page/settings' })`.

### `gesture`

```js
gesture.registerGesture(element, gestureType, callback)
gesture.unregisterGesture(element, gestureType)
```

- Preferred intent: later migration to a per-gesture registration surface.
- Current compatibility path: uses modern-style gesture shims when available, otherwise bridges legacy `hmApp.registerGestureEvent()` and `hmApp.unregisterGestureEvent()` behind an in-memory registry.
- `element` is part of the stable contract even though the legacy API is page-global.

Before:

```js
hmApp.registerGestureEvent((event) => {
  if (event === hmApp.gesture.RIGHT) {
    return true
  }

  return false
})
```

After:

```js
gesture.registerGesture(this, 'RIGHT', () => true)
```

Current migration examples:

- `page/game.js`, `page/index.js`, and `page/summary.js` each register RIGHT-swipe handlers directly through `hmApp.registerGestureEvent()`.

### `toast`

```js
toast.showToast(message, duration)
toast.hideToast()
```

- Preferred intent: centralize transient user feedback.
- Current compatibility path: uses modern-style interaction shims when available, otherwise falls back to `hmUI.showToast()`.
- `hideToast()` is a no-op where the runtime does not expose a dismiss API.

Before:

```js
hmUI.showToast({ text: gettext('history.deleteConfirmToast') })
```

After:

```js
toast.showToast(gettext('history.deleteConfirmToast'), 3000)
```

Current migration examples:

- `page/history-detail.js` shows delete confirmation with `hmUI.showToast(...)`.
- `page/game.js` shows manual finish confirmation with `hmUI.showToast(...)`.
- `page/settings.js` shows clear-data feedback with `hmUI.showToast(...)`.

### `deviceInfo`

```js
deviceInfo.getDeviceInfo()
deviceInfo.isRoundScreen()
```

- Preferred intent: normalize screen metadata before layout logic moves to Zepp 3.6 APIs.
- Current compatibility path: uses modern-style device shims when available, otherwise falls back to `hmSetting.getDeviceInfo()` and existing round-screen heuristics.
- Node and non-Zepp environments default to a safe square-screen shape: `390x450`.

Before:

```js
const info = hmSetting.getDeviceInfo()
const isRound = Math.abs(info.width - info.height) <= Math.round(info.width * 0.04)
```

After:

```js
const info = deviceInfo.getDeviceInfo()
const isRound = deviceInfo.isRoundScreen()
```

Current migration examples:

- `utils/screen-utils.js` currently reads `hmSetting.getDeviceInfo()` directly.

### `keepAwake`

```js
keepAwake.setKeepAwake(enabled)
keepAwake.getKeepAwakeStatus()
```

- Preferred intent: centralize screen-awake policy per page flow.
- Current compatibility path: uses modern-style display shims when available, otherwise falls back to `hmSetting.setBrightScreen()` and `hmSetting.setBrightScreenCancel()`.
- Status is tracked in adapter state because neither legacy nor planned runtime APIs expose a direct getter.

Before:

```js
hmSetting.setBrightScreen(2147483)
// later
hmSetting.setBrightScreenCancel()
```

After:

```js
keepAwake.setKeepAwake(true)
// later
keepAwake.setKeepAwake(false)
```

Current migration examples:

- `page/game.js` keeps the screen awake during active play through direct `hmSetting` calls.

### `storage`

```js
storage.setItem(key, value)
storage.getItem(key)
storage.removeItem(key)
storage.clear()
```

- Preferred intent: one generic key-value adapter for future platform migration work.
- Current compatibility path: uses modern-style storage shims when available, otherwise falls back to in-memory storage.
- Values are JSON-serialized when the underlying runtime only accepts strings.
- This adapter does not replace existing match persistence utilities yet.

Before:

```js
settingsStorage.setItem('match', JSON.stringify(value))
```

After:

```js
storage.setItem('match', value)
const saved = storage.getItem('match')
```

Current migration examples:

- `utils/storage.js` and `utils/haptic-feedback-settings.js` still own the current production persistence paths.
- Later migration work can move simple key-value platform reads and writes behind this adapter one call site at a time.

### `haptics`

```js
haptics.vibrate(duration)
haptics.vibratePattern(pattern)
```

- Preferred intent: unify score feedback and future Zepp 3.6 vibration APIs.
- Current compatibility path: uses modern-style haptic shims when available, otherwise falls back to legacy `hmSensor.createSensor(hmSensor.id.VIBRATE)` best-effort vibration.
- Where the legacy runtime cannot express a pattern exactly, the adapter degrades to one total-duration vibration instead of throwing.

Before:

```js
const vibrate = hmSensor.createSensor(hmSensor.id.VIBRATE)
vibrate.stop()
vibrate.scene = SCORE_HAPTIC_SCENE
vibrate.start()
```

After:

```js
haptics.vibrate(50)
haptics.vibratePattern([20, 30, 20])
```

Current migration examples:

- `page/game.js` and `page/summary.js` currently create and manage vibration sensors directly.

## Expected Usage Guidance

- Use the adapter surface only for new migration work or tightly scoped smoke verification until the page migration tasks are approved.
- Prefer one adapter call at the boundary of a page or utility instead of mixing adapter calls with raw `hm*` calls inside the same behavior.
- Keep existing specialized utilities such as `utils/storage.js` and `utils/screen-utils.js` until their dedicated migration tasks move them over.
- In tests, import `tests/__mocks__/platform-adapters.js` directly for deterministic assertions instead of trying to emulate Zepp runtime globals by hand.

## Mock Usage

`tests/__mocks__/platform-adapters.js` exports the same seven adapters plus helpers for deterministic assertions:

- `resetPlatformAdaptersMock()`
- `getRouterHistory()`
- `getGestureRegistrations()`
- `triggerGesture(element, gestureType, payload)`
- `getToastState()`
- `getStorageSnapshot()`
- `setMockDeviceInfo(nextDeviceInfo)`
- `getKeepAwakeState()`
- `getHapticsCalls()`

These mocks are runner-agnostic and do not depend on `jest.fn()`.

## Breaking Changes And Non-Goals

### Breaking changes

- There are no page-level behavioral changes in Task 75 because existing consumers remain untouched.
- The new contract establishes future migration names and signatures; later tasks should treat these exports as the stable entry points.

### Non-goals

- No broad refactor of `page/` files.
- No replacement of the current match-state persistence utilities.
- No attempt to force Zepp SDK imports into Node tests.
- No runtime-specific redesign beyond safe adapter fallbacks.

## Migration Sequence

1. Add or update tests to target the adapter contract first.
2. Replace one raw platform concern at a time in the page or utility being migrated.
3. Keep behavior identical while switching the platform call site.
4. Remove duplicated runtime glue only after the relevant consumers have moved.

That sequence keeps Task 75 additive and makes later Zepp 3.6 migration tasks smaller and safer.
