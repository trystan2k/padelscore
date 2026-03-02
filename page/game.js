import { gettext } from 'i18n'

import { getFontSize, TOKENS, toPercentage } from '../utils/design-tokens.js'
import { createHistoryStack, deepCopyState } from '../utils/history-stack.js'
import { resolveLayout } from '../utils/layout-engine.js'
import { createScorePageLayout } from '../utils/layout-presets.js'
import { createInitialMatchState } from '../utils/match-state.js'
import {
  createDefaultMatchState as createDefaultPersistedMatchState,
  isMatchState as isPersistedMatchState,
  MATCH_STATUS as PERSISTED_MATCH_STATUS
} from '../utils/match-state-schema.js'
import { loadMatchState, saveMatchState } from '../utils/match-storage.js'
import { SCORE_POINTS } from '../utils/scoring-constants.js'
import { addPoint, removePoint } from '../utils/scoring-engine.js'
import { getScreenMetrics } from '../utils/screen-utils.js'
import { loadState, saveState } from '../utils/storage.js'
import {
  createBackground,
  createButton,
  createDivider,
  createText
} from '../utils/ui-components.js'
import { createScoreViewModel } from './score-view-model.js'

const INTERACTION_LATENCY_TARGET_MS = 100
const SCORING_DEBOUNCE_WINDOW_MS = 300
const PERSISTENCE_DEBOUNCE_WINDOW_MS = 180
const MANUAL_FINISH_CONFIRM_WINDOW_MS = 3000
const PERSISTED_ADVANTAGE_POINT_VALUE = 50
const PERSISTED_GAME_POINT_VALUE = 60
const DEFAULT_SETS_TO_PLAY = 3
const TIE_BREAK_ENTRY_GAMES = 6
const FOOTER_ICON_BUTTON_OFFSET = 36
const REGULAR_GAME_POINT_VALUES = new Set([
  SCORE_POINTS.LOVE,
  SCORE_POINTS.FIFTEEN,
  SCORE_POINTS.THIRTY,
  SCORE_POINTS.FORTY
])

/**
 * Layout schema for the game screen.
 * Uses declarative positioning resolved by layout-engine.
 * Two-column layout: Team A (left) | Team B (right)
 */
const GAME_LAYOUT = {
  sections: createScorePageLayout({
    headerTop: toPercentage(TOKENS.spacing.headerTop),
    headerHeight: '15%',
    scoreAreaGap: toPercentage(TOKENS.spacing.headerToContent),
    footerBottom: toPercentage(TOKENS.spacing.footerBottom),
    footerHeight: '5%',
    headerRoundSafeInset: false,
    scoreAreaRoundSafeInset: false,
    footerRoundSafeInset: false
  }).sections,
  elements: {
    // ── Header elements: SETS row ─────────────────────────────────────────
    setsLabel: {
      section: 'header',
      x: '5%',
      y: '0%',
      width: '42%',
      height: '50%',
      align: 'left',
      _meta: { type: 'text', style: 'body', colorKey: 'mutedText' }
    },
    setsValue: {
      section: 'header',
      x: '48%',
      y: '0%',
      width: '52%',
      height: '50%',
      align: 'left',
      _meta: { type: 'text', style: 'body', colorKey: 'accent' }
    },
    // ── Header elements: GAMES row ────────────────────────────────────────
    gamesLabel: {
      section: 'header',
      x: '5%',
      y: '50%',
      width: '42%',
      height: '50%',
      align: 'left',
      _meta: { type: 'text', style: 'body', colorKey: 'mutedText' }
    },
    gamesValue: {
      section: 'header',
      x: '48%',
      y: '50%',
      width: '52%',
      height: '50%',
      align: 'left',
      _meta: { type: 'text', style: 'body', colorKey: 'accent' }
    },
    // ── Score area: Team labels ───────────────────────────────────────────
    teamALabel: {
      section: 'scoreArea',
      x: '0%',
      y: '0%',
      width: '50%',
      height: '10%',
      align: 'left',
      _meta: { type: 'text', style: 'body', colorKey: 'mutedText', text: 'A' }
    },
    teamBLabel: {
      section: 'scoreArea',
      x: '50%',
      y: '0%',
      width: '50%',
      height: '10%',
      align: 'left',
      _meta: { type: 'text', style: 'body', colorKey: 'mutedText', text: 'B' }
    },
    // ── Score area: Score buttons (large tappable area) ───────────────────
    teamAScore: {
      section: 'scoreArea',
      x: '0%',
      y: '10%',
      width: '50%',
      height: '50%',
      align: 'left',
      _meta: { type: 'scoreButton', team: 'teamA' }
    },
    teamBScore: {
      section: 'scoreArea',
      x: '50%',
      y: '10%',
      width: '50%',
      height: '50%',
      align: 'left',
      _meta: { type: 'scoreButton', team: 'teamB' }
    },
    // ── Score area: Vertical divider ──────────────────────────────────────
    divider: {
      section: 'scoreArea',
      x: 'center',
      y: '5%',
      width: 1,
      height: '55%',
      _meta: { type: 'divider', orientation: 'vertical' }
    },
    // ── Score area: Minus buttons ─────────────────────────────────────────
    teamAMinus: {
      section: 'scoreArea',
      x: '5%',
      y: '65%',
      width: '20%',
      height: '13%',
      align: 'center',
      _meta: { type: 'minusButton', team: 'teamA' }
    },
    teamBMinus: {
      section: 'scoreArea',
      x: '75%',
      y: '65%',
      width: '20%',
      height: '13%',
      align: 'center',
      _meta: { type: 'minusButton', team: 'teamB' }
    },
    // ── Footer: Home button ───────────────────────────────────────────────
    homeButton: {
      section: 'footer',
      x: 'center',
      y: 'center',
      width: TOKENS.sizing.iconLarge,
      height: TOKENS.sizing.iconLarge,
      align: 'center',
      _meta: {
        type: 'iconButton',
        icon: 'home-icon.png',
        onClick: 'handleBackToHome'
      }
    },
    // ── Footer: Manual finish button ──────────────────────────────────────
    confirmFinishButton: {
      section: 'footer',
      x: 'center',
      y: 'center',
      width: TOKENS.sizing.iconLarge,
      height: TOKENS.sizing.iconLarge,
      align: 'center',
      _meta: {
        type: 'iconButton',
        icon: 'coach-icon.png',
        confirmIcon: 'whistle-icon.png',
        onClick: 'handleManualFinish'
      }
    }
  }
}

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

function isRecord(value) {
  return typeof value === 'object' && value !== null
}

function isPersistedMatchStateActive(matchState) {
  return (
    isRecord(matchState) && matchState.status === PERSISTED_MATCH_STATUS.ACTIVE
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
  return (
    teamAGames === TIE_BREAK_ENTRY_GAMES && teamBGames === TIE_BREAK_ENTRY_GAMES
  )
}

function toRuntimePointValue(
  value,
  tieBreakMode,
  fallback = SCORE_POINTS.LOVE
) {
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

function createManualFinishedMatchStateSnapshot(matchState) {
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

function mergeRuntimeStateWithPersistedSession(
  runtimeMatchState,
  persistedMatchState
) {
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

function createPersistedMatchStateSnapshot(
  runtimeMatchState,
  basePersistedMatchState
) {
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
        hmUI.createWidget(hmUI.widget.FILL_RECT, {
          x: 0,
          y: 0,
          w: this.getScreenMetrics().width,
          h: this.getScreenMetrics().height,
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
          this.storeHomeHandoff()
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
      let persistedMatchState = loadMatchState()

      // Fallback: if SysProGetChars did not return the state written by setup.js
      // (e.g. timing issue or unsupported API on this device), consume the handoff
      // value passed through globalData by setup.js instead.
      if (!isPersistedMatchStateActive(persistedMatchState)) {
        persistedMatchState = this.consumeSessionHandoff()
      }

      const hasValidActiveSession =
        isPersistedMatchStateActive(persistedMatchState)

      this.isSessionAccessGranted = hasValidActiveSession
      this.persistedSessionState = hasValidActiveSession
        ? cloneMatchState(persistedMatchState)
        : null

      if (hasValidActiveSession) {
        // Track match start time when session is validated
        // For resumed matches, this won't be exact, but history service handles it
        if (this.matchStartTime === null) {
          this.matchStartTime = Date.now()
        }
      }

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

  consumeSessionHandoff() {
    try {
      if (typeof getApp !== 'function') {
        return null
      }

      const app = getApp()

      if (!isRecord(app) || !isRecord(app.globalData)) {
        return null
      }

      const handoff = app.globalData.pendingPersistedMatchState

      // Consume it (clear) so it is only used once
      app.globalData.pendingPersistedMatchState = null

      return isRecord(handoff) ? handoff : null
    } catch {
      return null
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

    saveState(runtimeState)

    const persistedMatchStateSnapshot = createPersistedMatchStateSnapshot(
      runtimeState,
      this.persistedSessionState
    )

    if (persistedMatchStateSnapshot !== null) {
      try {
        saveMatchState(persistedMatchStateSnapshot)
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
        // Ignore schema persistence errors so gameplay interactions stay resilient.
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
    this.navigateToSummaryPage()
  },

  storeHomeHandoff() {
    // Pass the current persisted session state through globalData so the home
    // page can show the Resume button even if SysProGetChars doesn't return the
    // written value immediately after the page transition.
    try {
      const app = this.getAppInstance()

      if (!app) {
        return
      }

      const snapshot = this.persistedSessionState

      if (
        isPersistedMatchState(snapshot) &&
        isPersistedMatchStateActive(snapshot)
      ) {
        app.globalData.pendingHomeMatchState = cloneMatchState(snapshot)
      }
    } catch {
      // Non-fatal: handoff is a best-effort optimisation.
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
    this.storeHomeHandoff()
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

    if (
      !isValidRuntimeMatchState(app.globalData.matchState) ||
      !isHistoryStackLike(app.globalData.matchHistory)
    ) {
      return null
    }

    const historySnapshots = popHistorySnapshotsInOrder(
      app.globalData.matchHistory
    )
    const stateTimeline = [
      ...historySnapshots,
      deepCopyState(app.globalData.matchState)
    ]
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

    const previousState = cloneMatchState(this.getRuntimeMatchState())
    const nextState = action()

    if (
      !isValidRuntimeMatchState(nextState) ||
      isSameMatchState(previousState, nextState)
    ) {
      return
    }

    if (shouldDebounceScoringInput) {
      this.lastAcceptedScoringInteractionAt = interactionStartedAt
    }

    if (didMatchTransitionFromFinished(previousState, nextState)) {
      this.hasAttemptedSummaryNavigation = false
    }

    const didFinishMatch = didMatchTransitionToFinished(
      previousState,
      nextState
    )

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

    const matchState = this.getRuntimeMatchState()
    const viewModel = createScoreViewModel(matchState, {
      persistedMatchState: this.persistedSessionState
    })
    const isMatchFinished = viewModel.status === 'finished'

    // Get screen metrics and resolve layout
    const metrics = getScreenMetrics()
    const layout = resolveLayout(GAME_LAYOUT, metrics)

    this.clearWidgets()

    // Background
    const bg = createBackground()
    this.createWidget(bg.widgetType, bg.config)

    // Render header elements (SETS and GAMES rows)
    this.renderHeaderElements(layout, viewModel)

    // If match is already finished, navigate directly to summary page
    // This handles edge cases where the game page is opened with a finished match
    if (isMatchFinished) {
      this.handleMatchFinishedTransition()
      return
    }

    // Render active state (score buttons, minus buttons)
    this.renderActiveState(layout, viewModel)

    // Render footer (home button + manual finish button)
    this.renderFooterElements(layout)
  },

  renderHeaderElements(layout, viewModel) {
    const headerSection = layout.sections.header
    if (!headerSection) return

    // Calculate header text sizing
    const labelWidth = Math.round(headerSection.w * 0.42)
    const valueWidth = Math.round(headerSection.w * 0.52)
    const rowHeight = Math.round(headerSection.h / 2)
    const pairX =
      headerSection.x +
      Math.round((headerSection.w - (labelWidth + valueWidth)) / 2)
    const valueX = pairX + labelWidth

    // SETS row - Label
    const setsLabelConfig = createText({
      text: gettext('game.setsLabel'),
      style: 'body',
      x: pairX,
      y: headerSection.y,
      w: labelWidth,
      h: rowHeight,
      color: TOKENS.colors.mutedText,
      align_h: hmUI.align.RIGHT,
      align_v: hmUI.align.CENTER_V
    })
    this.createWidget(setsLabelConfig.widgetType, setsLabelConfig.config)

    // SETS row - Value
    const setsValueConfig = createText({
      text: `  ${viewModel.setsWon.teamA} – ${viewModel.setsWon.teamB}`,
      style: 'bodyLarge',
      x: valueX,
      y: headerSection.y,
      w: valueWidth,
      h: rowHeight,
      color: TOKENS.colors.accent,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V
    })
    this.createWidget(setsValueConfig.widgetType, setsValueConfig.config)

    // GAMES row - Label
    const gamesLabelConfig = createText({
      text: gettext('game.gamesLabel'),
      style: 'body',
      x: pairX,
      y: headerSection.y + rowHeight,
      w: labelWidth,
      h: rowHeight,
      color: TOKENS.colors.mutedText,
      align_h: hmUI.align.RIGHT,
      align_v: hmUI.align.CENTER_V
    })
    this.createWidget(gamesLabelConfig.widgetType, gamesLabelConfig.config)

    // GAMES row - Value
    const gamesValueConfig = createText({
      text: `  ${viewModel.currentSetGames.teamA} – ${viewModel.currentSetGames.teamB}`,
      style: 'bodyLarge',
      x: valueX,
      y: headerSection.y + rowHeight,
      w: valueWidth,
      h: rowHeight,
      color: TOKENS.colors.accent,
      align_h: hmUI.align.LEFT,
      align_v: hmUI.align.CENTER_V
    })
    this.createWidget(gamesValueConfig.widgetType, gamesValueConfig.config)
  },

  renderActiveState(layout, viewModel) {
    const scoreArea = layout.sections.scoreArea
    if (!scoreArea) return

    const { width } = getScreenMetrics()
    const halfWidth = Math.round(width / 2)

    // Team A Label - centered within left column
    const teamALabelEl = layout.elements.teamALabel
    if (teamALabelEl) {
      const teamALabelConfig = createText({
        text: 'A',
        style: 'body',
        x: teamALabelEl.x,
        y: teamALabelEl.y,
        w: teamALabelEl.w,
        h: teamALabelEl.h,
        color: TOKENS.colors.mutedText,
        align_h: hmUI.align.CENTER_H
      })
      this.createWidget(teamALabelConfig.widgetType, teamALabelConfig.config)
    }

    // Team B Label - centered within right column
    const teamBLabelEl = layout.elements.teamBLabel
    if (teamBLabelEl) {
      const teamBLabelConfig = createText({
        text: 'B',
        style: 'body',
        x: teamBLabelEl.x,
        y: teamBLabelEl.y,
        w: teamBLabelEl.w,
        h: teamBLabelEl.h,
        color: TOKENS.colors.mutedText,
        align_h: hmUI.align.CENTER_H
      })
      this.createWidget(teamBLabelConfig.widgetType, teamBLabelConfig.config)
    }

    // Team A Score Button
    const teamAScoreEl = layout.elements.teamAScore
    if (teamAScoreEl) {
      this.renderScoreButton(teamAScoreEl, viewModel.teamA.points, 'teamA')
    }

    // Team B Score Button
    const teamBScoreEl = layout.elements.teamBScore
    if (teamBScoreEl) {
      this.renderScoreButton(teamBScoreEl, viewModel.teamB.points, 'teamB')
    }

    // Divider
    const dividerEl = layout.elements.divider
    if (dividerEl) {
      const dividerConfig = createDivider({
        x: Math.round(width / 2) - 1,
        y: dividerEl.y,
        h: dividerEl.h,
        orientation: 'vertical',
        color: TOKENS.colors.divider
      })
      this.createWidget(dividerConfig.widgetType, dividerConfig.config)
    }

    // Team A Minus Button
    const teamAMinusEl = layout.elements.teamAMinus
    if (teamAMinusEl) {
      this.renderMinusButton(teamAMinusEl, 'teamA', halfWidth, 0)
    }

    // Team B Minus Button
    const teamBMinusEl = layout.elements.teamBMinus
    if (teamBMinusEl) {
      this.renderMinusButton(teamBMinusEl, 'teamB', halfWidth, halfWidth)
    }
  },

  renderScoreButton(element, points, team) {
    if (!element) return

    // Score button - uses custom styling (flat, large text)
    const scoreTextSize = getFontSize('scoreDisplay')

    this.createWidget(hmUI.widget.BUTTON, {
      x: element.x,
      y: element.y,
      w: element.w,
      h: element.h,
      radius: 0,
      normal_color: TOKENS.colors.background,
      press_color: TOKENS.colors.background,
      color: TOKENS.colors.text,
      text_size: scoreTextSize,
      text: String(points),
      click_func: () => this.handleAddPointForTeam(team)
    })
  },

  renderMinusButton(element, team, halfWidth, columnOffset) {
    if (!element) return

    // Ensure minimum 48x48 touch target for accessibility
    const MIN_TOUCH_SIZE = 48
    const buttonWidth = Math.max(element.w, MIN_TOUCH_SIZE)
    const buttonHeight = Math.max(element.h, MIN_TOUCH_SIZE)

    // Center the button horizontally within the column
    const buttonX = columnOffset + Math.round((halfWidth - buttonWidth) / 2)
    // Center the button vertically within the original allocated space
    const buttonY = element.y + Math.round((element.h - buttonHeight) / 2)

    const minusBtn = createButton({
      x: buttonX,
      y: buttonY,
      w: buttonWidth,
      h: buttonHeight,
      variant: 'secondary',
      text: '−',
      onClick: () => this.handleRemovePointForTeam(team)
    })

    // Override for minus button styling - use visual height for radius to maintain pill shape
    const visualRadius = Math.round(Math.min(element.w, element.h) / 2)
    minusBtn.config.radius = visualRadius
    minusBtn.config.color = TOKENS.colors.danger
    // Use a slightly lighter shade for press state (matching original GAME_TOKENS.buttonSecondaryPressed)
    minusBtn.config.press_color = 0x2d3036

    this.createWidget(minusBtn.widgetType, minusBtn.config)
  },

  renderFooterElements(layout) {
    const homeButtonEl = layout.elements.homeButton
    const homeButtonMeta = GAME_LAYOUT.elements.homeButton._meta
    const confirmFinishButtonEl = layout.elements.confirmFinishButton
    const confirmFinishMeta = GAME_LAYOUT.elements.confirmFinishButton._meta

    if (homeButtonEl && homeButtonMeta) {
      const homeBtn = createButton({
        x: Math.max(0, homeButtonEl.x - FOOTER_ICON_BUTTON_OFFSET),
        y: homeButtonEl.y,
        variant: 'icon',
        normal_src: homeButtonMeta.icon,
        onClick: () => this.handleBackToHome()
      })
      this.createWidget(homeBtn.widgetType, homeBtn.config)
    }

    if (confirmFinishButtonEl && confirmFinishMeta) {
      const icon = this.manualFinishConfirmMode
        ? confirmFinishMeta.confirmIcon
        : confirmFinishMeta.icon
      const confirmBtn = createButton({
        x: confirmFinishButtonEl.x + FOOTER_ICON_BUTTON_OFFSET,
        y: confirmFinishButtonEl.y,
        variant: 'icon',
        normal_src: icon,
        press_src: icon,
        onClick: () => this.handleManualFinishTap()
      })
      this.createWidget(confirmBtn.widgetType, confirmBtn.config)
    }
  }
})
