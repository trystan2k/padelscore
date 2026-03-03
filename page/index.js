import { gettext } from 'i18n'
import { TOKENS, toPercentage } from '../utils/design-tokens.js'
import { createHistoryStack } from '../utils/history-stack.js'
import { resolveLayout } from '../utils/layout-engine.js'
import { createPageWithFooterButton } from '../utils/layout-presets.js'
import { createInitialMatchState } from '../utils/match-state.js'
import { MATCH_STATUS as PERSISTED_MATCH_STATUS } from '../utils/match-state-schema.js'
import { getActiveSession } from '../utils/match-storage.js'
import { getScreenMetrics } from '../utils/screen-utils.js'
import { startNewMatchFlow } from '../utils/start-new-match-flow.js'
import {
  createBackground,
  createButton,
  createText
} from '../utils/ui-components.js'
import {
  cloneMatchState,
  cloneSetHistory,
  isRecord,
  isTieBreakMode,
  resolveWinnerTeam,
  toNonNegativeInteger,
  toPositiveInteger,
  toRuntimePointValue
} from '../utils/validation.js'

/**
 * Layout schema for the home screen.
 * Uses declarative positioning resolved by layout-engine.
 */
const INDEX_BASE_LAYOUT = createPageWithFooterButton({
  icon: 'setting-icon.png',
  footerButtonName: 'settingsButton',
  hasHeader: true,
  top: 0,
  bottom: 0,
  bodyGap: 0,
  headerHeight: '22%',
  footerHeight: '5%',
  headerRoundSafeInset: false,
  bodyRoundSafeInset: false,
  footerRoundSafeInset: false
})

const INDEX_LAYOUT = {
  sections: INDEX_BASE_LAYOUT.sections,
  elements: {
    ...INDEX_BASE_LAYOUT.elements,
    logo: {
      section: 'header',
      x: 'center',
      y: '10%',
      width: '100%',
      height: '40%',
      align: 'center',
      _meta: {
        type: 'text',
        style: 'sectionTitle',
        text: 'home.logo',
        color: TOKENS.colors.accent
      }
    },
    pageTitle: {
      section: 'header',
      x: 'center',
      y: '55%',
      width: '100%',
      height: '40%',
      align: 'center',
      _meta: {
        type: 'text',
        style: 'pageTitle',
        text: 'home.title'
      }
    },
    primaryButton: {
      section: 'body',
      x: 'center',
      y: '15%',
      width: toPercentage(TOKENS.sizing.buttonWidth), // '85%'
      // height calculated in render using screen height ratio
      align: 'center',
      _meta: {
        type: 'button',
        variant: 'primary',
        text: 'home.startNewGame',
        onClick: 'handleStartNewGame'
      }
    },
    secondaryButton: {
      section: 'body',
      x: 'center',
      y: '50%',
      width: toPercentage(TOKENS.sizing.buttonWidth), // '85%'
      // height calculated in render using screen height ratio
      align: 'center',
      _meta: {
        type: 'button',
        variant: 'secondary',
        text: 'home.resumeGame',
        onClick: 'handleResumeGame',
        conditional: 'hasSavedGame'
      }
    },
    settingsButton: {
      ...INDEX_BASE_LAYOUT.elements.settingsButton,
      y: '20%',
      _meta: {
        ...INDEX_BASE_LAYOUT.elements.settingsButton._meta,
        onClick: 'navigateToSettings'
      }
    }
  }
}

function isActivePersistedMatchState(matchState) {
  return (
    isRecord(matchState) && matchState.status === PERSISTED_MATCH_STATUS.ACTIVE
  )
}

function normalizePersistedMatchStateForRuntime(persistedMatchState) {
  if (!isActivePersistedMatchState(persistedMatchState)) {
    return null
  }

  const runtimeState = createInitialMatchState()
  const currentSetNumber = toPositiveInteger(
    persistedMatchState?.currentSet?.number,
    1
  )
  const teamAGames = toNonNegativeInteger(
    persistedMatchState?.currentSet?.games?.teamA,
    0
  )
  const teamBGames = toNonNegativeInteger(
    persistedMatchState?.currentSet?.games?.teamB,
    0
  )
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
  runtimeState.setsNeededToWin = toPositiveInteger(
    persistedMatchState.setsNeededToWin,
    2
  )
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
    this.refreshSavedMatchState()
    this.registerGestureHandler()
  },

  build() {
    this.renderHomeScreen()
  },

  onDestroy() {
    this.unregisterGestureHandler()
    this.clearWidgets()
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
          // Exit the app and return to watchface
          // Using gotoHome() instead of goBack() to properly exit the app
          // (goBack() only navigates the page stack, not exit the app)
          if (typeof hmApp.gotoHome === 'function') {
            hmApp.gotoHome()
          }
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
      savedMatchState = getActiveSession()
    } catch {
      savedMatchState = null
    }

    const hasSavedGame = isActivePersistedMatchState(savedMatchState)
    this.savedMatchState = hasSavedGame
      ? cloneMatchState(savedMatchState)
      : null
    this.hasSavedGame = hasSavedGame
    this.renderHomeScreen()

    return hasSavedGame
  },

  renderHomeScreen() {
    if (typeof hmUI === 'undefined') {
      return
    }

    const metrics = getScreenMetrics()
    const layout = resolveLayout(INDEX_LAYOUT, metrics)

    this.clearWidgets()

    // Background
    const bg = createBackground()
    this.createWidget(bg.widgetType, bg.config)

    // Logo text
    const logoEl = layout.elements.logo
    const logoMeta = INDEX_LAYOUT.elements.logo._meta
    if (logoEl) {
      const logoConfig = createText({
        text: gettext(logoMeta.text),
        style: logoMeta.style,
        x: logoEl.x,
        y: logoEl.y,
        w: logoEl.w,
        h: logoEl.h,
        color: logoMeta.color
      })
      this.createWidget(logoConfig.widgetType, logoConfig.config)
    }

    // Page title
    const titleEl = layout.elements.pageTitle
    const titleMeta = INDEX_LAYOUT.elements.pageTitle._meta
    if (titleEl) {
      const titleConfig = createText({
        text: gettext(titleMeta.text),
        style: titleMeta.style,
        x: titleEl.x,
        y: titleEl.y,
        w: titleEl.w,
        h: titleEl.h
      })
      this.createWidget(titleConfig.widgetType, titleConfig.config)
    }

    // Primary button - Start New Game
    const primaryEl = layout.elements.primaryButton
    const primaryMeta = INDEX_LAYOUT.elements.primaryButton._meta
    if (primaryEl) {
      const primaryBtn = createButton({
        x: primaryEl.x,
        y: primaryEl.y,
        w: primaryEl.w,
        variant: primaryMeta.variant,
        text: gettext(primaryMeta.text),
        onClick: () => this.handleStartNewGame()
      })
      this.createWidget(primaryBtn.widgetType, primaryBtn.config)
    }

    // Secondary button - Resume Game (conditional)
    if (this.hasSavedGame) {
      const secondaryEl = layout.elements.secondaryButton
      const secondaryMeta = INDEX_LAYOUT.elements.secondaryButton._meta
      if (secondaryEl) {
        const secondaryBtn = createButton({
          x: secondaryEl.x,
          y: secondaryEl.y,
          w: secondaryEl.w,
          variant: secondaryMeta.variant,
          text: gettext(secondaryMeta.text),
          onClick: () => this.handleResumeGame()
        })
        this.createWidget(secondaryBtn.widgetType, secondaryBtn.config)
      }
    }

    // Settings icon button
    const settingsEl = layout.elements.settingsButton
    const settingsMeta = INDEX_LAYOUT.elements.settingsButton._meta
    if (settingsEl) {
      const settingsBtn = createButton({
        x: settingsEl.x,
        y: settingsEl.y,
        variant: 'icon',
        normal_src: settingsMeta.icon,
        onClick: () => this.navigateToSettings()
      })
      this.createWidget(settingsBtn.widgetType, settingsBtn.config)
    }
  },

  handleStartNewGame() {
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

  handleResumeGame() {
    let savedMatchState = null

    try {
      savedMatchState = getActiveSession()
    } catch {
      this.savedMatchState = null
      this.hasSavedGame = false
      this.renderHomeScreen()
      return false
    }

    if (!isActivePersistedMatchState(savedMatchState)) {
      this.savedMatchState = null
      this.hasSavedGame = false
      this.renderHomeScreen()
      return false
    }

    const restoredRuntimeMatchState =
      normalizePersistedMatchStateForRuntime(savedMatchState)

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
  },

  navigateToSettings() {
    if (typeof hmApp === 'undefined' || typeof hmApp.gotoPage !== 'function') {
      return false
    }

    try {
      hmApp.gotoPage({
        url: 'page/settings'
      })
      return true
    } catch {
      return false
    }
  }
})
