# Plan 79 Remove Remaining Legacy API 1.x Compatibility for API Level 3.6+

## Goal
Remove the remaining Zepp OS 1.x compatibility layer from the mainline codebase so the app is explicitly and only engineered for Zepp OS API Level 3.6+.

## Scope
- In scope: runtime code, adapter code, test infrastructure, active developer docs, and lint/tooling that still assume `hm*` globals or Zepp OS 1.x documentation.
- Out of scope: rewriting historical development logs or old plan documents line-by-line. Those should be treated as archive material, not active guidance.

## Current baseline
- `app.json` already targets `minVersion`, `target`, and `compatible` = `3.6`.
- Page code already imports modern modules such as `@zos/ui`, `@zos/router`, `@zos/display`, `@zos/i18n`, `@zos/device`, and `@zos/storage`.
- The remaining legacy surface is concentrated in compatibility seams, tests, comments, and top-level project guidance.

## Deep research findings

### 1. Runtime compatibility layer still contains Zepp OS 1.x fallbacks
Confirmed legacy code remains in `utils/platform-adapters.js`.

Legacy paths still implemented there:
- `resolveLegacyApp()` -> `hmApp`
- `resolveLegacySetting()` -> `hmSetting`
- `resolveLegacySensorApi()` -> `hmSensor`
- `resolveLegacyUi()` -> `hmUI.showToast` fallback
- `createLegacyNavigationPayload()` -> legacy `param` payload shape
- legacy gesture bridge -> `registerGestureEvent` / `unregisterGestureEvent`
- legacy keep-awake bridge -> `setBrightScreen` / `setBrightScreenCancel`
- legacy haptics bridge -> `hmSensor.createSensor(hmSensor.id.VIBRATE)`

Why this is now removable:
- Zepp OS 3.6+ has first-class replacements:
  - router: `@zos/router` `push`, `replace`, `back`, `home`
  - device info: `@zos/device` `getDeviceInfo`
  - toast and gestures: `@zos/interaction` `showToast`, `onGesture`, `offGesture`
  - display keep-awake: `@zos/display` `setPageBrightTime`, `resetPageBrightTime`, `pausePalmScreenOff`, `resetPalmScreenOff`, `pauseDropWristScreenOff`, `resetDropWristScreenOff`
  - haptics: `@zos/sensor` `Vibrator`, including `getType()` and action arrays starting at API 3.6
  - storage: `@zos/storage` `LocalStorage`

### 2. Screen metrics still preserve a legacy `hmSetting` fallback
Confirmed in `utils/screen-utils.js`.

Residual legacy behavior:
- docs comment still says `hmSetting.getDeviceInfo()` is the source of truth
- runtime fallback still calls `hmSetting.getDeviceInfo()` when `@zos/device` fails

3.6+ replacement:
- use only `@zos/device` `getDeviceInfo()` and normalize `screenShape` there
- keep Node-test fallback defaults, but remove runtime fallback to `hmSetting`

### 3. App bootstrap still depends on `hmApp.setScreenKeep`
Confirmed in `app.js`.

Residual legacy behavior:
- `App.onCreate()` still checks `hmApp.setScreenKeep(true)`
- the file comment explicitly says this is intentionally left out of the previous page migration

3.6+ direction:
- replace app-global keep-screen logic with documented 3.x display behavior
- keep page-scoped wake policy in the display adapter instead of a global `hmApp` hook
- verify whether `setWakeUpRelaunch` plus page-scoped display controls already cover the intended recovery behavior before removing this line

### 4. Some routing and param handling still assumes 1.x payload semantics
Confirmed in `utils/platform-adapters.js` and `page/history-detail.js`.

Residual legacy behavior:
- `createLegacyNavigationPayload()` builds legacy `param`
- `page/history-detail.js` comment still describes params as coming from `gotoPage 'param'`
- `parseParams()` still supports legacy object and string/query payload permutations

3.6+ direction:
- standardize all page navigation on `@zos/router` payloads with `params`
- define one canonical payload contract for detail pages
- keep only the parsing needed for current router usage, not v1 transport quirks

### 5. Test infrastructure still models the app as a legacy `hm*` runtime
Confirmed in:
- `tests/__mocks__/@zos/router.js`
- `tests/__mocks__/@zos/device.js`
- `tests/__mocks__/@zos/display.js`
- many page tests that stub `globalThis.hmApp` and `globalThis.hmSetting`
- `tests/platform-adapters.test.js`

Residual legacy behavior:
- modern `@zos/*` mocks proxy back into `hm*` globals
- tests validate legacy adapter fallbacks as success paths
- page tests still use legacy runtime objects for navigation and device info assertions

3.6+ direction:
- flip mocks so `@zos/*` modules are the primary interface
- remove legacy success-path assertions from adapter tests
- update page and utility tests to stub modern modules or adapter exports only

### 6. Tooling still permits legacy globals as first-class runtime APIs
Confirmed in `biome.json` and `README.md`.

Residual legacy behavior:
- `biome.json` still declares `hmApp`, `hmSensor`, and `hmSetting` globals
- README still documents those globals as expected project-level runtime names

3.6+ direction:
- remove global declarations that are no longer valid production APIs for mainline code
- keep `hmUI` only if still needed as an actual undeclared global, otherwise rely on module imports only

### 7. Active project guidance still tells contributors to build for Zepp OS 1.0
Confirmed in:
- `CONTEXT.md`
- `AGENTS.md`
- `README.md`
- `docs/PLATFORM_ADAPTERS.md`
- `docs/match-state-integration.md`
- parts of `docs/PRD.md`, `docs/PRD-Review.md`, and `docs/PRD-Finish-Match.md`

Residual legacy behavior:
- project guidance still points to `/docs/1.0/`
- active docs still describe v1 lifecycle rules as current policy
- adapter docs still describe legacy fallback as part of the supported path

3.6+ direction:
- update active guidance to 3.6+
- clearly mark historical PRDs/logs/plans as archival if they intentionally preserve migration history
- avoid spending time rewriting every old delivery log unless it is still used for onboarding or implementation guidance

## Documentation references for replacements
- Router `push`: `https://docs.zepp.com/docs/reference/device-app-api/newAPI/router/push/`
- Router `replace`: `https://docs.zepp.com/docs/reference/device-app-api/newAPI/router/replace/`
- Router `back`: `https://docs.zepp.com/docs/reference/device-app-api/newAPI/router/back/`
- Router `home`: `https://docs.zepp.com/docs/reference/device-app-api/newAPI/router/home/`
- Device `getDeviceInfo`: `https://docs.zepp.com/docs/reference/device-app-api/newAPI/device/getDeviceInfo/`
- Interaction `showToast`: `https://docs.zepp.com/docs/reference/device-app-api/newAPI/interaction/showToast/`
- Interaction `onGesture`: `https://docs.zepp.com/docs/reference/device-app-api/newAPI/interaction/onGesture/`
- Interaction `offGesture`: `https://docs.zepp.com/docs/reference/device-app-api/newAPI/interaction/offGesture/`
- Display `setPageBrightTime`: `https://docs.zepp.com/docs/reference/device-app-api/newAPI/display/setPageBrightTime/`
- Display `resetPageBrightTime`: `https://docs.zepp.com/docs/reference/device-app-api/newAPI/display/resetPageBrightTime/`
- Display `pausePalmScreenOff`: `https://docs.zepp.com/docs/reference/device-app-api/newAPI/display/pausePalmScreenOff/`
- Sensor `Vibrator`: `https://docs.zepp.com/docs/reference/device-app-api/newAPI/sensor/Vibrator/`
- Storage `LocalStorage`: `https://docs.zepp.com/docs/reference/device-app-api/newAPI/storage/localStorage/`

## Removal strategy

### Phase 1 - Remove runtime legacy fallbacks
1. Simplify `utils/platform-adapters.js` to a 3.6-only adapter surface.
2. Delete `resolveLegacyApp`, `resolveLegacySetting`, `resolveLegacySensorApi`, `resolveLegacyUi`, `resolveLegacyVibrateSensor`, and `createLegacyNavigationPayload`.
3. Keep deterministic non-Zepp test fallbacks, but only for Node safety, not for 1.x runtime support.
4. Make router, toast, gesture, keep-awake, storage, and haptics fail through documented 3.6 paths only.

### Phase 2 - Remove remaining production-code legacy hooks
1. Update `utils/screen-utils.js` to rely only on `@zos/device` plus test defaults.
2. Replace the app-level `hmApp.setScreenKeep(true)` path in `app.js` with a documented 3.x-only approach or remove it after behavior validation.
3. Simplify `page/history-detail.js` param handling to the one supported router payload contract.
4. Audit comments in runtime files and delete references to Zepp OS 1.x behavior when no longer true.

### Phase 3 - Rebuild the tests around 3.6+
1. Rewrite `tests/__mocks__/@zos/router.js`, `tests/__mocks__/@zos/device.js`, and `tests/__mocks__/@zos/display.js` so they no longer proxy to `hm*` globals.
2. Update page tests to stub `@zos/*` modules or the adapter layer directly.
3. Replace adapter tests that currently prove legacy fallback behavior with tests that prove strict 3.6 behavior and safe Node fallback behavior.
4. Remove or rewrite tests whose only purpose is validating `hmApp` / `hmSetting` / `hmSensor` compatibility.

### Phase 4 - Tighten tooling and docs
1. Remove obsolete legacy globals from `biome.json`.
2. Rewrite `CONTEXT.md`, `AGENTS.md`, `README.md`, and `docs/PLATFORM_ADAPTERS.md` so they describe 3.6+ as the only supported runtime.
3. Update active product/architecture docs that still present v1 lifecycle semantics as current policy.
4. For historical docs, either leave them untouched as archive material or add an archive note instead of rewriting them all.

## Recommended execution order
1. `utils/platform-adapters.js`
2. `utils/screen-utils.js`
3. `app.js`
4. `page/history-detail.js`
5. `tests/__mocks__/@zos/*.js`
6. affected page and adapter tests
7. `biome.json`
8. active documentation

## Risks and checks
- Router cleanup risk: params parsing can silently break history-detail routing. Add focused tests before deleting legacy parsing branches.
- Keep-awake risk: removing `hmApp.setScreenKeep` can change resume behavior after screen-off. Re-test active-game sleep/wake flows on device.
- Haptics risk: removing legacy sensor fallback changes behavior in Node tests. Keep a mockable `Vibrator` seam in tests.
- Documentation risk: historical logs will still mention v1. That is acceptable if active guidance clearly points to 3.6+ and archive docs are not treated as current instructions.

## Definition of done
- No production runtime file depends on `hmApp`, `hmSetting`, or `hmSensor`.
- No active contributor guidance points to Zepp OS 1.0 as the current target.
- Test infrastructure models `@zos/*` modules as the primary runtime surface.
- Biome no longer whitelists obsolete runtime globals.
- `npm run complete-check` passes after the cleanup.

## Implementation todo list
- [ ] Remove 1.x fallback branches from `utils/platform-adapters.js`
- [ ] Remove `hmSetting` fallback from `utils/screen-utils.js`
- [ ] Replace or remove `hmApp.setScreenKeep(true)` in `app.js`
- [ ] Normalize page routing params to one 3.6+ contract, starting with `page/history-detail.js`
- [ ] Rewrite `tests/__mocks__/@zos/router.js` to be independent from `hmApp`
- [ ] Rewrite `tests/__mocks__/@zos/device.js` to be independent from `hmSetting`
- [ ] Rewrite `tests/__mocks__/@zos/display.js` to be independent from `hmApp`
- [ ] Update adapter and page tests that still stub `globalThis.hmApp` / `globalThis.hmSetting` / `globalThis.hmSensor`
- [ ] Remove obsolete legacy globals from `biome.json`
- [ ] Rewrite active docs (`CONTEXT.md`, `AGENTS.md`, `README.md`, `docs/PLATFORM_ADAPTERS.md`, `docs/match-state-integration.md`) for 3.6+
- [ ] Add archive markers only where old docs are intentionally kept for historical context
- [ ] Run `npm run complete-check`
