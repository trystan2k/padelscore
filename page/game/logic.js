import { createHistoryStack, deepCopyState } from '../../utils/history-stack.js'
import { MATCH_STATUS as PERSISTED_MATCH_STATUS } from '../../utils/match-state-schema.js'
import { scoresEqual } from '../../utils/object-helpers.js'
import { addPoint } from '../../utils/scoring-engine.js'
import {
  cloneMatchState,
  cloneSetHistoryWithFirstSetFallback as cloneSetHistory,
  isRecord,
  isTeamIdentifier,
  toNonNegativeInteger,
  toPositiveInteger
} from '../../utils/validation.js'

function createCurrentSetSnapshot(matchState) {
  const setNumber = toPositiveInteger(
    matchState?.currentSetStatus?.number,
    toPositiveInteger(matchState?.currentSet, 1)
  )

  return {
    setNumber,
    teamAGames: toNonNegativeInteger(
      matchState?.currentSetStatus?.teamAGames,
      toNonNegativeInteger(matchState?.teamA?.games, 0)
    ),
    teamBGames: toNonNegativeInteger(
      matchState?.currentSetStatus?.teamBGames,
      toNonNegativeInteger(matchState?.teamB?.games, 0)
    )
  }
}

export function clearWinnerMetadata(matchState) {
  if (!isRecord(matchState)) {
    return
  }

  delete matchState.winnerTeam
  delete matchState.winner
}

export function applyWinnerMetadata(matchState, winnerTeam) {
  if (!isRecord(matchState)) {
    return
  }

  if (!isTeamIdentifier(winnerTeam)) {
    clearWinnerMetadata(matchState)
    return
  }

  matchState.winnerTeam = winnerTeam

  if (!isRecord(matchState.winner)) {
    matchState.winner = {
      team: winnerTeam
    }
    return
  }

  matchState.winner.team = winnerTeam
}

export function isValidRuntimeMatchState(matchState) {
  return (
    isRecord(matchState) &&
    isRecord(matchState.teams) &&
    isRecord(matchState.teams.teamA) &&
    isRecord(matchState.teams.teamB) &&
    isRecord(matchState.teamA) &&
    isRecord(matchState.teamB) &&
    isRecord(matchState.currentSetStatus)
  )
}

export function createManualFinishedMatchStateSnapshot(matchState) {
  if (!isValidRuntimeMatchState(matchState)) {
    return null
  }

  if (matchState.status === PERSISTED_MATCH_STATUS.FINISHED) {
    return cloneMatchState(matchState)
  }

  const nextState = cloneMatchState(matchState)

  if (!isValidRuntimeMatchState(nextState)) {
    return null
  }

  const normalizedSetHistory = cloneSetHistory(nextState.setHistory)
  const currentSetSnapshot = createCurrentSetSnapshot(nextState)
  const hasCurrentSetSnapshot = normalizedSetHistory.some(
    (setEntry) => setEntry.setNumber === currentSetSnapshot.setNumber
  )

  if (!hasCurrentSetSnapshot) {
    normalizedSetHistory.push(currentSetSnapshot)
  }

  nextState.setHistory = normalizedSetHistory

  const setsWon = {
    teamA: toNonNegativeInteger(nextState?.setsWon?.teamA, 0),
    teamB: toNonNegativeInteger(nextState?.setsWon?.teamB, 0)
  }

  nextState.setsWon = setsWon
  nextState.status = PERSISTED_MATCH_STATUS.FINISHED

  if (setsWon.teamA > setsWon.teamB) {
    applyWinnerMetadata(nextState, 'teamA')
  } else if (setsWon.teamB > setsWon.teamA) {
    applyWinnerMetadata(nextState, 'teamB')
  } else {
    clearWinnerMetadata(nextState)
  }

  return nextState
}

export function didMatchTransitionToFinished(previousState, nextState) {
  return (
    isRecord(previousState) &&
    isRecord(nextState) &&
    previousState.status !== PERSISTED_MATCH_STATUS.FINISHED &&
    nextState.status === PERSISTED_MATCH_STATUS.FINISHED
  )
}

export function didMatchTransitionFromFinished(previousState, nextState) {
  return (
    isRecord(previousState) &&
    isRecord(nextState) &&
    previousState.status === PERSISTED_MATCH_STATUS.FINISHED &&
    nextState.status !== PERSISTED_MATCH_STATUS.FINISHED
  )
}

export function isHistoryStackLike(historyStack) {
  return (
    isRecord(historyStack) &&
    typeof historyStack.push === 'function' &&
    typeof historyStack.pop === 'function' &&
    typeof historyStack.clear === 'function' &&
    typeof historyStack.isEmpty === 'function'
  )
}

export function isSameMatchState(leftState, rightState) {
  return scoresEqual(leftState, rightState)
}

function getScoringTeamForTransition(previousState, nextState) {
  const nextStateAfterTeamA = addPoint(previousState, 'teamA')
  if (isSameMatchState(nextStateAfterTeamA, nextState)) {
    return 'teamA'
  }

  const nextStateAfterTeamB = addPoint(previousState, 'teamB')
  if (isSameMatchState(nextStateAfterTeamB, nextState)) {
    return 'teamB'
  }

  return null
}

function popHistorySnapshotsInOrder(historyStack) {
  const reverseChronologicalSnapshots = []

  while (!historyStack.isEmpty()) {
    const snapshot = historyStack.pop()
    if (snapshot === null) {
      break
    }

    reverseChronologicalSnapshots.push(snapshot)
  }

  return reverseChronologicalSnapshots.reverse()
}

function restoreHistorySnapshots(historyStack, snapshots) {
  historyStack.clear()

  snapshots.forEach((snapshot) => {
    historyStack.push(snapshot)
  })
}

export function removeLatestPointForTeamFromHistory(
  runtimeMatchState,
  historyStack,
  team
) {
  if (
    !isValidRuntimeMatchState(runtimeMatchState) ||
    !isHistoryStackLike(historyStack) ||
    !isTeamIdentifier(team)
  ) {
    return null
  }

  const historySnapshots = popHistorySnapshotsInOrder(historyStack)
  const currentStateSnapshot = deepCopyState(runtimeMatchState)
  const stateTimeline = [...historySnapshots, currentStateSnapshot]
  const scoringTeams = []

  for (let index = 1; index < stateTimeline.length; index += 1) {
    const scoringTeam = getScoringTeamForTransition(
      stateTimeline[index - 1],
      stateTimeline[index]
    )

    if (!scoringTeam) {
      restoreHistorySnapshots(historyStack, historySnapshots)
      return {
        didRemovePoint: false,
        historyStack,
        runtimeState: currentStateSnapshot
      }
    }

    scoringTeams.push(scoringTeam)
  }

  let removedEventIndex = -1
  for (let index = scoringTeams.length - 1; index >= 0; index -= 1) {
    if (scoringTeams[index] === team) {
      removedEventIndex = index
      break
    }
  }

  if (removedEventIndex === -1) {
    restoreHistorySnapshots(historyStack, historySnapshots)
    return {
      didRemovePoint: false,
      historyStack,
      runtimeState: currentStateSnapshot
    }
  }

  const rebuiltHistory = createHistoryStack()
  let rebuiltState = deepCopyState(stateTimeline[0])

  for (let index = 0; index < scoringTeams.length; index += 1) {
    if (index === removedEventIndex) {
      continue
    }

    rebuiltState = addPoint(rebuiltState, scoringTeams[index], rebuiltHistory)
  }

  return {
    didRemovePoint: true,
    historyStack: rebuiltHistory,
    runtimeState: rebuiltState
  }
}
