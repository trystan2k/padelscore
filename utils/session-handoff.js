/**
 * Session handoff helpers.
 *
 * On Zepp OS v1.0 each page runs in an isolated JS context — module-level
 * variables are re-initialised to their default values when a new page loads.
 * A module singleton therefore cannot carry state across a page transition.
 *
 * The real cross-page handoff channel is `app.globalData`, which lives in the
 * OS-level App object and survives page transitions.  The functions below are
 * intentional no-ops kept so that callers in setup.js and index.js do not need
 * to be changed; the actual persistence is done by `storeSessionHandoff()` /
 * `storeResumeSessionHandoff()` writing directly to `app.globalData`.
 */

/**
 * No-op on Zepp OS — cross-page state is carried via app.globalData instead.
 * @param {unknown} _matchState
 * @returns {boolean}
 */
export function setPendingPersistedMatchState(_matchState) {
  return false
}

/**
 * No-op on Zepp OS — cross-page state is carried via app.globalData instead.
 * @returns {null}
 */
export function consumePendingPersistedMatchState() {
  return null
}
