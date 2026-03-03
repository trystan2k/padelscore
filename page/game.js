import { gettext } from 'i18n'
import { TOKENS } from '../utils/design-tokens.js'
import { createHistoryStack } from '../utils/history-stack.js'
import { createInitialMatchState } from '../utils/match-state.js'
import { addPoint, removePoint } from '../utils/scoring-engine.js'
import { getScreenMetrics } from '../utils/screen-utils.js'
import {
  cloneMatchState,
  isRecord,
  isTeamIdentifier
} from '../utils/validation.js'
import {
  createManualFinishedMatchStateSnapshot,
  isHistoryStackLike,
  isSameMatchState,
  isValidRuntimeMatchState,
  removeLatestPointForTeamFromHistory
} from './game/logic.js'
import {
  createPersistedMatchStateSnapshot,
  isPersistedMatchStateActive,
  loadState,
  mergeRuntimeStateWithPersistedSession,
  saveState,
  serializeMatchStateForComparison
} from './game/persistence.js'
import {
  clearWidgets as clearGameUiWidgets,
  createWidget as createGameUiWidget,
  renderGameScreen as renderBoundGameScreen
} from './game/ui-binding.js'

const INTERACTION_LATENCY_TARGET_MS = 100
const SCORING_DEBOUNCE_WINDOW_MS = 300
const PERSISTENCE_DEBOUNCE_WINDOW_MS = 180
const MANUAL_FINISH_CONFIRM_WINDOW_MS = 3000

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

function createRuntimeStateFingerprint(matchState) {
  if (!isValidRuntimeMatchState(matchState)) {
    return 'invalid'
  }

  const setHistoryLength = Array.isArray(matchState.setHistory)
    ? matchState.setHistory.length
    : -1
  const winnerTeam =
    (isRecord(matchState.winner) && matchState.winner.team) ||
    matchState.winnerTeam ||
    ''

  return [
    matchState.status,
    matchState.teamA.points,
    matchState.teamA.games,
    matchState.teamB.points,
    matchState.teamB.games,
    matchState.currentSetStatus.number,
    matchState.currentSetStatus.teamAGames,
    matchState.currentSetStatus.teamBGames,
    isRecord(matchState.setsWon) ? matchState.setsWon.teamA : '',
    isRecord(matchState.setsWon) ? matchState.setsWon.teamB : '',
    winnerTeam,
    setHistoryLength
  ].join('|')
}

Page({
  onInit() {
    this.widgets = []
    this.lastAcceptedScoringInteractionAt = null
    this.hasAttemptedSummaryNavigation = false
    this.isSessionAccessGranted = false
    this.persistedSessionState = null
    this.manualFinishConfirmMode = false
    this.manualFinishConfirmTimer = null

    this.persistenceDebounceWindowMs = PERSISTENCE_DEBOUNCE_WINDOW_MS
    this.runtimeStatePersistenceTimer = null
    this.pendingRuntimeStatePersistence = null
    this.isRuntimeStatePersistenceInFlight = false
    this.lastPersistedRuntimeStateSignature = null

    // Validate session synchronously before build() runs.
    this.validateSessionAccess()
  },

  build() {
    // build() always renders. If session access was denied, navigateToSetupPage()
    // was already called in onInit via validateSessionAccess(), so this page will
    // be replaced before the user sees it. Rendering a blank background here
    // avoids a black screen flash between onInit and the navigation completing.

    if (!this.isSessionAccessGranted) {
      if (typeof hmUI !== 'undefined') {
        const { width: bgWidth, height: bgHeight } = getScreenMetrics()
        hmUI.createWidget(hmUI.widget.FILL_RECT, {
          x: 0,
          y: 0,
          w: bgWidth,
          h: bgHeight,
          color: TOKENS.colors.background
        })
      }
      return
    }

    this.keepScreenOn()
    this.ensureRuntimeState()
    this.renderGameScreen()
    this.registerGestureHandler()
  },

  onDestroy() {
    this.resetManualFinishConfirmState()
    this.releaseScreenOn()
    this.handleLifecycleAutoSave()
    this.clearWidgets()
    this.unregisterGestureHandler()
  },

  clearManualFinishConfirmTimer() {
    if (this.manualFinishConfirmTimer === null) {
      return
    }

    if (typeof clearTimeout === 'function') {
      clearTimeout(this.manualFinishConfirmTimer)
    }

    this.manualFinishConfirmTimer = null
  },

  resetManualFinishConfirmState(options = {}) {
    const wasInConfirmMode = this.manualFinishConfirmMode === true

    this.clearManualFinishConfirmTimer()
    this.manualFinishConfirmMode = false

    const shouldRerender = isRecord(options) && options.rerender === true

    if (shouldRerender && wasInConfirmMode) {
      this.renderGameScreen()
    }
  },

  startManualFinishConfirmWindow() {
    this.clearManualFinishConfirmTimer()

    if (typeof setTimeout !== 'function') {
      return
    }

    this.manualFinishConfirmTimer = setTimeout(() => {
      this.manualFinishConfirmTimer = null

      if (!this.manualFinishConfirmMode) {
        return
      }

      this.manualFinishConfirmMode = false
      this.renderGameScreen()
    }, MANUAL_FINISH_CONFIRM_WINDOW_MS)
  },

  handleManualFinishTap() {
    if (this.manualFinishConfirmMode) {
      this.resetManualFinishConfirmState()
      this.handleManualFinishConfirm()
      return
    }

    this.manualFinishConfirmMode = true

    if (typeof hmUI !== 'undefined' && typeof hmUI.showToast === 'function') {
      try {
        hmUI.showToast({
          text: gettext('settings.clearDataConfirm')
        })
      } catch {
        // Non-fatal: toast failed.
      }
    }

    this.startManualFinishConfirmWindow()
    this.renderGameScreen()
  },

  handleManualFinishConfirm() {
    this.executeScoringAction(() => {
      const runtimeMatchState = this.getRuntimeMatchState()
      const nextState =
        createManualFinishedMatchStateSnapshot(runtimeMatchState)

      return nextState ?? runtimeMatchState
    })
  },

  registerGestureHandler() {
    if (
      typeof hmApp === 'undefined' ||
      typeof hmApp.registerGestureEvent !== 'function'
    ) {
      return
    }

    try {
      hmApp.registerGestureEvent((event) => {
        if (event === hmApp.gesture.RIGHT) {
          this.resetManualFinishConfirmState()
          // Save state before navigating
          this.saveCurrentRuntimeState({ force: true })
          // Navigate directly to Home Screen
          this.navigateToHomePage()
          // Return true to skip default goBack() behavior
          return true
        }
        // For other gestures, don't skip default behavior
        return false
      })
    } catch {
      // Non-fatal: gesture registration failed
    }
  },

  unregisterGestureHandler() {
    if (
      typeof hmApp === 'undefined' ||
      typeof hmApp.unregisterGestureEvent !== 'function'
    ) {
      return
    }

    try {
      hmApp.unregisterGestureEvent()
    } catch {
      // Non-fatal: gesture unregistration failed
    }
  },

  keepScreenOn() {
    try {
      // v1 API: set bright screen time to maximum (seconds). Cancel must be called on destroy.
      if (
        typeof hmSetting !== 'undefined' &&
        typeof hmSetting.setBrightScreen === 'function'
      ) {
        hmSetting.setBrightScreen(2147483)
      }
    } catch {
      // Non-fatal: may be unavailable in simulator.
    }
  },

  releaseScreenOn() {
    try {
      if (
        typeof hmSetting !== 'undefined' &&
        typeof hmSetting.setBrightScreenCancel === 'function'
      ) {
        hmSetting.setBrightScreenCancel()
      }
    } catch {
      // Non-fatal.
    }
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
      const persistedMatchState = loadState()
      const hasValidActiveSession =
        isPersistedMatchStateActive(persistedMatchState)

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

  clearWidgets() {
    this.widgets = clearGameUiWidgets(this.widgets)
  },

  createWidget(widgetType, properties) {
    return createGameUiWidget(this.widgets, widgetType, properties)
  },

  getAppInstance() {
    if (typeof getApp !== 'function') {
      return null
    }

    try {
      const app = getApp()

      if (!isRecord(app)) {
        return null
      }

      if (!isRecord(app.globalData)) {
        app.globalData = {}
      }

      return app
    } catch {
      return null
    }
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
      const persistedSessionState = loadState()

      runtimeMatchState =
        persistedSessionState !== null
          ? mergeRuntimeStateWithPersistedSession(
              createInitialMatchState(),
              persistedSessionState
            )
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
          nextPersistenceTask.signature ===
            this.lastPersistedRuntimeStateSignature
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

    const persistedMatchStateSnapshot = createPersistedMatchStateSnapshot(
      runtimeState,
      this.persistedSessionState
    )

    if (persistedMatchStateSnapshot !== null) {
      try {
        // Wrap persistence in try/catch so a write-time crash never breaks gameplay.
        saveState(persistedMatchStateSnapshot)
        this.persistedSessionState = cloneMatchState(
          persistedMatchStateSnapshot
        )

        // Cache the last written schema snapshot in globalData so app.onDestroy
        // can flush it as a safety net if page.onDestroy is skipped.
        const app = this.getAppInstance()
        if (app) {
          app.globalData._lastPersistedSchemaState = this.persistedSessionState
        }
      } catch {
        // Schema persistence failed (e.g. toISOString unavailable on device).
        // Keep persistedSessionState as-is so the in-memory session stays valid.
        if (this.persistedSessionState === null) {
          this.persistedSessionState = cloneMatchState(
            persistedMatchStateSnapshot
          )
        }
      }
    }

    this.lastPersistedRuntimeStateSignature =
      signature.length > 0
        ? signature
        : serializeMatchStateForComparison(runtimeState)
  },

  navigateToSummaryPage() {
    this.resetManualFinishConfirmState()

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
    // If navigation fails for any reason, unlock the guard to allow retry.
    const didNavigateToSummary = this.navigateToSummaryPage()
    if (!didNavigateToSummary) {
      this.hasAttemptedSummaryNavigation = false
    }
  },

  navigateToHomePage() {
    this.resetManualFinishConfirmState()

    if (typeof hmApp === 'undefined' || typeof hmApp.gotoPage !== 'function') {
      return
    }

    try {
      hmApp.gotoPage({
        url: 'page/index'
      })
    } catch {
      // Non-fatal: navigation failed
    }
  },

  handleBackToHome() {
    this.resetManualFinishConfirmState()
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

  measureInteractionPerformance(
    interactionStartedAt,
    renderStartedAt,
    uiUpdatedAt
  ) {
    if (
      !Number.isFinite(interactionStartedAt) ||
      !Number.isFinite(renderStartedAt) ||
      !Number.isFinite(uiUpdatedAt)
    ) {
      return
    }

    const interactionLatencyMs = Math.max(
      0,
      Math.round(uiUpdatedAt - interactionStartedAt)
    )
    const renderLatencyMs = Math.max(
      0,
      Math.round(uiUpdatedAt - renderStartedAt)
    )

    this.emitInteractionPerformanceMetrics({
      interactionLatencyMs,
      renderLatencyMs,
      latencyBudgetMs: INTERACTION_LATENCY_TARGET_MS,
      exceededLatencyBudget:
        interactionLatencyMs >= INTERACTION_LATENCY_TARGET_MS
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

    const nextState = addPoint(
      app.globalData.matchState,
      team,
      app.globalData.matchHistory
    )
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

    const nextState = removePoint(
      app.globalData.matchState,
      app.globalData.matchHistory
    )
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

    const removalResult = removeLatestPointForTeamFromHistory(
      app.globalData.matchState,
      app.globalData.matchHistory,
      team
    )

    if (
      !isRecord(removalResult) ||
      !isValidRuntimeMatchState(removalResult.runtimeState) ||
      !isHistoryStackLike(removalResult.historyStack)
    ) {
      return null
    }

    if (removalResult.didRemovePoint) {
      app.globalData.matchHistory = removalResult.historyStack
      app.globalData.matchState = removalResult.runtimeState
    }

    return removalResult.runtimeState
  },

  persistAndRender(nextState, interactionStartedAt, options = {}) {
    if (!isValidRuntimeMatchState(nextState)) {
      return
    }

    this.updateRuntimeMatchState(nextState)

    const renderStartedAt = this.getCurrentTimeMs()
    this.renderGameScreen()
    const uiUpdatedAt = this.getCurrentTimeMs()

    this.measureInteractionPerformance(
      interactionStartedAt,
      renderStartedAt,
      uiUpdatedAt
    )

    const shouldForcePersistence =
      isRecord(options) && options.forcePersistence === true
    this.saveCurrentRuntimeState({ force: shouldForcePersistence })
  },

  isScoringInteractionDebounced(interactionStartedAt) {
    if (
      !Number.isFinite(interactionStartedAt) ||
      !Number.isFinite(this.lastAcceptedScoringInteractionAt)
    ) {
      return false
    }

    const elapsedMs =
      interactionStartedAt - this.lastAcceptedScoringInteractionAt

    return elapsedMs >= 0 && elapsedMs < SCORING_DEBOUNCE_WINDOW_MS
  },

  executeScoringAction(action, options = {}) {
    if (typeof action !== 'function') {
      return
    }

    const shouldDebounceScoringInput =
      isRecord(options) && options.debounceScoringInput === true
    const interactionStartedAt = this.getCurrentTimeMs()

    if (
      shouldDebounceScoringInput &&
      this.isScoringInteractionDebounced(interactionStartedAt)
    ) {
      return
    }

    const previousState = this.getRuntimeMatchState()
    const previousFingerprint = createRuntimeStateFingerprint(previousState)
    const previousStatus = previousState?.status
    const actionResult = action()
    const runtimeStateAfterAction = this.getRuntimeMatchState()

    const candidateStates = []
    if (isValidRuntimeMatchState(actionResult)) {
      candidateStates.push(actionResult)
    }
    if (isValidRuntimeMatchState(runtimeStateAfterAction)) {
      candidateStates.push(runtimeStateAfterAction)
    }

    let nextState = null
    for (let index = 0; index < candidateStates.length; index += 1) {
      const candidateState = candidateStates[index]
      const candidateFingerprint = createRuntimeStateFingerprint(candidateState)

      if (candidateFingerprint !== previousFingerprint) {
        nextState = candidateState
        break
      }

      if (!isSameMatchState(previousState, candidateState)) {
        nextState = candidateState
        break
      }
    }

    if (!isValidRuntimeMatchState(nextState)) {
      return
    }

    if (shouldDebounceScoringInput) {
      this.lastAcceptedScoringInteractionAt = interactionStartedAt
    }

    if (previousStatus === 'finished' && nextState.status !== 'finished') {
      this.hasAttemptedSummaryNavigation = false
    }

    const didFinishMatch =
      previousStatus !== 'finished' && nextState.status === 'finished'

    // When match finishes, skip rendering and navigate directly to summary
    // This avoids the brief flash of the finished state screen
    if (didFinishMatch) {
      this.updateRuntimeMatchState(nextState)
      this.saveCurrentRuntimeState({ force: true })
      this.handleMatchFinishedTransition()
      return
    }

    this.persistAndRender(nextState, interactionStartedAt, {
      forcePersistence: false
    })
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

    renderBoundGameScreen({
      isSessionAccessGranted: this.isSessionAccessGranted,
      runtimeMatchState: this.getRuntimeMatchState(),
      persistedMatchState: this.persistedSessionState,
      manualFinishConfirmMode: this.manualFinishConfirmMode,
      gettext,
      clearWidgets: () => this.clearWidgets(),
      createWidget: (widgetType, properties) =>
        this.createWidget(widgetType, properties),
      onMatchFinished: () => this.handleMatchFinishedTransition(),
      onAddPointForTeam: (team) => this.handleAddPointForTeam(team),
      onRemovePointForTeam: (team) => this.handleRemovePointForTeam(team),
      onBackToHome: () => this.handleBackToHome(),
      onManualFinishTap: () => this.handleManualFinishTap()
    })
  }
})
