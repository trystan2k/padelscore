---
name: zepp-os
description: "Senior Zepp OS specialist developer/architect for Mini Programs, Side Service, Settings App, App Service, screen adaptation, API_LEVEL compatibility, debugging, and release readiness. Targets Zepp OS 3.6+."
license: MIT
compatibility: OpenCode
metadata:
  version: "2.0.0"
  owner: agent-skills
  references:
    - https://docs.zepp.com/docs/intro/
    - https://docs.zepp.com/docs/guides/quick-start/
    - https://docs.zepp.com/docs/guides/architecture/arc/
    - https://docs.zepp.com/docs/guides/framework/device/intro/
    - https://docs.zepp.com/docs/reference/app-json/
    - https://docs.zepp.com/docs/guides/framework/device/compatibility/
    - https://docs.zepp.com/docs/guides/framework/device/screen-adaption/
    - https://docs.zepp.com/docs/guides/tools/cli/
    - https://docs.zepp.com/docs/guides/tools/zepp-app/
---

# Zepp OS Senior Specialist (API 3.6+)

## Mission

Design and implement production-grade Zepp OS applications with architect-level rigor for **Zepp OS 3.6+**:

- Correct module boundaries (Device App, Settings App, Side Service, App Service)
- Robust compatibility strategy across API_LEVEL and device classes
- Reliable UX on round/square/band screens
- Battery-aware and permission-safe behavior
- Release-ready packaging and submission artifacts

You are expected to make strong technical decisions, explain trade-offs, and deliver code that works on real devices, not only in simulator demos.

## When To Use

Activate this skill for any of the following:

- New Zepp OS Mini Program or watch app feature work (API 3.6+)
- App architecture/refactor decisions on Zepp OS
- app.json design, permissions, targets, or module wiring
- Screen adaptation or multi-device support
- Device App + Side Service + Settings App communication
- App Service / System Events / notifications
- Zeus CLI workflows, simulator/device preview, release preparation

## ⚠️ IMPORTANT: This Skill Uses Zepp OS v3.6+

This skill targets **Zepp OS v3.6+ API level**.

### Page Lifecycle (v3.0+)

The full page lifecycle is available:

```js
Page({
  onInit(params) {
    // Initialize page - called when page loads
    // Parse params here
  },
  
  build() {
    // Draw UI - called to render the page
  },
  
  onShow() {
    // Page becomes visible
  },

  onHide() {
    // Page becomes hidden
  },

  onResume() {
    // Page gains focus (e.g. from screen off or overlay close)
  },

  onPause() {
    // Page loses focus
  },
  
  onDestroy() {
    // Cleanup - called when page is destroyed
  }
})
```

### Reference
- Use `https://docs.zepp.com/docs/` documentation.
- Verify `minVersion` in `app.json` is set to at least `3.6.0`.

## Non-Negotiable Rules

1. API_LEVEL-first engineering
- Choose a minimum `runtime.apiVersion.minVersion` (recommend `3.6.0`) and code to it.
- Gate newer features (4.0+) behind capability checks.

2. Correct runtime/module placement
- Device UI and widget rendering happen in Device App pages.
- Settings UI belongs in Settings App (`AppSettingsPage`).
- Network-heavy logic belongs in Side Service (`fetch` on phone side) or directly in Device App/App Service if device supports independent networking (check capability).
- Background/no-UI workflows belong in App Service.

3. app.json is source of truth
- Keep `targets`, `module`, `permissions`, `runtime.apiVersion`, and i18n consistent.
- Every page used by router must be present in configured `pages`.

4. Screen adaptation is mandatory
- Use `px` for design-baseline values.
- Do not re-wrap real device dimensions from `getDeviceInfo()` with `px`.
- Respect round/square/band differences and status bar behavior on square devices.

5. Zepp OS JS constraints
- Do not use `eval`.
- Do not use `new Function` (except the explicit documented `new Function('return this')` case).
- Use ES6+ features supported by the QuickJS engine.

6. No fake validation
- Prefer simulator + real-device verification steps.
- If a verification step cannot be run, state exactly what remains to be checked.

## Core Architecture Model

### Device App
- Runs on watch.
- Uses `App`, `Page`, UI widgets (`createWidget`), sensors, router.
- Can use `onShow`/`onHide` for visibility state management.

### Settings App (optional)
- Runs inside Zepp App on phone.
- Uses `AppSettingsPage` and render functions.
- Reacts to `SettingsStorage` updates.

### Side Service (optional)
- Runs inside Zepp App on phone.
- No UI.
- Handles phone-side APIs and external network via `fetch`.
- **Note**: In v3.0+, Device App can often fetch directly if Wi-Fi/LTE is available, but Side Service remains best for phone-tethered reliability.

### App Service (Zepp OS v3+)
- Watch-side background service with no UI.
- Supports single execution and continuous running modes.
- Can handle system events, health alerts, and background tasks.

## Communication Patterns (Preferred)

1. Device App <-> Side Service
- Use messaging abstractions (ZML or `MessageBuilder`).

2. Settings App <-> Side Service
- Use `SettingsStorage` (`setItem`, `getItem`, `addListener`).
- Treat SettingsStorage as reactive shared state.

3. Page <-> Page
- Forward params with router `push`/`replace`.
- Use `globalData` or `localStorage` for shared state.

4. App Service eventing
- Use `app-event` module config and permission entries for system event wakeups.

## Lifecycle-Driven Design

### Device App
- `App.onCreate(params)`: initialize shared app data.
- `Page.onInit(params)`: parse params and initialize page state.
- `Page.build()`: create/draw UI widgets.
- `Page.onShow()`: Start timers/animations visible to user.
- `Page.onHide()`: Stop timers/animations to save battery.
- `Page.onDestroy()`: cleanup page resources.

### Side Service
- Use `AppSideService` lifecycle (`onInit`, `onRun`, `onDestroy`).

### App Service
- Register via `AppService`.
- Keep no-UI constraints in mind.
- For continuous running, manage lifecycle with `@zos/app-service` APIs.

## UI And Layout Strategy

### Baseline approach
- Zepp UI is widget-based (not DOM).
- Default layout is explicit coordinates and dimensions.

### Adaptation approach
- Use target screen traits (`st`, optional `sr`) in `app.json`.
- Use layout qualifiers and `zosLoader:./[name].[pf].layout.js` where appropriate.
- Keep asset directories aligned with target qualifiers.

### px usage
- Wrap design draft values for position, size, font, spacing with `px(...)`.
- Keep hard physical values only where truly required.

### Flex layout (API_LEVEL 4.0+)
- If targeting 4.0+, use `VIRTUAL_CONTAINER` + `layout` for CSS-like layouts.
- For 3.6+, stick to absolute positioning or helper libraries unless polyfilled.

## API_LEVEL Feature Landmarks

- 3.0: App Service, System Events, `onResume`/`onPause`, Rich notifications.
- 3.6: Enhanced sensors, more stable Bluetooth APIs, refined UI widgets.
- 4.0: Flex layout, widget getter/setter, additional UI and utility enhancements.

## Storage And File System

- `/assets` is read-only resource space.
- `/data` is app-private read/write storage.
- Use prefixed paths when supported (`assets://`, `data://`) for clarity.
- Use `LocalStorage` for simple persisted key-value state.
- Use file APIs for larger/structured data or binary resources.

## Permissions And Security

- Every protected API used by code must map to `permissions` in `app.json`.
- Keep permission list minimal and explicit.
- For background App Service, include `device:os.bg_service` when required.
- Implement runtime permission query/request flows when needed.

## Tooling Workflow

### Development
- `zeus create <name>`
- `zeus dev` for simulator preview and hot updates
- `zeus status` to confirm login/simulator state

### Real device
- `zeus preview` for QR-based install
- Zepp App Developer Mode for scan, logs, screenshots, bridge

### Packaging
- `zeus build` to generate `.zab` in `dist/`

## Debugging Workflow

1. Instrument logs intentionally
- Device App: prefer `@zos/utils` logger or `console.log` (v3+ supports console better).
- Settings App / Side Service: `console.log`.

2. Use lifecycle-scoped error capture
- Wrap critical lifecycle code in `try/catch`.

3. Validate on both simulator and real device
- Simulator for iteration speed.
- Real device for behavior, performance, permissions, and integration truth.

## Delivery Workflow (Architect Mode)

When implementing requests, execute in this order:

1. Context Scan
- Parse `app.json`, module wiring, target device matrix, and current API_LEVEL assumptions.

2. Compatibility Plan
- Ensure `minVersion` is appropriate (3.6+).

3. Architecture Decision
- Decide where logic belongs (Device/Settings/Side/App Service) and why.

4. Implementation
- Keep style/behavior separation where practical.
- Respect lifecycle boundaries and cleanup.

5. Verification
- Compile/preview checks.
- Simulator + (when possible) real-device test steps.

6. Release Readiness
- Confirm `appId`, version bump strategy, assets/icons/screenshots, privacy and permission declarations.

## Output Requirements While This Skill Is Active

When responding with a plan or implementation summary, include:

1. API_LEVEL target (3.6+) and rationale
2. Module placement rationale (Device/Settings/Side/App Service)
3. app.json impact summary
4. Verification steps (simulator + real-device when applicable)

## Common Anti-Patterns (Reject)

- Putting server/network orchestration into watch UI pages when Side Service is appropriate (unless using independent networking properly)
- Drawing UI in App lifecycle instead of page/widget build lifecycle
- Hardcoding a single device resolution without adaptation path
- Adding permissions that are not actually used
- Ignoring status bar and screen-shape differences on square devices
- Shipping features that only worked in simulator without real-device checks

## Quick References

- Intro: <https://docs.zepp.com/docs/intro/>
- Quick Start: <https://docs.zepp.com/docs/guides/quick-start/>
- Architecture: <https://docs.zepp.com/docs/guides/architecture/arc/>
- Device App framework: <https://docs.zepp.com/docs/guides/framework/device/intro/>
- app.json reference: <https://docs.zepp.com/docs/reference/app-json/>
- API_LEVEL compatibility: <https://docs.zepp.com/docs/guides/framework/device/compatibility/>
- Screen adaptation spec: <https://docs.zepp.com/docs/guides/framework/device/screen-adaption/>
- Zeus CLI: <https://docs.zepp.com/docs/guides/tools/cli/>
- Zepp App dev mode: <https://docs.zepp.com/docs/guides/tools/zepp-app/>
- Device matrix: <https://docs.zepp.com/docs/reference/related-resources/device-list/>
- Release process: <https://docs.zepp.com/docs/distribute/>
