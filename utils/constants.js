import {
  MATCH_STATUS,
  SETS_NEEDED_TO_WIN,
  SETS_TO_PLAY
} from './match-state-schema.js'
import { SCORE_POINTS } from './scoring-constants.js'

export { MATCH_STATUS, SCORE_POINTS, SETS_NEEDED_TO_WIN, SETS_TO_PLAY }

export const MATCH_SET_OPTIONS = Object.freeze([
  SETS_TO_PLAY.ONE,
  SETS_TO_PLAY.THREE,
  SETS_TO_PLAY.FIVE
])

export const DEFAULT_SETS_TO_PLAY = SETS_TO_PLAY.THREE

export const PERSISTED_ADVANTAGE_POINT_VALUE = 50
export const PERSISTED_GAME_POINT_VALUE = 60
export const TIE_BREAK_ENTRY_GAMES = 6

export const REGULAR_GAME_POINT_VALUES = Object.freeze([
  SCORE_POINTS.LOVE,
  SCORE_POINTS.FIFTEEN,
  SCORE_POINTS.THIRTY,
  SCORE_POINTS.FORTY
])

export const TEAM_IDENTIFIERS = Object.freeze(['teamA', 'teamB'])

export const FS_O_RDONLY = 0
export const FS_O_WRONLY = 1
export const FS_O_CREAT = 64
export const FS_O_TRUNC = 512

function hasNumericHmFsFlag(fileSystemApi, flagName) {
  return typeof fileSystemApi?.[flagName] === 'number'
}

/**
 * @param {{ O_RDONLY?: unknown } | null | undefined} fileSystemApi
 * @returns {number}
 */
export function resolveFsReadOnlyFlag(fileSystemApi) {
  return hasNumericHmFsFlag(fileSystemApi, 'O_RDONLY')
    ? fileSystemApi.O_RDONLY
    : FS_O_RDONLY
}

/**
 * @param {{ O_WRONLY?: unknown } | null | undefined} fileSystemApi
 * @returns {number}
 */
export function resolveFsWriteOnlyFlag(fileSystemApi) {
  return hasNumericHmFsFlag(fileSystemApi, 'O_WRONLY')
    ? fileSystemApi.O_WRONLY
    : FS_O_WRONLY
}

/**
 * @param {{ O_CREAT?: unknown } | null | undefined} fileSystemApi
 * @returns {number}
 */
export function resolveFsCreateFlag(fileSystemApi) {
  return hasNumericHmFsFlag(fileSystemApi, 'O_CREAT')
    ? fileSystemApi.O_CREAT
    : FS_O_CREAT
}

/**
 * @param {{ O_TRUNC?: unknown } | null | undefined} fileSystemApi
 * @returns {number}
 */
export function resolveFsTruncateFlag(fileSystemApi) {
  return hasNumericHmFsFlag(fileSystemApi, 'O_TRUNC')
    ? fileSystemApi.O_TRUNC
    : FS_O_TRUNC
}

/**
 * @param {{ O_WRONLY?: unknown, O_CREAT?: unknown, O_TRUNC?: unknown } | null | undefined} fileSystemApi
 * @returns {number}
 */
export function resolveFsWriteCreateTruncateFlags(fileSystemApi) {
  return (
    resolveFsWriteOnlyFlag(fileSystemApi) |
    resolveFsCreateFlag(fileSystemApi) |
    resolveFsTruncateFlag(fileSystemApi)
  )
}
