## What
Zepp OS v3+ docs state standard JavaScript timers are unsupported, while the current app relies on `setTimeout`/`clearTimeout` for confirmation windows, delayed navigation, haptic pulses, and persistence debounce.

## Why
This is a migration risk for the Zepp OS 3+ planning work.

## Where
Current timer usage appears in `page/game.js`, `page/settings.js`, `page/history-detail.js`, and `page/summary.js`.

## Learned
For an API_LEVEL `3.6` target, the documented `@zos/timer` system timer APIs start at `4.0`, so the safest migration plan is to remove or redesign timer-dependent UI behaviors rather than depend on undocumented timer support.