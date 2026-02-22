import { gettext } from 'i18n'
import { createHistoryStack } from '../utils/history-stack.js'
import { loadMatchState } from '../utils/match-storage.js'
import { MATCH_STATUS as PERSISTED_MATCH_STATUS } from '../utils/match-state-schema.js'
import { createInitialMatchState } from '../utils/match-state.js'
import { startNewMatchFlow } from '../utils/start-new-match-flow.js'

const PERSISTED_ADVANTAGE_POINT_VALUE = 50
const PERSISTED_GAME_POINT_VALUE = 60
const TIE_BREAK_ENTRY_GAMES = 6
const HOME_HARD_RESET_CONFIRMATION_WINDOW_MS = 2500
const REGULAR_GAME_POINT_VALUES = new Set([0, 15, 30, 40])

const HOME_TOKENS = Object.freeze({
  colors: {
    background: 0x000000,
    buttonText: 0x000000,
    primaryButton: 0x1eb98c,
    primaryButtonPressed: 0x1aa07a,
    logo: 0x1eb98c,
    title: 0xffffff
  },
  fontScale: {
    button: 0.055,
    logo: 0.068,
    title: 0.125
  },
  spacingScale: {
    contentTop: 0.24,
    logoToTitle: 0.012,
    titleToPrimaryButton: 0.18,
    primaryToSecondaryButton: 0.04
  }
})

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

function toNonNegativeInteger(value, fallback = 0) {
  return Number.isInteger(value) && value >= 0 ? value : fallback
}

function toPositiveInteger(value, fallback = 1) {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

function cloneSetHistory(setHistory) {
  if (!Array.isArray(setHistory)) {
    return []
  }

  return setHistory.map((entry, index) => ({
    setNumber: toPositiveInteger(entry?.setNumber, index + 1),
    teamAGames: toNonNegativeInteger(entry?.teamAGames, 0),
    teamBGames: toNonNegativeInteger(entry?.teamBGames, 0)
  }))
}

function resolveWinnerTeam(matchState) {
  if (!isRecord(matchState)) {
    return null
  }

  if (matchState.winnerTeam === 'teamA' || matchState.winnerTeam === 'teamB') {
    return matchState.winnerTeam
  }

  if (
    isRecord(matchState.winner) &&
    (matchState.winner.team === 'teamA' || matchState.winner.team === 'teamB')
  ) {
    return matchState.winner.team
  }

  return null
}

function isActivePersistedMatchState(matchState) {
  return (
    isRecord(matchState) && matchState.status === PERSISTED_MATCH_STATUS.ACTIVE
  )
}

function isTieBreakMode(teamAGames, teamBGames) {
  return teamAGames === TIE_BREAK_ENTRY_GAMES && teamBGames === TIE_BREAK_ENTRY_GAMES
}

function toRuntimePointValue(value, tieBreakMode) {
  if (!Number.isInteger(value) || value < 0) {
    return 0
  }

  if (tieBreakMode) {
    return value
  }

  if (value === PERSISTED_ADVANTAGE_POINT_VALUE) {
    return 'Ad'
  }

  if (value === PERSISTED_GAME_POINT_VALUE) {
    return 'Game'
  }

  if (REGULAR_GAME_POINT_VALUES.has(value)) {
    return value
  }

  return value
}

function normalizePersistedMatchStateForRuntime(persistedMatchState) {
  if (!isActivePersistedMatchState(persistedMatchState)) {
    return null
  }

  const runtimeState = createInitialMatchState()
  const currentSetNumber = toPositiveInteger(persistedMatchState?.currentSet?.number, 1)
  const teamAGames = toNonNegativeInteger(persistedMatchState?.currentSet?.games?.teamA, 0)
  const teamBGames = toNonNegativeInteger(persistedMatchState?.currentSet?.games?.teamB, 0)
  const tieBreakMode = isTieBreakMode(teamAGames, teamBGames)
  const winnerTeam = resolveWinnerTeam(persistedMatchState)

  runtimeState.currentSet = currentSetNumber
  runtimeState.currentSetStatus.number = currentSetNumber
  runtimeState.currentSetStatus.teamAGames = teamAGames
  runtimeState.currentSetStatus.teamBGames = teamBGames
  runtimeState.teamA.games = teamAGames
  runtimeState.teamB.games = teamBGames
  runtimeState.teamA.points = toRuntimePointValue(
    persistedMatchState?.currentGame?.points?.teamA,
    tieBreakMode
  )
  runtimeState.teamB.points = toRuntimePointValue(
    persistedMatchState?.currentGame?.points?.teamB,
    tieBreakMode
  )
  runtimeState.status = PERSISTED_MATCH_STATUS.ACTIVE
  runtimeState.updatedAt = Number.isFinite(persistedMatchState.updatedAt)
    ? persistedMatchState.updatedAt
    : Date.now()
  runtimeState.setsNeededToWin = toPositiveInteger(persistedMatchState.setsNeededToWin, 2)
  runtimeState.setsWon = {
    teamA: toNonNegativeInteger(persistedMatchState?.setsWon?.teamA, 0),
    teamB: toNonNegativeInteger(persistedMatchState?.setsWon?.teamB, 0)
  }
  runtimeState.setHistory = cloneSetHistory(persistedMatchState.setHistory)

  if (isRecord(persistedMatchState.teams)) {
    if (typeof persistedMatchState.teams?.teamA?.label === 'string') {
      runtimeState.teams.teamA.label = persistedMatchState.teams.teamA.label
    }

    if (typeof persistedMatchState.teams?.teamB?.label === 'string') {
      runtimeState.teams.teamB.label = persistedMatchState.teams.teamB.label
    }
  }

  if (winnerTeam) {
    runtimeState.winnerTeam = winnerTeam
    runtimeState.winner = {
      team: winnerTeam
    }
  }

  return runtimeState
}

Page({
  onInit() {
    this.widgets = []
    this.savedMatchState = null
    this.hasSavedGame = false
    this.isStartingNewGame = false
    this.isHardResetConfirmationArmed = false
    this.hardResetConfirmationTimerId = null
    this.refreshSavedMatchState()
  },

  onShow() {
    this.isStartingNewGame = false
    this.disarmHardResetConfirmation()
    this.savedMatchState = null
    this.hasSavedGame = false
    this.renderHomeScreen()
    this.refreshSavedMatchState()
  },

  build() {
    this.renderHomeScreen()
  },

  onDestroy() {
    this.clearHardResetConfirmationTimer()
    this.clearWidgets()
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

  refreshSavedMatchState() {
    let savedMatchState = null

    try {
      savedMatchState = loadMatchState()
    } catch {
      savedMatchState = null
    }

    const hasSavedGame = isActivePersistedMatchState(savedMatchState)
    this.savedMatchState = hasSavedGame ? cloneMatchState(savedMatchState) : null
    this.hasSavedGame = hasSavedGame
    this.renderHomeScreen()

    return hasSavedGame
  },

  renderHomeScreen() {
    if (typeof hmUI === 'undefined') {
      return
    }

    const { width, height } = this.getScreenMetrics()
    const logoY = Math.round(height * HOME_TOKENS.spacingScale.contentTop)
    const logoHeight = Math.round(height * 0.08)
    const titleY =
      logoY +
      logoHeight +
      Math.round(height * HOME_TOKENS.spacingScale.logoToTitle)
    const titleHeight = Math.round(height * 0.11)
    const startButtonWidth = Math.round(width * 0.62)
    const startButtonHeight = Math.round(height * 0.108)
    const startButtonX = Math.round((width - startButtonWidth) / 2)
    const startButtonY =
      titleY +
      titleHeight +
      Math.round(height * HOME_TOKENS.spacingScale.titleToPrimaryButton)
    const resumeButtonY =
      startButtonY +
      startButtonHeight +
      Math.round(height * HOME_TOKENS.spacingScale.primaryToSecondaryButton)
    const startNewGameButtonText = this.isHardResetConfirmationArmed
      ? gettext('home.confirmStartNewGame')
      : gettext('home.startNewGame')

    this.clearWidgets()

    this.createWidget(hmUI.widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: width,
      h: height,
      color: HOME_TOKENS.colors.background
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y: logoY,
      w: width,
      h: logoHeight,
      color: HOME_TOKENS.colors.logo,
      text: gettext('home.logo'),
      text_size: Math.round(width * HOME_TOKENS.fontScale.logo),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: 0,
      y: titleY,
      w: width,
      h: titleHeight,
      color: HOME_TOKENS.colors.title,
      text: gettext('home.title'),
      text_size: Math.round(width * HOME_TOKENS.fontScale.title),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.BUTTON, {
      x: startButtonX,
      y: startButtonY,
      w: startButtonWidth,
      h: startButtonHeight,
      radius: Math.round(startButtonHeight / 2),
      normal_color: HOME_TOKENS.colors.primaryButton,
      press_color: HOME_TOKENS.colors.primaryButtonPressed,
      color: HOME_TOKENS.colors.buttonText,
      text_size: Math.round(width * HOME_TOKENS.fontScale.button),
      text: startNewGameButtonText,
      click_func: () => this.handleStartNewGame()
    })

    if (!this.hasSavedGame) {
      return
    }

    this.createWidget(hmUI.widget.BUTTON, {
      x: startButtonX,
      y: resumeButtonY,
      w: startButtonWidth,
      h: startButtonHeight,
      radius: Math.round(startButtonHeight / 2),
      normal_color: HOME_TOKENS.colors.primaryButton,
      press_color: HOME_TOKENS.colors.primaryButtonPressed,
      color: HOME_TOKENS.colors.buttonText,
      text_size: Math.round(width * HOME_TOKENS.fontScale.button),
      text: gettext('home.resumeGame'),
      click_func: () => this.handleResumeGame()
    })
  },

  clearHardResetConfirmationTimer() {
    if (this.hardResetConfirmationTimerId === null) {
      return
    }

    if (typeof clearTimeout === 'function') {
      clearTimeout(this.hardResetConfirmationTimerId)
    }

    this.hardResetConfirmationTimerId = null
  },

  disarmHardResetConfirmation(options = {}) {
    const shouldRender = options.shouldRender === true
    const wasArmed = this.isHardResetConfirmationArmed === true

    this.isHardResetConfirmationArmed = false
    this.clearHardResetConfirmationTimer()

    if (shouldRender && wasArmed) {
      this.renderHomeScreen()
    }
  },

  armHardResetConfirmation() {
    this.isHardResetConfirmationArmed = true
    this.clearHardResetConfirmationTimer()

    if (typeof setTimeout === 'function') {
      this.hardResetConfirmationTimerId = setTimeout(() => {
        this.hardResetConfirmationTimerId = null

        if (this.isHardResetConfirmationArmed !== true) {
          return
        }

        this.isHardResetConfirmationArmed = false
        this.renderHomeScreen()
      }, HOME_HARD_RESET_CONFIRMATION_WINDOW_MS)
    }

    this.renderHomeScreen()
  },

  handleHardResetStartNewGame() {
    if (this.isStartingNewGame === true) {
      return false
    }

    this.isStartingNewGame = true

    try {
      const flowResult = startNewMatchFlow()
      return flowResult?.navigatedToSetup === true
    } catch {
      return false
    } finally {
      this.isStartingNewGame = false
    }
  },

  handleStartNewGame() {
    if (this.isStartingNewGame === true) {
      return false
    }

    if (this.isHardResetConfirmationArmed !== true) {
      this.armHardResetConfirmation()
      return false
    }

    this.disarmHardResetConfirmation()
    return this.handleHardResetStartNewGame()
  },

  handleResumeGame() {
    this.disarmHardResetConfirmation({
      shouldRender: true
    })

    let savedMatchState = null

    try {
      savedMatchState = loadMatchState()
    } catch {
      savedMatchState = null
    }

    if (!isActivePersistedMatchState(savedMatchState)) {
      this.savedMatchState = null
      this.hasSavedGame = false
      this.renderHomeScreen()
      return false
    }

    const restoredRuntimeMatchState = normalizePersistedMatchStateForRuntime(savedMatchState)

    if (!restoredRuntimeMatchState) {
      this.savedMatchState = null
      this.hasSavedGame = false
      this.renderHomeScreen()
      return false
    }

    this.savedMatchState = cloneMatchState(savedMatchState)
    this.hasSavedGame = true
    this.restoreRuntimeMatchState(restoredRuntimeMatchState)
    this.navigateToGamePage()
    return true
  },

  restoreRuntimeMatchState(matchState) {
    if (!matchState || typeof matchState !== 'object') {
      return
    }

    if (typeof getApp !== 'function') {
      return
    }

    const app = getApp()

    if (!app || typeof app !== 'object') {
      return
    }

    if (!app.globalData || typeof app.globalData !== 'object') {
      app.globalData = {}
    }

    app.globalData.matchState = cloneMatchState(matchState)

    if (
      app.globalData.matchHistory &&
      typeof app.globalData.matchHistory.clear === 'function'
    ) {
      app.globalData.matchHistory.clear()
      return
    }

    app.globalData.matchHistory = createHistoryStack()
  },

  navigateToGamePage() {
    if (typeof hmApp === 'undefined' || typeof hmApp.gotoPage !== 'function') {
      return
    }

    hmApp.gotoPage({
      url: 'page/game'
    })
  }
})
