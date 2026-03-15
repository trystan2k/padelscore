# Platform Adapters

`utils/platform-adapters.js` is the mainline runtime boundary for Zepp OS API Level 3.6+ platform calls. It keeps page code focused on app behavior while centralizing routing, gestures, toast messaging, device info, keep-awake behavior, storage, and haptics.

## Scope

- Mainline target: Zepp OS API Level `3.6+`
- Runtime model: `@zos/*` modules are the primary integration surface
- Non-goal: preserving Zepp OS 1.x compatibility in production code

## Exports

```js
import {
  router,
  gesture,
  toast,
  deviceInfo,
  keepAwake,
  storage,
  haptics,
  resetPlatformAdaptersState
} from '../utils/platform-adapters.js'
```

## Router

```js
router.navigateTo(pagePath, params)
router.redirectTo(pagePath, params)
router.navigateBack(delta)
router.goHome()
```

Uses `@zos/router` and standardizes page navigation on the `{ url, params }` payload shape.

Example:

```js
router.navigateTo('page/history-detail', { id: matchId })
router.navigateBack()
router.goHome()
```

## Gesture

```js
gesture.registerGesture(element, gestureType, callback)
gesture.unregisterGesture(element, gestureType)
```

Uses `@zos/interaction` gesture registration behind a page-friendly registry so page code can keep a stable `register` / `unregister` contract.

Example:

```js
gesture.registerGesture(this, 'RIGHT', () => {
  router.navigateBack()
  return true
})
```

## Toast

```js
toast.showToast(message, duration)
toast.hideToast()
```

Uses `@zos/interaction` `showToast`. The adapter keeps a small in-memory state for deterministic behavior where runtime toast dismissal is not available.

Example:

```js
toast.showToast(gettext('history.deleteConfirmToast'))
```

## Device Info

```js
deviceInfo.getDeviceInfo()
deviceInfo.isRoundScreen()
```

Uses `@zos/device` `getDeviceInfo()` and normalizes the result with the shared screen utility behavior.

Example:

```js
const info = deviceInfo.getDeviceInfo()
const isRound = deviceInfo.isRoundScreen()
```

## Keep Awake

```js
keepAwake.setKeepAwake(enabled)
keepAwake.getKeepAwakeStatus()
```

Uses `@zos/display` page-scoped display APIs:
- `setPageBrightTime`
- `resetPageBrightTime`
- `pauseDropWristScreenOff`
- `resetDropWristScreenOff`
- `pausePalmScreenOff`
- `resetPalmScreenOff`

Example:

```js
keepAwake.setKeepAwake(true)
keepAwake.setKeepAwake(false)
```

## Storage

```js
storage.setItem(key, value)
storage.getItem(key)
storage.removeItem(key)
storage.clear()
```

Uses `@zos/storage` `LocalStorage` with adapter-local serialization and a small in-memory fallback for non-runtime environments.

Example:

```js
storage.setItem('match', payload)
const saved = storage.getItem('match')
```

## Haptics

```js
haptics.vibrate(duration)
haptics.vibrateLight()
haptics.vibrateStrongReminder()
haptics.vibratePattern(pattern)
```

Uses `@zos/sensor` `Vibrator`. On API `3.6+`, action arrays and `getType()` allow richer vibration patterns without keeping legacy vibrate-sensor code in mainline.

Example:

```js
haptics.vibrateLight()
haptics.vibratePattern([20, 30, 20])
```

## Usage Guidance

- Prefer adapter calls at page boundaries instead of scattered direct platform calls.
- Prefer `@zos/*` imports in shared utilities and only wrap behavior here when multiple pages benefit from one runtime contract.
- Do not add new `hmApp`, `hmSetting`, `hmSensor`, or legacy `param` transport fallbacks to this file.
- Use `resetPlatformAdaptersState()` only for deterministic non-runtime scenarios such as isolated harnesses.
