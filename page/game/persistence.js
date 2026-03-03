import { DEFAULT_SETS_TO_PLAY } from '../../utils/constants.js'
import { createInitialMatchState } from '../../utils/match-state.js'
import {
  MATCH_STATUS as PERSISTED_MATCH_STATUS,
  toIsoTimestampSafe
} from '../../utils/match-state-schema.js'
import {
  getActiveSession,
  saveActiveSession
} from '../../utils/match-storage.js'
import {
  cloneMatchState,
  cloneSetHistoryWithFirstSetFallback as cloneSetHistory,
  isRecord,
  isSupportedSetConfiguration,
  isTeamIdentifier,
  isTieBreakMode,
  resolveSetsToPlayFromSetsNeededToWin,
  resolveWinnerTeam,
  toNonNegativeInteger,
  toPersistedPointValue,
  toPositiveInteger,
  toRuntimePointValue,
  toSupportedSetsToPlay
} from '../../utils/validation.js'
import {
  applyWinnerMetadata,
  clearWinnerMetadata,
  isValidRuntimeMatchState
} from './logic.js'

export function loadState() {
  return getActiveSession()
}

export function saveState(state) {
  saveActiveSession(state)
}

export function isPersistedMatchStateActive(matchState) {
  return (
    isRecord(matchState) && matchState.status === PERSISTED_MATCH_STATUS.ACTIVE
  )
}

export function mergeRuntimeStateWithPersistedSession(
  runtimeMatchState,
  persistedMatchState
) {
  if (!isValidRuntimeMatchState(runtimeMatchState)) {
    return createInitialMatchState()
  }

  const mergedState = cloneMatchState(runtimeMatchState)

  // Use runtime-safe active check — avoid calling the schema validator which
  // triggers toISOString() and crashes on Zepp OS v1.0.
  if (!isPersistedMatchStateActive(persistedMatchState)) {
    return mergedState
  }

  const currentSetNumber = toPositiveInteger(
    persistedMatchState?.currentSet?.number,
    toPositiveInteger(mergedState.currentSetStatus.number, 1)
  )

  const teamAGames = toNonNegativeInteger(
    persistedMatchState?.currentSet?.games?.teamA,
    toNonNegativeInteger(mergedState.currentSetStatus.teamAGames, 0)
  )

  const teamBGames = toNonNegativeInteger(
    persistedMatchState?.currentSet?.games?.teamB,
    toNonNegativeInteger(mergedState.currentSetStatus.teamBGames, 0)
  )

  mergedState.currentSetStatus.number = currentSetNumber
  mergedState.currentSet = currentSetNumber
  mergedState.currentSetStatus.teamAGames = teamAGames
  mergedState.currentSetStatus.teamBGames = teamBGames
  mergedState.teamA.games = teamAGames
  mergedState.teamB.games = teamBGames

  const tieBreakMode = isTieBreakMode(teamAGames, teamBGames)

  mergedState.teamA.points = toRuntimePointValue(
    persistedMatchState?.currentGame?.points?.teamA,
    tieBreakMode,
    mergedState.teamA.points
  )

  mergedState.teamB.points = toRuntimePointValue(
    persistedMatchState?.currentGame?.points?.teamB,
    tieBreakMode,
    mergedState.teamB.points
  )

  mergedState.setsNeededToWin = toPositiveInteger(
    persistedMatchState.setsNeededToWin,
    toPositiveInteger(mergedState.setsNeededToWin, 2)
  )

  mergedState.setsWon = {
    teamA: toNonNegativeInteger(
      persistedMatchState?.setsWon?.teamA,
      toNonNegativeInteger(mergedState?.setsWon?.teamA, 0)
    ),
    teamB: toNonNegativeInteger(
      persistedMatchState?.setsWon?.teamB,
      toNonNegativeInteger(mergedState?.setsWon?.teamB, 0)
    )
  }

  mergedState.setHistory = cloneSetHistory(persistedMatchState.setHistory)
  mergedState.status =
    persistedMatchState.status === PERSISTED_MATCH_STATUS.FINISHED
      ? PERSISTED_MATCH_STATUS.FINISHED
      : PERSISTED_MATCH_STATUS.ACTIVE

  applyWinnerMetadata(mergedState, resolveWinnerTeam(persistedMatchState))

  if (mergedState.status !== PERSISTED_MATCH_STATUS.FINISHED) {
    clearWinnerMetadata(mergedState)
  }

  return mergedState
}

export function createPersistedMatchStateSnapshot(
  runtimeMatchState,
  basePersistedMatchState
) {
  if (!isValidRuntimeMatchState(runtimeMatchState)) {
    return null
  }

  // Use runtime-safe active check — avoid calling isPersistedMatchState (schema
  // validator) which triggers toISOString() and crashes on Zepp OS v1.0.
  // Build a minimal safe base state inline instead of calling createDefaultPersistedMatchState()
  // which also invokes the schema and may trigger toISOString() on the device.
  const fallbackTimestamp = Date.now()
  const fallbackTimestampIso = toIsoTimestampSafe(fallbackTimestamp)
  const baseState = isPersistedMatchStateActive(basePersistedMatchState)
    ? cloneMatchState(basePersistedMatchState)
    : {
        status: PERSISTED_MATCH_STATUS.ACTIVE,
        setsToPlay: DEFAULT_SETS_TO_PLAY,
        setsNeededToWin: Math.ceil(DEFAULT_SETS_TO_PLAY / 2),
        setsWon: { teamA: 0, teamB: 0 },
        currentSet: { number: 1, games: { teamA: 0, teamB: 0 } },
        currentGame: { points: { teamA: 0, teamB: 0 } },
        setHistory: [],
        schemaVersion: 1,
        updatedAt: fallbackTimestamp,
        timing: {
          createdAt: fallbackTimestampIso,
          updatedAt: fallbackTimestampIso,
          startedAt: fallbackTimestampIso,
          finishedAt: null
        }
      }

  const setsNeededToWin = toPositiveInteger(
    runtimeMatchState.setsNeededToWin,
    toPositiveInteger(baseState?.setsNeededToWin, 2)
  )
  const baseSetsToPlay = toSupportedSetsToPlay(baseState?.setsToPlay)
  const setsToPlay = isSupportedSetConfiguration(
    baseSetsToPlay,
    setsNeededToWin
  )
    ? baseSetsToPlay
    : resolveSetsToPlayFromSetsNeededToWin(setsNeededToWin)
  const winnerTeam = resolveWinnerTeam(runtimeMatchState)

  const persistedSnapshot = {
    ...baseState,
    status:
      runtimeMatchState.status === PERSISTED_MATCH_STATUS.FINISHED
        ? PERSISTED_MATCH_STATUS.FINISHED
        : PERSISTED_MATCH_STATUS.ACTIVE,
    setsToPlay,
    setsNeededToWin,
    setsWon: {
      teamA: toNonNegativeInteger(
        runtimeMatchState?.setsWon?.teamA,
        toNonNegativeInteger(baseState?.setsWon?.teamA, 0)
      ),
      teamB: toNonNegativeInteger(
        runtimeMatchState?.setsWon?.teamB,
        toNonNegativeInteger(baseState?.setsWon?.teamB, 0)
      )
    },
    currentSet: {
      number: toPositiveInteger(runtimeMatchState.currentSetStatus.number, 1),
      games: {
        teamA: toNonNegativeInteger(
          runtimeMatchState.currentSetStatus.teamAGames,
          0
        ),
        teamB: toNonNegativeInteger(
          runtimeMatchState.currentSetStatus.teamBGames,
          0
        )
      }
    },
    currentGame: {
      points: {
        teamA: toPersistedPointValue(runtimeMatchState.teamA.points),
        teamB: toPersistedPointValue(runtimeMatchState.teamB.points)
      }
    },
    setHistory: cloneSetHistory(runtimeMatchState.setHistory),
    schemaVersion: toPositiveInteger(baseState.schemaVersion, 1)
  }

  if (isTeamIdentifier(winnerTeam)) {
    persistedSnapshot.winnerTeam = winnerTeam
  } else {
    delete persistedSnapshot.winnerTeam
  }

  return persistedSnapshot
}

export function serializeMatchStateForComparison(matchState) {
  try {
    return JSON.stringify(matchState)
  } catch {
    return ''
  }
}
