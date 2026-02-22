import { gettext } from 'i18n'

import { createScoreViewModel } from './score-view-model.js'
import { createHistoryStack, deepCopyState } from '../utils/history-stack.js'
import { createInitialMatchState } from '../utils/match-state.js'
import { SCORE_POINTS } from '../utils/scoring-constants.js'
import { addPoint, removePoint } from '../utils/scoring-engine.js'
import { loadMatchState, saveMatchState } from '../utils/match-storage.js'
import {
  MATCH_STATUS as PERSISTED_MATCH_STATUS,
  createDefaultMatchState as createDefaultPersistedMatchState,
  isMatchState as isPersistedMatchState
} from '../utils/match-state-schema.js'
import { loadState, saveState } from '../utils/storage.js'

const GAME_TOKENS = Object.freeze({
  colors: {
    accent: 0x1eb98c,
    accentPressed: 0x1aa07a,
    background: 0x000000,
    buttonText: 0x000000,
    buttonSecondary: 0x24262b,
    buttonSecondaryPressed: 0x2d3036,
    buttonSecondaryText: 0xffffff,
    cardBackground: 0x111318,
    dangerText: 0xff6d78,
    divider: 0x2a2d34,
    mutedText: 0x7d8289,
    text: 0xffffff
  },
  fontScale: {
    button: 0.038,
    headerLabel: 0.06,
    headerValue: 0.048,
    minusButton: 0.08,
    points: 0.28,
    teamLabel: 0.038
  },
  spacingScale: {
    headerTop: 0.04,
    bottomInset: 0.07,
    bottomInsetRound: 0.11,
    headerToScore: 0.06,
    sectionGap: 0.03
  }
})

const INTERACTION_LATENCY_TARGET_MS = 100
const SCORING_DEBOUNCE_WINDOW_MS = 300
const PERSISTENCE_DEBOUNCE_WINDOW_MS = 180
const PERSISTED_ADVANTAGE_POINT_VALUE = 50
const PERSISTED_GAME_POINT_VALUE = 60
const DEFAULT_SETS_TO_PLAY = 3
const TIE_BREAK_ENTRY_GAMES = 6
const REGULAR_GAME_POINT_VALUES = new Set([
  SCORE_POINTS.LOVE,
  SCORE_POINTS.FIFTEEN,
  SCORE_POINTS.THIRTY,
  SCORE_POINTS.FORTY
])

function cloneMatchState(matchState) {
  try {
    return JSON.parse(JSON.stringify(matchState))
  } catch {
    return matchState
  }
}

function ensureNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function calculateRoundSafeSideInset(width, height, yPosition, horizontalPadding) {
  const radius = Math.min(width, height) / 2
  const centerX = width / 2
  const centerY = height / 2
  const boundedY = clamp(yPosition, 0, height)
  const distanceFromCenter = Math.abs(boundedY - centerY)
  const halfChord = Math.sqrt(
    Math.max(0, radius * radius - distanceFromCenter * distanceFromCenter)
  )

  return Math.max(0, Math.ceil(centerX - halfChord + horizontalPadding))
}

function calculateRoundSafeSectionSideInset(
  width,
  height,
  sectionTop,
  sectionHeight,
  horizontalPadding
) {
  const boundedTop = clamp(sectionTop, 0, height)
  const boundedBottom = clamp(sectionTop + Math.max(sectionHeight, 0), 0, height)
  const middleY = (boundedTop + boundedBottom) / 2

  return Math.max(
    calculateRoundSafeSideInset(width, height, boundedTop, horizontalPadding),
    calculateRoundSafeSideInset(width, height, middleY, horizontalPadding),
    calculateRoundSafeSideInset(width, height, boundedBottom, horizontalPadding)
  )
}

function isRecord(value) {
  return typeof value === 'object' && value !== null
}

function isPersistedMatchStateActive(matchState) {
  return (
    isRecord(matchState) &&
    matchState.status === PERSISTED_MATCH_STATUS.ACTIVE
  )
}

function toNonNegativeInteger(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 ? value : fallback
}

function toPositiveInteger(value, fallback = 1) {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function toSupportedSetsToPlay(value, fallback = DEFAULT_SETS_TO_PLAY) {
  return value === 1 || value === 3 || value === 5 ? value : fallback
}

function resolveSetsToPlayFromSetsNeededToWin(setsNeededToWin) {
  if (setsNeededToWin <= 1) {
    return 1
  }

  if (setsNeededToWin >= 3) {
    return 5
  }

  return 3
}

function isSupportedSetConfiguration(setsToPlay, setsNeededToWin) {
  return Math.ceil(setsToPlay / 2) === setsNeededToWin
}

function toPersistedPointValue(value) {
  if (Number.isInteger(value) && value >= 0) {
    return value
  }

  if (value === 'Ad') {
    return PERSISTED_ADVANTAGE_POINT_VALUE
  }

  if (value === 'Game') {
    return PERSISTED_GAME_POINT_VALUE
  }

  return 0
}

function isTieBreakMode(teamAGames, teamBGames) {
  return teamAGames === TIE_BREAK_ENTRY_GAMES && teamBGames === TIE_BREAK_ENTRY_GAMES
}

function toRuntimePointValue(value, tieBreakMode, fallback = SCORE_POINTS.LOVE) {
  if (!Number.isInteger(value) || value < 0) {
    return fallback
  }

  if (tieBreakMode) {
    return value
  }

  if (value === PERSISTED_ADVANTAGE_POINT_VALUE) {
    return SCORE_POINTS.ADVANTAGE
  }

  if (value === PERSISTED_GAME_POINT_VALUE) {
    return SCORE_POINTS.GAME
  }

  if (REGULAR_GAME_POINT_VALUES.has(value)) {
    return value
  }

  return value
}

function cloneSetHistory(setHistory) {
  if (!Array.isArray(setHistory)) {
    return []
  }

  return setHistory.map((entry) => ({
    setNumber: toPositiveInteger(entry?.setNumber, 1),
    teamAGames: toNonNegativeInteger(entry?.teamAGames, 0),
    teamBGames: toNonNegativeInteger(entry?.teamBGames, 0)
  }))
}

function resolveWinnerTeam(matchState) {
  if (!isRecord(matchState)) {
    return null
  }

  if (isTeamIdentifier(matchState.winnerTeam)) {
    return matchState.winnerTeam
  }

  if (isRecord(matchState.winner) && isTeamIdentifier(matchState.winner.team)) {
    return matchState.winner.team
  }

  return null
}

function clearWinnerMetadata(matchState) {
  if (!isRecord(matchState)) {
    return
  }

  delete matchState.winnerTeam
  delete matchState.winner
}

function applyWinnerMetadata(matchState, winnerTeam) {
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

function mergeRuntimeStateWithPersistedSession(runtimeMatchState, persistedMatchState) {
  if (!isValidRuntimeMatchState(runtimeMatchState)) {
    return createInitialMatchState()
  }

  const mergedState = cloneMatchState(runtimeMatchState)

  if (!isPersistedMatchState(persistedMatchState)) {
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

function createPersistedMatchStateSnapshot(runtimeMatchState, basePersistedMatchState) {
  if (!isValidRuntimeMatchState(runtimeMatchState)) {
    return null
  }

  const baseState = isPersistedMatchState(basePersistedMatchState)
    ? cloneMatchState(basePersistedMatchState)
    : createDefaultPersistedMatchState()

  const setsNeededToWin = toPositiveInteger(
    runtimeMatchState.setsNeededToWin,
    toPositiveInteger(baseState?.setsNeededToWin, 2)
  )
  const baseSetsToPlay = toSupportedSetsToPlay(baseState?.setsToPlay)
  const setsToPlay = isSupportedSetConfiguration(baseSetsToPlay, setsNeededToWin)
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
        teamA: toNonNegativeInteger(runtimeMatchState.currentSetStatus.teamAGames, 0),
        teamB: toNonNegativeInteger(runtimeMatchState.currentSetStatus.teamBGames, 0)
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

function didMatchTransitionToFinished(previousState, nextState) {
  return (
    isRecord(previousState) &&
    isRecord(nextState) &&
    previousState.status !== PERSISTED_MATCH_STATUS.FINISHED &&
    nextState.status === PERSISTED_MATCH_STATUS.FINISHED
  )
}

function didMatchTransitionFromFinished(previousState, nextState) {
  return (
    isRecord(previousState) &&
    isRecord(nextState) &&
    previousState.status === PERSISTED_MATCH_STATUS.FINISHED &&
    nextState.status !== PERSISTED_MATCH_STATUS.FINISHED
  )
}

function serializeMatchStateForComparison(matchState) {
  try {
    return JSON.stringify(matchState)
  } catch {
    return ''
  }
}

function getCurrentTimestampMs() {
  if (
    typeof globalThis !== 'undefined' &&
    isRecord(globalThis.performance) &&
    typeof globalThis.performance.now === 'function'
  ) {
    return globalThis.performance.now()
  }

  if (typeof Date !== 'undefined' && typeof Date.now === 'function') {
    return Date.now()
  }

  return 0
}

function isValidRuntimeMatchState(matchState) {
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

function isHistoryStackLike(historyStack) {
  return (
    isRecord(historyStack) &&
    typeof historyStack.push === 'function' &&
    typeof historyStack.pop === 'function' &&
    typeof historyStack.clear === 'function' &&
    typeof historyStack.isEmpty === 'function'
  )
}

function isTeamIdentifier(team) {
  return team === 'teamA' || team === 'teamB'
}

function isSameMatchState(leftState, rightState) {
  try {
    return JSON.stringify(leftState) === JSON.stringify(rightState)
  } catch {
    return false
  }
}

function getLeadingTeamId(viewModel) {
  if (!isRecord(viewModel)) {
    return null
  }

  if (isTeamIdentifier(viewModel.winnerTeam)) {
    return viewModel.winnerTeam
  }

  if (!isRecord(viewModel.currentSetGames)) {
    return null
  }

  if (viewModel.currentSetGames.teamA > viewModel.currentSetGames.teamB) {
    return 'teamA'
  }

  if (viewModel.currentSetGames.teamB > viewModel.currentSetGames.teamA) {
    return 'teamB'
  }

  return null
}

function getFinishedMessage(viewModel) {
  const leadingTeamId = getLeadingTeamId(viewModel)

  if (leadingTeamId === 'teamA' || leadingTeamId === 'teamB') {
    const winningTeam = viewModel[leadingTeamId]
    const winningLabel =
      isRecord(winningTeam) && typeof winningTeam.label === 'string'
        ? winningTeam.label
        : gettext('game.matchFinished')

    return `${winningLabel} ${gettext('game.winsSuffix')}`
  }

  return gettext('game.matchFinished')
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

Page({
  onInit() {
    this.widgets = []
    this.lastAcceptedScoringInteractionAt = null
    this.hasAttemptedSummaryNavigation = false
    this.isSessionAccessGranted = false
    this.persistedSessionState = null

    this.persistenceDebounceWindowMs = PERSISTENCE_DEBOUNCE_WINDOW_MS
    this.runtimeStatePersistenceTimer = null
    this.pendingRuntimeStatePersistence = null
    this.isRuntimeStatePersistenceInFlight = false
    this.lastPersistedRuntimeStateSignature = null

    // Validate session synchronously before build() runs.
    this.validateSessionAccess()
  },

  onShow() {
    // Re-validate on return to page (e.g. back navigation).
    // Only re-run if access was not yet granted (avoids redundant re-check on normal show).
    if (!this.isSessionAccessGranted) {
      this.validateSessionAccess()
      if (this.isSessionAccessGranted) {
        this.ensureRuntimeState()
        this.renderGameScreen()
      }
    }
  },

  onHide() {
    this.handleLifecycleAutoSave()
  },

  build() {
    // build() always renders. If session access was denied, navigateToSetupPage()
    // was already called in onInit via validateSessionAccess(), so this page will
    // be replaced before the user sees it. Rendering a blank background here
    // avoids a black screen flash between onInit and the navigation completing.
    if (!this.isSessionAccessGranted) {
      if (typeof hmUI !== 'undefined') {
        hmUI.createWidget(hmUI.widget.FILL_RECT, {
          x: 0, y: 0,
          w: this.getScreenMetrics().width,
          h: this.getScreenMetrics().height,
          color: GAME_TOKENS.colors.background
        })
      }
      return
    }

    this.ensureRuntimeState()
    this.renderGameScreen()
  },

  onDestroy() {
    this.handleLifecycleAutoSave()
    this.clearWidgets()
  },

  handleLifecycleAutoSave() {
    if (!this.isSessionAccessGranted) {
      return false
    }

    return this.saveCurrentRuntimeState({ force: true })
  },

  validateSessionAccess() {
    if (this.isSessionAccessGranted) {
      return true
    }

    try {
      const persistedMatchState = loadMatchState()
      const hasValidActiveSession = isPersistedMatchStateActive(persistedMatchState)

      this.isSessionAccessGranted = hasValidActiveSession
      this.persistedSessionState = hasValidActiveSession
        ? cloneMatchState(persistedMatchState)
        : null

      if (!hasValidActiveSession) {
        this.navigateToSetupPage()
      }

      return hasValidActiveSession
    } catch {
      this.persistedSessionState = null
      this.isSessionAccessGranted = false
      this.navigateToSetupPage()
      return false
    }
  },

  navigateToSetupPage() {
    if (typeof hmApp === 'undefined' || typeof hmApp.gotoPage !== 'function') {
      return false
    }

    try {
      hmApp.gotoPage({
        url: 'page/setup'
      })
      return true
    } catch {
      return false
    }
  },

  getScreenMetrics() {
    if (typeof hmSetting === 'undefined') {
      return { width: 390, height: 450 }
    }

    const { width, height } = hmSetting.getDeviceInfo()

    return {
      width: ensureNumber(width, 390),
      height: ensureNumber(height, 450)
    }
  },

  clearWidgets() {
    if (typeof hmUI === 'undefined') {
      this.widgets = []
      return
    }

    this.widgets.forEach((widget) => hmUI.deleteWidget(widget))
    this.widgets = []
  },

  createWidget(widgetType, properties) {
    if (typeof hmUI === 'undefined') {
      return null
    }

    const widget = hmUI.createWidget(widgetType, properties)
    this.widgets.push(widget)
    return widget
  },

  getAppInstance() {
    if (typeof getApp !== 'function') {
      return null
    }

    const app = getApp()

    if (!isRecord(app)) {
      return null
    }

    if (!isRecord(app.globalData)) {
      app.globalData = {}
    }

    return app
  },

  ensureRuntimeState() {
    const app = this.getAppInstance()

    if (!app) {
      return
    }

    if (!isHistoryStackLike(app.globalData.matchHistory)) {
      app.globalData.matchHistory = createHistoryStack()
    }

    let runtimeMatchState = null

    if (isValidRuntimeMatchState(app.globalData.matchState)) {
      runtimeMatchState = cloneMatchState(app.globalData.matchState)
    } else {
      const persistedRuntimeState = loadState()

      runtimeMatchState =
        persistedRuntimeState !== null
          ? cloneMatchState(persistedRuntimeState)
          : createInitialMatchState()
    }

    app.globalData.matchState = mergeRuntimeStateWithPersistedSession(
      runtimeMatchState,
      this.persistedSessionState
    )
  },

  getRuntimeMatchState() {
    const app = this.getAppInstance()

    if (!app) {
      return createInitialMatchState()
    }

    if (!isValidRuntimeMatchState(app.globalData.matchState)) {
      app.globalData.matchState = createInitialMatchState()
    }

    return app.globalData.matchState
  },

  updateRuntimeMatchState(nextState) {
    const app = this.getAppInstance()

    if (!app || !isValidRuntimeMatchState(nextState)) {
      return
    }

    app.globalData.matchState = nextState
  },

  saveCurrentRuntimeState(options = {}) {
    const app = this.getAppInstance()

    if (!app || !isValidRuntimeMatchState(app.globalData.matchState)) {
      return false
    }

    const shouldForcePersistence = isRecord(options) && options.force === true
    this.enqueueRuntimeStatePersistence(app.globalData.matchState, {
      force: shouldForcePersistence
    })

    return true
  },

  enqueueRuntimeStatePersistence(matchState, options = {}) {
    if (!isValidRuntimeMatchState(matchState)) {
      return false
    }

    this.pendingRuntimeStatePersistence = {
      runtimeState: cloneMatchState(matchState),
      signature: serializeMatchStateForComparison(matchState)
    }

    const shouldForcePersistence = isRecord(options) && options.force === true

    if (shouldForcePersistence) {
      this.clearRuntimeStatePersistenceTimer()
      this.drainRuntimeStatePersistenceQueue()
      return true
    }

    this.scheduleRuntimeStatePersistenceDrain()
    return true
  },

  scheduleRuntimeStatePersistenceDrain() {
    if (this.runtimeStatePersistenceTimer !== null) {
      return
    }

    if (typeof setTimeout !== 'function') {
      this.drainRuntimeStatePersistenceQueue()
      return
    }

    const configuredDebounceWindowMs =
      Number.isFinite(this.persistenceDebounceWindowMs) &&
      this.persistenceDebounceWindowMs >= 0
        ? this.persistenceDebounceWindowMs
        : PERSISTENCE_DEBOUNCE_WINDOW_MS

    this.runtimeStatePersistenceTimer = setTimeout(() => {
      this.runtimeStatePersistenceTimer = null
      this.drainRuntimeStatePersistenceQueue()
    }, configuredDebounceWindowMs)
  },

  clearRuntimeStatePersistenceTimer() {
    if (this.runtimeStatePersistenceTimer === null) {
      return
    }

    if (typeof clearTimeout === 'function') {
      clearTimeout(this.runtimeStatePersistenceTimer)
    }

    this.runtimeStatePersistenceTimer = null
  },

  drainRuntimeStatePersistenceQueue() {
    if (this.isRuntimeStatePersistenceInFlight) {
      return
    }

    this.isRuntimeStatePersistenceInFlight = true

    try {
      while (this.pendingRuntimeStatePersistence !== null) {
        const nextPersistenceTask = this.pendingRuntimeStatePersistence
        this.pendingRuntimeStatePersistence = null

        if (
          nextPersistenceTask.signature.length > 0 &&
          nextPersistenceTask.signature === this.lastPersistedRuntimeStateSignature
        ) {
          continue
        }

        this.persistRuntimeStateSnapshot(
          nextPersistenceTask.runtimeState,
          nextPersistenceTask.signature
        )
      }
    } finally {
      this.isRuntimeStatePersistenceInFlight = false
    }

    if (this.pendingRuntimeStatePersistence !== null) {
      this.drainRuntimeStatePersistenceQueue()
    }
  },

  persistRuntimeStateSnapshot(runtimeState, signature) {
    if (!isValidRuntimeMatchState(runtimeState)) {
      return
    }

    saveState(runtimeState)

    const persistedMatchStateSnapshot = createPersistedMatchStateSnapshot(
      runtimeState,
      this.persistedSessionState
    )

    if (persistedMatchStateSnapshot !== null) {
      try {
        saveMatchState(persistedMatchStateSnapshot)
        this.persistedSessionState = cloneMatchState(persistedMatchStateSnapshot)
      } catch {
        // Ignore schema persistence errors so gameplay interactions stay resilient.
      }
    }

    this.lastPersistedRuntimeStateSignature =
      signature.length > 0 ? signature : serializeMatchStateForComparison(runtimeState)
  },

  navigateToSummaryPage() {
    if (typeof hmApp === 'undefined' || typeof hmApp.gotoPage !== 'function') {
      return false
    }

    try {
      hmApp.gotoPage({
        url: 'page/summary'
      })
      return true
    } catch {
      return false
    }
  },

  handleMatchFinishedTransition() {
    if (this.hasAttemptedSummaryNavigation) {
      return
    }

    this.hasAttemptedSummaryNavigation = true

    // Persistence is now synchronous, so navigate immediately.
    this.navigateToSummaryPage()
  },

  navigateToHomePage() {
    if (typeof hmApp === 'undefined') {
      return
    }

    if (typeof hmApp.goBack === 'function') {
      hmApp.goBack()
      return
    }

    if (typeof hmApp.gotoPage === 'function') {
      hmApp.gotoPage({
        url: 'page/index'
      })
    }
  },

  handleBackToHome() {
    this.saveCurrentRuntimeState({ force: true })
    this.navigateToHomePage()
  },

  getCurrentTimeMs() {
    return getCurrentTimestampMs()
  },

  emitInteractionPerformanceMetrics(metrics) {
    if (!isRecord(metrics)) {
      return
    }

    this.lastInteractionPerformanceMetrics = metrics

    if (typeof this.onInteractionPerformanceMeasured === 'function') {
      try {
        this.onInteractionPerformanceMeasured(metrics)
      } catch {
        // Ignore callback errors so scoring interactions stay resilient.
      }
    }

    if (!metrics.exceededLatencyBudget) {
      return
    }

    if (typeof console !== 'undefined' && typeof console.warn === 'function') {
      console.warn(
        `[game-screen] interaction latency ${metrics.interactionLatencyMs}ms exceeded ${metrics.latencyBudgetMs}ms target`
      )
    }
  },

  measureInteractionPerformance(interactionStartedAt, renderStartedAt, uiUpdatedAt) {
    if (
      !Number.isFinite(interactionStartedAt) ||
      !Number.isFinite(renderStartedAt) ||
      !Number.isFinite(uiUpdatedAt)
    ) {
      return
    }

    const interactionLatencyMs = Math.max(0, Math.round(uiUpdatedAt - interactionStartedAt))
    const renderLatencyMs = Math.max(0, Math.round(uiUpdatedAt - renderStartedAt))

    this.emitInteractionPerformanceMetrics({
      interactionLatencyMs,
      renderLatencyMs,
      latencyBudgetMs: INTERACTION_LATENCY_TARGET_MS,
      exceededLatencyBudget: interactionLatencyMs >= INTERACTION_LATENCY_TARGET_MS
    })
  },

  addPointForTeam(team) {
    const app = this.getAppInstance()

    if (!app) {
      return null
    }

    if (typeof app.addPointForTeam === 'function') {
      return app.addPointForTeam(team)
    }

    const nextState = addPoint(app.globalData.matchState, team, app.globalData.matchHistory)
    app.globalData.matchState = nextState
    return nextState
  },

  removePoint() {
    const app = this.getAppInstance()

    if (!app) {
      return null
    }

    if (typeof app.removePoint === 'function') {
      return app.removePoint()
    }

    const nextState = removePoint(app.globalData.matchState, app.globalData.matchHistory)
    app.globalData.matchState = nextState
    return nextState
  },

  removePointForTeam(team) {
    const app = this.getAppInstance()

    if (!app || !isTeamIdentifier(team)) {
      return null
    }

    if (typeof app.removePointForTeam === 'function') {
      return app.removePointForTeam(team)
    }

    if (
      !isValidRuntimeMatchState(app.globalData.matchState) ||
      !isHistoryStackLike(app.globalData.matchHistory)
    ) {
      return null
    }

    const historySnapshots = popHistorySnapshotsInOrder(app.globalData.matchHistory)
    const stateTimeline = [...historySnapshots, deepCopyState(app.globalData.matchState)]
    const scoringTeams = []

    for (let index = 1; index < stateTimeline.length; index += 1) {
      const scoringTeam = getScoringTeamForTransition(
        stateTimeline[index - 1],
        stateTimeline[index]
      )

      if (!scoringTeam) {
        restoreHistorySnapshots(app.globalData.matchHistory, historySnapshots)
        return deepCopyState(app.globalData.matchState)
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
      restoreHistorySnapshots(app.globalData.matchHistory, historySnapshots)
      return deepCopyState(app.globalData.matchState)
    }

    const rebuiltHistory = createHistoryStack()
    let rebuiltState = deepCopyState(stateTimeline[0])

    for (let index = 0; index < scoringTeams.length; index += 1) {
      if (index === removedEventIndex) {
        continue
      }

      rebuiltState = addPoint(rebuiltState, scoringTeams[index], rebuiltHistory)
    }

    app.globalData.matchHistory = rebuiltHistory
    app.globalData.matchState = rebuiltState

    return rebuiltState
  },

  persistAndRender(nextState, interactionStartedAt, options = {}) {
    if (!isValidRuntimeMatchState(nextState)) {
      return
    }

    this.updateRuntimeMatchState(nextState)

    const renderStartedAt = this.getCurrentTimeMs()
    this.renderGameScreen()
    const uiUpdatedAt = this.getCurrentTimeMs()

    this.measureInteractionPerformance(interactionStartedAt, renderStartedAt, uiUpdatedAt)

    const shouldForcePersistence = isRecord(options) && options.forcePersistence === true
    this.saveCurrentRuntimeState({ force: shouldForcePersistence })
  },

  isScoringInteractionDebounced(interactionStartedAt) {
    if (
      !Number.isFinite(interactionStartedAt) ||
      !Number.isFinite(this.lastAcceptedScoringInteractionAt)
    ) {
      return false
    }

    const elapsedMs = interactionStartedAt - this.lastAcceptedScoringInteractionAt

    return elapsedMs >= 0 && elapsedMs < SCORING_DEBOUNCE_WINDOW_MS
  },

  executeScoringAction(action, options = {}) {
    if (typeof action !== 'function') {
      return
    }

    const shouldDebounceScoringInput =
      isRecord(options) && options.debounceScoringInput === true
    const interactionStartedAt = this.getCurrentTimeMs()

    if (shouldDebounceScoringInput && this.isScoringInteractionDebounced(interactionStartedAt)) {
      return
    }

    const previousState = cloneMatchState(this.getRuntimeMatchState())
    const nextState = action()

    if (!isValidRuntimeMatchState(nextState) || isSameMatchState(previousState, nextState)) {
      return
    }

    if (shouldDebounceScoringInput) {
      this.lastAcceptedScoringInteractionAt = interactionStartedAt
    }

    if (didMatchTransitionFromFinished(previousState, nextState)) {
      this.hasAttemptedSummaryNavigation = false
    }

    const didFinishMatch = didMatchTransitionToFinished(previousState, nextState)

    this.persistAndRender(nextState, interactionStartedAt, {
      forcePersistence: didFinishMatch
    })

    if (didFinishMatch) {
      this.handleMatchFinishedTransition()
    }
  },

  handleAddPointForTeam(team) {
    this.executeScoringAction(() => this.addPointForTeam(team), {
      debounceScoringInput: true
    })
  },

  handleRemovePoint() {
    this.executeScoringAction(() => this.removePoint(), {
      debounceScoringInput: true
    })
  },

  handleRemovePointForTeam(team) {
    this.executeScoringAction(() => this.removePointForTeam(team), {
      debounceScoringInput: true
    })
  },

  renderGameScreen() {
    if (typeof hmUI === 'undefined') {
      return
    }

    if (!this.isSessionAccessGranted) {
      return
    }

    const matchState = this.getRuntimeMatchState()
    const viewModel = createScoreViewModel(matchState, {
      persistedMatchState: this.persistedSessionState
    })
    const isMatchFinished = viewModel.status === 'finished'
    const leadingTeamId = getLeadingTeamId(viewModel)
    const { width, height } = this.getScreenMetrics()
    const isRoundScreen = Math.abs(width - height) <= Math.round(width * 0.04)

    // ── Header: compact card with SETS and GAMES rows ──────────────────────
    const headerSideInset = Math.round(width * 0.06)
    const headerTop = Math.round(height * GAME_TOKENS.spacingScale.headerTop)
    const headerRowHeight = Math.round(height * 0.055)
    const headerHeight = headerRowHeight * 2
    let headerX = headerSideInset
    let headerWidth = Math.max(1, width - headerSideInset * 2)
    if (isRoundScreen) {
      const safeInset = calculateRoundSafeSectionSideInset(
        width, height, headerTop, headerHeight, Math.round(width * 0.01)
      )
      headerX = Math.max(headerX, safeInset)
      headerWidth = Math.max(1, width - headerX * 2)
    }
    const setsRowY = headerTop
    const gamesRowY = setsRowY + headerRowHeight

    // ── Bottom: back-home button ───────────────────────────────────────────
    const backHomeButtonHeight = clamp(Math.round(height * 0.15), 48, 68)
    const backHomeButtonWidth = clamp(Math.round(width * 0.40), 120, 180)
    const baseBottomInset = Math.round(height * GAME_TOKENS.spacingScale.bottomInset)
    const bottomInset = isRoundScreen
      ? Math.max(baseBottomInset, Math.round(height * GAME_TOKENS.spacingScale.bottomInsetRound))
      : baseBottomInset
    const backHomeButtonY = height - bottomInset - backHomeButtonHeight
    const backHomeButtonX = Math.round((width - backHomeButtonWidth) / 2)

    // ── Score area: fills space between header and back button ─────────────
    const sectionGap = Math.round(height * GAME_TOKENS.spacingScale.sectionGap)
    const scoreAreaTop = headerTop + headerHeight + Math.round(height * GAME_TOKENS.spacingScale.headerToScore)
    const scoreAreaBottom = backHomeButtonY - sectionGap
    const scoreAreaHeight = Math.max(0, scoreAreaBottom - scoreAreaTop)

    // Team label (A / B): top portion of score area
    const teamLabelHeight = Math.round(scoreAreaHeight * 0.18)
    const teamLabelY = scoreAreaTop

    // Score number: large, tappable — centre of score area
    const scoreHeight = Math.round(scoreAreaHeight * 0.5)
    const scoreY = teamLabelY + teamLabelHeight

    // Minus button: small, below score
    const minusButtonHeight = clamp(Math.round(height * 0.11), 50, 70)
    const minusButtonWidth = clamp(Math.round(width * 0.18), 54, 88)
    const minusButtonY = scoreY + scoreHeight + Math.round(scoreAreaHeight * 0.08)

    // Half-widths for left (teamA) and right (teamB) columns
    const halfWidth = Math.round(width / 2)
    const leftColX = 0
    const rightColX = halfWidth

    // Divider line
    const dividerX = halfWidth - 1
    const dividerTop = scoreAreaTop + Math.round(scoreAreaHeight * 0.1)
    const dividerBottom = minusButtonY + minusButtonHeight
    const dividerHeight = Math.max(1, dividerBottom - dividerTop)

    // Finished-state layout
    const pointsValueTextSize = isMatchFinished
      ? clamp(Math.round(width * 0.114), 36, 56)
      : clamp(Math.round(width * GAME_TOKENS.fontScale.points), 72, 140)

    this.clearWidgets()

    // Background
    this.createWidget(hmUI.widget.FILL_RECT, {
      x: 0, y: 0, w: width, h: height,
      color: GAME_TOKENS.colors.background
    })

    // ── Header ────────────────────────────────────────────────────────────
    // Each row: [LABEL (muted, right-align)] [VALUE (accent, left-align)]
    // The pair is centred as a group within headerWidth.
    const headerTextSize = Math.round(width * GAME_TOKENS.fontScale.headerLabel)
    const headerLabelWidth = Math.round(headerWidth * 0.42)
    const headerValueWidth = Math.round(headerWidth * 0.52)
    const headerPairWidth = headerLabelWidth + headerValueWidth
    const headerPairX = headerX + Math.round((headerWidth - headerPairWidth) / 2)
    const headerValueX = headerPairX + headerLabelWidth

    // SETS row
    this.createWidget(hmUI.widget.TEXT, {
      x: headerPairX, y: setsRowY, w: headerLabelWidth, h: headerRowHeight,
      color: GAME_TOKENS.colors.mutedText,
      text: gettext('game.setsLabel'),
      text_size: headerTextSize,
      align_h: hmUI.align.RIGHT,
      align_v: hmUI.align.CENTER_V
    })
    this.createWidget(hmUI.widget.TEXT, {
      x: headerValueX, y: setsRowY, w: headerValueWidth, h: headerRowHeight,
      color: GAME_TOKENS.colors.accent,
      text: `  ${viewModel.setsWon.teamA} – ${viewModel.setsWon.teamB}`,
      text_size: headerTextSize,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V
    })

    // GAMES row
    this.createWidget(hmUI.widget.TEXT, {
      x: headerPairX, y: gamesRowY, w: headerLabelWidth, h: headerRowHeight,
      color: GAME_TOKENS.colors.mutedText,
      text: gettext('game.gamesLabel'),
      text_size: headerTextSize,
      align_h: hmUI.align.RIGHT,
      align_v: hmUI.align.CENTER_V
    })
    this.createWidget(hmUI.widget.TEXT, {
      x: headerValueX, y: gamesRowY, w: headerValueWidth, h: headerRowHeight,
      color: GAME_TOKENS.colors.accent,
      text: `  ${viewModel.currentSetGames.teamA} – ${viewModel.currentSetGames.teamB}`,
      text_size: headerTextSize,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V
    })

    if (isMatchFinished) {
      // ── Finished state: centred winner message ──────────────────────────
      const finishedLabelHeight = Math.round(scoreAreaHeight * 0.25)
      const finishedValueHeight = scoreAreaHeight - finishedLabelHeight

      this.createWidget(hmUI.widget.TEXT, {
        x: 0, y: scoreAreaTop, w: width, h: finishedLabelHeight,
        color: GAME_TOKENS.colors.mutedText,
        text: gettext('game.finishedLabel'),
        text_size: Math.round(width * GAME_TOKENS.fontScale.headerLabel),
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V
      })

      this.createWidget(hmUI.widget.TEXT, {
        x: 0, y: scoreAreaTop + finishedLabelHeight, w: width, h: finishedValueHeight,
        color: GAME_TOKENS.colors.accent,
        text: getFinishedMessage(viewModel),
        text_size: pointsValueTextSize,
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V
      })
    } else {
      // ── Active state ────────────────────────────────────────────────────

      // Team A label
      this.createWidget(hmUI.widget.TEXT, {
        x: leftColX, y: teamLabelY, w: halfWidth, h: teamLabelHeight,
        color: GAME_TOKENS.colors.mutedText,
        text: 'A',
        text_size: Math.round(width * GAME_TOKENS.fontScale.teamLabel),
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V
      })

      // Team B label
      this.createWidget(hmUI.widget.TEXT, {
        x: rightColX, y: teamLabelY, w: halfWidth, h: teamLabelHeight,
        color: GAME_TOKENS.colors.mutedText,
        text: 'B',
        text_size: Math.round(width * GAME_TOKENS.fontScale.teamLabel),
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V
      })

      // Team A score (tappable — adds point)
      this.createWidget(hmUI.widget.BUTTON, {
        x: leftColX, y: scoreY, w: halfWidth, h: scoreHeight,
        radius: 0,
        normal_color: GAME_TOKENS.colors.background,
        press_color: GAME_TOKENS.colors.cardBackground,
        color: GAME_TOKENS.colors.text,
        text_size: pointsValueTextSize,
        text: String(viewModel.teamA.points),
        click_func: () => this.handleAddPointForTeam('teamA')
      })

      // Team B score (tappable — adds point)
      this.createWidget(hmUI.widget.BUTTON, {
        x: rightColX, y: scoreY, w: halfWidth, h: scoreHeight,
        radius: 0,
        normal_color: GAME_TOKENS.colors.background,
        press_color: GAME_TOKENS.colors.cardBackground,
        color: GAME_TOKENS.colors.text,
        text_size: pointsValueTextSize,
        text: String(viewModel.teamB.points),
        click_func: () => this.handleAddPointForTeam('teamB')
      })

      // Vertical divider
      this.createWidget(hmUI.widget.FILL_RECT, {
        x: dividerX, y: dividerTop, w: 1, h: dividerHeight,
        color: GAME_TOKENS.colors.divider
      })

      // Team A minus button
      const minusAX = Math.round(leftColX + (halfWidth - minusButtonWidth) / 2)
      this.createWidget(hmUI.widget.BUTTON, {
        x: minusAX, y: minusButtonY, w: minusButtonWidth, h: minusButtonHeight,
        radius: Math.round(minusButtonHeight / 2),
        normal_color: GAME_TOKENS.colors.buttonSecondary,
        press_color: GAME_TOKENS.colors.buttonSecondaryPressed,
        color: GAME_TOKENS.colors.dangerText,
        text_size: Math.round(width * GAME_TOKENS.fontScale.minusButton),
        text: '−',
        click_func: () => this.handleRemovePointForTeam('teamA')
      })

      // Team B minus button
      const minusBX = Math.round(rightColX + (halfWidth - minusButtonWidth) / 2)
      this.createWidget(hmUI.widget.BUTTON, {
        x: minusBX, y: minusButtonY, w: minusButtonWidth, h: minusButtonHeight,
        radius: Math.round(minusButtonHeight / 2),
        normal_color: GAME_TOKENS.colors.buttonSecondary,
        press_color: GAME_TOKENS.colors.buttonSecondaryPressed,
        color: GAME_TOKENS.colors.dangerText,
        text_size: Math.round(width * GAME_TOKENS.fontScale.minusButton),
        text: '−',
        click_func: () => this.handleRemovePointForTeam('teamB')
      })
    }

    // ── Back-home button (always shown at bottom centre) ──────────────────
    this.createWidget(hmUI.widget.BUTTON, {
      x: backHomeButtonX, y: backHomeButtonY,
      w: backHomeButtonWidth, h: backHomeButtonHeight,
      radius: Math.round(backHomeButtonHeight / 2),
      normal_color: GAME_TOKENS.colors.buttonSecondary,
      press_color: GAME_TOKENS.colors.buttonSecondaryPressed,
      color: GAME_TOKENS.colors.buttonSecondaryText,
      text_size: Math.round(width * GAME_TOKENS.fontScale.button),
      text: isMatchFinished ? gettext('game.home') : gettext('game.backHome'),
      click_func: () => this.handleBackToHome()
    })
  }
})
