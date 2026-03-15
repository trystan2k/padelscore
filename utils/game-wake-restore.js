import { deleteState, loadState, saveState } from './persistence.js'

const GAME_WAKE_RESTORE_KEY = 'padel-buddy.game-wake-restore'

export function enableGameWakeRestore() {
  return saveState(GAME_WAKE_RESTORE_KEY, true)
}

export function disableGameWakeRestore() {
  return deleteState(GAME_WAKE_RESTORE_KEY)
}

export function shouldRestoreGameOnLaunch() {
  return loadState(GAME_WAKE_RESTORE_KEY, { fallback: false }) === true
}
