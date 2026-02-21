import { gettext } from 'i18n'

import { createScoreViewModel } from './score-view-model.js'
import { createHistoryStack, deepCopyState } from '../utils/history-stack.js'
import { createInitialMatchState } from '../utils/match-state.js'
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
    mutedText: 0x7d8289,
    text: 0xffffff
  },
  fontScale: {
    button: 0.038,
    label: 0.04,
    points: 0.1,
    setCounter: 0.032,
    setScore: 0.078,
    setTeam: 0.034
  },
  spacingScale: {
    cardTop: 0.2,
    controlsBottom: 0.07,
    controlsColumnGap: 0.04,
    controlsRowGap: 0.018,
    controlsSideInset: 0.07,
    controlsSideInsetRound: 0.12,
    setSectionTop: 0.04,
    sectionGap: 0.03
  }
})

const INTERACTION_LATENCY_TARGET_MS = 100
const SCORING_DEBOUNCE_WINDOW_MS = 300
const PERSISTENCE_DEBOUNCE_WINDOW_MS = 180
const PERSISTED_ADVANTAGE_POINT_VALUE = 50
const PERSISTED_GAME_POINT_VALUE = 60
const DEFAULT_SETS_TO_PLAY = 3

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
    this.isSessionAccessCheckInFlight = false
    this.isSessionAccessGranted = false
    this.persistedSessionState = null

    this.persistenceDebounceWindowMs = PERSISTENCE_DEBOUNCE_WINDOW_MS
    this.runtimeStatePersistenceTimer = null
    this.pendingRuntimeStatePersistence = null
    this.isRuntimeStatePersistenceInFlight = false
    this.runtimeStatePersistenceInFlightPromise = Promise.resolve()
    this.runtimeStatePersistenceIdleResolvers = []
    this.lastPersistedRuntimeStateSignature = null

    this.validateSessionAccessAndRender()
  },

  onShow() {
    this.validateSessionAccessAndRender()
  },

  onHide() {
    this.handleLifecycleAutoSave()
  },

  build() {
    if (!this.isSessionAccessGranted) {
      return
    }

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

  async validateSessionAccessAndRender() {
    const hasSessionAccess = await this.validateSessionAccess()

    if (!hasSessionAccess) {
      return false
    }

    this.ensureRuntimeState()
    this.renderGameScreen()
    return true
  },

  async validateSessionAccess() {
    if (this.isSessionAccessGranted) {
      return true
    }

    if (this.isSessionAccessCheckInFlight) {
      return false
    }

    this.isSessionAccessCheckInFlight = true

    try {
      const hasValidActiveSession = await this.hasValidActiveSession()

      this.isSessionAccessGranted = hasValidActiveSession

      if (!hasValidActiveSession) {
        this.navigateToSetupPage()
      }

      return hasValidActiveSession
    } finally {
      this.isSessionAccessCheckInFlight = false
    }
  },

  async hasValidActiveSession() {
    try {
      const persistedMatchState = await loadMatchState()
      const hasValidActiveSession = isPersistedMatchStateActive(persistedMatchState)

      this.persistedSessionState = hasValidActiveSession
        ? cloneMatchState(persistedMatchState)
        : null

      return hasValidActiveSession
    } catch {
      this.persistedSessionState = null
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
      return this.runtimeStatePersistenceInFlightPromise
    }

    // Serialize persistence writes so rapid updates always commit in order,
    // while replacing queued snapshots guarantees latest-state-wins behavior.
    const processQueue = async () => {
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

          await this.persistRuntimeStateSnapshot(
            nextPersistenceTask.runtimeState,
            nextPersistenceTask.signature
          )
        }
      } finally {
        this.isRuntimeStatePersistenceInFlight = false
      }

      if (this.pendingRuntimeStatePersistence !== null) {
        return this.drainRuntimeStatePersistenceQueue()
      }

      this.resolveRuntimeStatePersistenceIdle()
    }

    this.runtimeStatePersistenceInFlightPromise = processQueue()
    return this.runtimeStatePersistenceInFlightPromise
  },

  async persistRuntimeStateSnapshot(runtimeState, signature) {
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
        await saveMatchState(persistedMatchStateSnapshot)
        this.persistedSessionState = cloneMatchState(persistedMatchStateSnapshot)
      } catch {
        // Ignore schema persistence errors so gameplay interactions stay resilient.
      }
    }

    this.lastPersistedRuntimeStateSignature =
      signature.length > 0 ? signature : serializeMatchStateForComparison(runtimeState)
  },

  isRuntimeStatePersistenceIdle() {
    return (
      this.pendingRuntimeStatePersistence === null &&
      this.runtimeStatePersistenceTimer === null &&
      !this.isRuntimeStatePersistenceInFlight
    )
  },

  resolveRuntimeStatePersistenceIdle() {
    if (!this.isRuntimeStatePersistenceIdle()) {
      return
    }

    const pendingResolvers = this.runtimeStatePersistenceIdleResolvers
    this.runtimeStatePersistenceIdleResolvers = []

    pendingResolvers.forEach((resolver) => {
      try {
        resolver()
      } catch {
        // Ignore test-only resolver callback failures.
      }
    })
  },

  waitForPersistenceIdle() {
    if (this.isRuntimeStatePersistenceIdle()) {
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      this.runtimeStatePersistenceIdleResolvers.push(resolve)
    })
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

    this.waitForPersistenceIdle()
      .then(() => {
        this.navigateToSummaryPage()
      })
      .catch(() => {
        // Keep the finished state rendered if summary navigation cannot run.
      })
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

    const matchState = this.getRuntimeMatchState()
    const viewModel = createScoreViewModel(matchState, {
      persistedMatchState: this.persistedSessionState
    })
    const isMatchFinished = viewModel.status === 'finished'
    const leadingTeamId = getLeadingTeamId(viewModel)
    const { width, height } = this.getScreenMetrics()
    const isRoundScreen = Math.abs(width - height) <= Math.round(width * 0.04)

    const baseSectionSideInset = Math.round(width * 0.06)

    const setSectionHeight = Math.round(height * 0.17)
    const setSectionY = Math.round(height * GAME_TOKENS.spacingScale.setSectionTop)
    let setSectionSideInset = baseSectionSideInset
    if (isRoundScreen) {
      setSectionSideInset = Math.max(
        setSectionSideInset,
        calculateRoundSafeSectionSideInset(
          width,
          height,
          setSectionY,
          setSectionHeight,
          Math.round(width * 0.01)
        )
      )
    }

    const maxSectionInset = Math.floor((width - 1) / 2)
    setSectionSideInset = clamp(setSectionSideInset, 0, maxSectionInset)
    const setSectionX = setSectionSideInset
    const setSectionWidth = Math.max(1, width - setSectionSideInset * 2)
    const setLabelHeight = Math.round(setSectionHeight * 0.3)
    const setCounterHeight = Math.round(setSectionHeight * 0.28)
    const setCounterY = setSectionY + setLabelHeight
    const setScoreY = setCounterY + setCounterHeight
    const setScoreHeight = Math.max(1, setSectionHeight - setLabelHeight - setCounterHeight)
    const setTeamWidth = Math.round(setSectionWidth / 2)
    const rightTeamX = setSectionX + setTeamWidth
    let controlsSideInset = Math.round(
      width *
        (isRoundScreen
          ? GAME_TOKENS.spacingScale.controlsSideInsetRound
          : GAME_TOKENS.spacingScale.controlsSideInset)
    )
    const controlsColumnGap = Math.round(width * GAME_TOKENS.spacingScale.controlsColumnGap)
    const controlsRowGap = Math.round(height * GAME_TOKENS.spacingScale.controlsRowGap)
    const buttonHeight = clamp(Math.round(height * 0.104), 48, 58)
    const controlsRows = isMatchFinished ? 1 : 3
    const baseControlsBottomInset = Math.round(height * GAME_TOKENS.spacingScale.controlsBottom)
    const controlsBottomInset = isRoundScreen
      ? Math.max(baseControlsBottomInset, Math.round(height * 0.11))
      : baseControlsBottomInset
    const controlsSectionHeight =
      buttonHeight * controlsRows + controlsRowGap * (controlsRows - 1)
    const addButtonsY = height - controlsBottomInset - controlsSectionHeight
    const removeButtonsY = addButtonsY + buttonHeight + controlsRowGap
    const backHomeButtonY = removeButtonsY + buttonHeight + controlsRowGap
    if (isRoundScreen) {
      const controlsSectionSafeInset = calculateRoundSafeSectionSideInset(
        width,
        height,
        addButtonsY,
        controlsSectionHeight,
        Math.round(width * 0.012)
      )

      controlsSideInset = Math.max(controlsSideInset, controlsSectionSafeInset)
    }

    const maxControlsInset = Math.floor((width - controlsColumnGap - 2) / 2)
    controlsSideInset = clamp(controlsSideInset, 0, maxControlsInset)

    const buttonWidth = Math.round((width - controlsSideInset * 2 - controlsColumnGap) / 2)
    const leftButtonX = controlsSideInset
    const rightButtonX = leftButtonX + buttonWidth + controlsColumnGap
    const backHomeButtonWidth = Math.max(1, buttonWidth * 2 + controlsColumnGap)
    const pointsSectionY =
      setSectionY + setSectionHeight + Math.round(height * GAME_TOKENS.spacingScale.sectionGap)
    const pointsSectionBottom = addButtonsY - Math.round(height * GAME_TOKENS.spacingScale.sectionGap)
    const pointsSectionHeight = Math.max(0, pointsSectionBottom - pointsSectionY)
    let pointsSectionSideInset = baseSectionSideInset
    if (isRoundScreen && pointsSectionHeight > 0) {
      pointsSectionSideInset = Math.max(
        pointsSectionSideInset,
        calculateRoundSafeSectionSideInset(
          width,
          height,
          pointsSectionY,
          pointsSectionHeight,
          Math.round(width * 0.01)
        )
      )
    }

    pointsSectionSideInset = clamp(pointsSectionSideInset, 0, maxSectionInset)
    const pointsSectionX = pointsSectionSideInset
    const pointsSectionWidth = Math.max(1, width - pointsSectionSideInset * 2)
    const pointsLabelHeight = Math.round(pointsSectionHeight * 0.3)
    const pointsValueY = pointsSectionY + pointsLabelHeight
    const pointsValueHeight = pointsSectionHeight - pointsLabelHeight
    const pointsValueTextSize = isMatchFinished
      ? clamp(Math.round(width * 0.114), 36, 56)
      : clamp(Math.round(width * 0.128), 44, 64)
    const pointsLabelText = isMatchFinished ? gettext('game.finishedLabel') : gettext('game.title')
    const pointsValueText = isMatchFinished
      ? getFinishedMessage(viewModel)
      : `${viewModel.teamA.points} - ${viewModel.teamB.points}`
    const homeButtonWidth = isMatchFinished
      ? clamp(Math.round(width * 0.42), 140, backHomeButtonWidth)
      : backHomeButtonWidth
    const homeButtonX = isMatchFinished ? Math.round((width - homeButtonWidth) / 2) : leftButtonX
    const homeButtonY = isMatchFinished
      ? clamp(
          pointsValueY + Math.round(pointsValueHeight * 0.58),
          pointsValueY,
          height - controlsBottomInset - buttonHeight
        )
      : backHomeButtonY

    this.clearWidgets()

    this.createWidget(hmUI.widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: width,
      h: height,
      color: GAME_TOKENS.colors.background
    })

    this.createWidget(hmUI.widget.FILL_RECT, {
      x: setSectionX,
      y: setSectionY,
      w: setSectionWidth,
      h: setSectionHeight,
      radius: Math.round(setSectionHeight * 0.24),
      color: GAME_TOKENS.colors.cardBackground
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: setSectionX,
      y: setSectionY,
      w: setTeamWidth,
      h: setLabelHeight,
      color: GAME_TOKENS.colors.mutedText,
      text: viewModel.teamA.label,
      text_size: Math.round(width * GAME_TOKENS.fontScale.setTeam),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: rightTeamX,
      y: setSectionY,
      w: setTeamWidth,
      h: setLabelHeight,
      color: GAME_TOKENS.colors.mutedText,
      text: viewModel.teamB.label,
      text_size: Math.round(width * GAME_TOKENS.fontScale.setTeam),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: setSectionX,
      y: setCounterY,
      w: setTeamWidth,
      h: setCounterHeight,
      color: GAME_TOKENS.colors.mutedText,
      text: `${gettext('game.setsWonLabel')}: ${viewModel.setsWon.teamA}`,
      text_size: Math.round(width * GAME_TOKENS.fontScale.setCounter),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: rightTeamX,
      y: setCounterY,
      w: setTeamWidth,
      h: setCounterHeight,
      color: GAME_TOKENS.colors.mutedText,
      text: `${gettext('game.setsWonLabel')}: ${viewModel.setsWon.teamB}`,
      text_size: Math.round(width * GAME_TOKENS.fontScale.setCounter),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: setSectionX,
      y: setScoreY,
      w: setTeamWidth,
      h: setScoreHeight,
      color:
        leadingTeamId === 'teamB' && isMatchFinished
          ? GAME_TOKENS.colors.mutedText
          : GAME_TOKENS.colors.accent,
      text: String(viewModel.currentSetGames.teamA),
      text_size: Math.round(width * GAME_TOKENS.fontScale.setScore),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: rightTeamX,
      y: setScoreY,
      w: setTeamWidth,
      h: setScoreHeight,
      color:
        leadingTeamId === 'teamA' && isMatchFinished
          ? GAME_TOKENS.colors.mutedText
          : GAME_TOKENS.colors.accent,
      text: String(viewModel.currentSetGames.teamB),
      text_size: Math.round(width * GAME_TOKENS.fontScale.setScore),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.FILL_RECT, {
      x: pointsSectionX,
      y: pointsSectionY,
      w: pointsSectionWidth,
      h: pointsSectionHeight,
      radius: Math.round(pointsSectionWidth * 0.08),
      color: GAME_TOKENS.colors.cardBackground
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: pointsSectionX,
      y: pointsSectionY,
      w: pointsSectionWidth,
      h: pointsLabelHeight,
      color: GAME_TOKENS.colors.mutedText,
      text: pointsLabelText,
      text_size: Math.round(width * GAME_TOKENS.fontScale.label),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: pointsSectionX,
      y: pointsValueY,
      w: pointsSectionWidth,
      h: pointsValueHeight,
      color: isMatchFinished ? GAME_TOKENS.colors.accent : GAME_TOKENS.colors.text,
      text: pointsValueText,
      text_size: pointsValueTextSize,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    if (!isMatchFinished) {
      this.createWidget(hmUI.widget.BUTTON, {
        x: leftButtonX,
        y: addButtonsY,
        w: buttonWidth,
        h: buttonHeight,
        radius: Math.round(buttonHeight / 2),
        normal_color: GAME_TOKENS.colors.accent,
        press_color: GAME_TOKENS.colors.accentPressed,
        color: GAME_TOKENS.colors.buttonText,
        text_size: Math.round(width * GAME_TOKENS.fontScale.button),
        text: gettext('game.teamAAddPoint'),
        click_func: () => this.handleAddPointForTeam('teamA')
      })

      this.createWidget(hmUI.widget.BUTTON, {
        x: rightButtonX,
        y: addButtonsY,
        w: buttonWidth,
        h: buttonHeight,
        radius: Math.round(buttonHeight / 2),
        normal_color: GAME_TOKENS.colors.accent,
        press_color: GAME_TOKENS.colors.accentPressed,
        color: GAME_TOKENS.colors.buttonText,
        text_size: Math.round(width * GAME_TOKENS.fontScale.button),
        text: gettext('game.teamBAddPoint'),
        click_func: () => this.handleAddPointForTeam('teamB')
      })

      this.createWidget(hmUI.widget.BUTTON, {
        x: leftButtonX,
        y: removeButtonsY,
        w: buttonWidth,
        h: buttonHeight,
        radius: Math.round(buttonHeight / 2),
        normal_color: GAME_TOKENS.colors.buttonSecondary,
        press_color: GAME_TOKENS.colors.buttonSecondaryPressed,
        color: GAME_TOKENS.colors.dangerText,
        text_size: Math.round(width * GAME_TOKENS.fontScale.button),
        text: gettext('game.teamARemovePoint'),
        click_func: () => this.handleRemovePointForTeam('teamA')
      })

      this.createWidget(hmUI.widget.BUTTON, {
        x: rightButtonX,
        y: removeButtonsY,
        w: buttonWidth,
        h: buttonHeight,
        radius: Math.round(buttonHeight / 2),
        normal_color: GAME_TOKENS.colors.buttonSecondary,
        press_color: GAME_TOKENS.colors.buttonSecondaryPressed,
        color: GAME_TOKENS.colors.dangerText,
        text_size: Math.round(width * GAME_TOKENS.fontScale.button),
        text: gettext('game.teamBRemovePoint'),
        click_func: () => this.handleRemovePointForTeam('teamB')
      })
    }

    this.createWidget(hmUI.widget.BUTTON, {
      x: homeButtonX,
      y: homeButtonY,
      w: homeButtonWidth,
      h: buttonHeight,
      radius: Math.round(buttonHeight / 2),
      normal_color: GAME_TOKENS.colors.buttonSecondary,
      press_color: GAME_TOKENS.colors.buttonSecondaryPressed,
      color: GAME_TOKENS.colors.buttonSecondaryText,
      text_size: Math.round(width * GAME_TOKENS.fontScale.button),
      text: isMatchFinished ? gettext('game.home') : gettext('game.backHome'),
      click_func: () => this.handleBackToHome()
    })
  }
})
