import { gettext } from 'i18n'

import { createHistoryStack } from '../utils/history-stack.js'
import { clearMatchState, loadMatchState } from '../utils/match-storage.js'
import { MATCH_STATUS as PERSISTED_MATCH_STATUS } from '../utils/match-state-schema.js'
import { createInitialMatchState } from '../utils/match-state.js'
import { clearState } from '../utils/storage.js'

const SUMMARY_TOKENS = Object.freeze({
  colors: {
    accent: 0x1eb98c,
    accentPressed: 0x1aa07a,
    background: 0x000000,
    buttonText: 0x000000,
    buttonSecondary: 0x24262b,
    buttonSecondaryPressed: 0x2d3036,
    buttonSecondaryText: 0xffffff,
    cardBackground: 0x111318,
    mutedText: 0x7d8289,
    text: 0xffffff
  },
  fontScale: {
    body: 0.04,
    button: 0.044,
    score: 0.11,
    subtitle: 0.036,
    title: 0.068,
    winner: 0.056
  },
  spacingScale: {
    bottomInset: 0.06,
    roundSideInset: 0.12,
    sectionGap: 0.02,
    sideInset: 0.07,
    topInset: 0.05
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

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
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

function isTeamIdentifier(team) {
  return team === 'teamA' || team === 'teamB'
}

function normalizeSetsWon(setsWon) {
  return {
    teamA: toNonNegativeInteger(setsWon?.teamA, 0),
    teamB: toNonNegativeInteger(setsWon?.teamB, 0)
  }
}

function normalizeSetHistory(setHistory) {
  if (!Array.isArray(setHistory)) {
    return []
  }

  return setHistory
    .map((entry, index) => ({
      setNumber: toPositiveInteger(entry?.setNumber, index + 1),
      teamAGames: toNonNegativeInteger(entry?.teamAGames, 0),
      teamBGames: toNonNegativeInteger(entry?.teamBGames, 0)
    }))
    .sort((leftEntry, rightEntry) => leftEntry.setNumber - rightEntry.setNumber)
}

function isFinishedMatchState(matchState) {
  return (
    isRecord(matchState) && matchState.status === PERSISTED_MATCH_STATUS.FINISHED
  )
}

function resolveWinnerTeam(matchState, setsWon) {
  if (isTeamIdentifier(matchState?.winnerTeam)) {
    return matchState.winnerTeam
  }

  if (isTeamIdentifier(matchState?.winner?.team)) {
    return matchState.winner.team
  }

  if (setsWon.teamA > setsWon.teamB) {
    return 'teamA'
  }

  if (setsWon.teamB > setsWon.teamA) {
    return 'teamB'
  }

  return null
}

function createSummaryViewModel(matchState) {
  const setsWon = normalizeSetsWon(matchState?.setsWon)
  const winnerTeam = resolveWinnerTeam(matchState, setsWon)
  const normalizedSetHistory = normalizeSetHistory(matchState?.setHistory)
  const hasFinishedMatch = isFinishedMatchState(matchState)
  const winnerText = hasFinishedMatch
    ? winnerTeam === 'teamA'
      ? gettext('summary.teamAWins')
      : winnerTeam === 'teamB'
        ? gettext('summary.teamBWins')
        : gettext('summary.matchFinished')
    : gettext('summary.matchUnavailable')

  const historyLines =
    normalizedSetHistory.length > 0
      ? normalizedSetHistory.map(
          (setEntry) => `Set ${setEntry.setNumber}: ${setEntry.teamAGames}-${setEntry.teamBGames}`
        )
      : [gettext('summary.noSetHistory')]

  return {
    finalSetsScore: `${setsWon.teamA}-${setsWon.teamB}`,
    historyLines,
    winnerText
  }
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

Page({
  onInit() {
    this.widgets = []
    this.finishedMatchState = null
    this.finishedMatchStateRequestId = 0
    this.refreshFinishedMatchState()
  },

  onShow() {
    this.refreshFinishedMatchState()
  },

  build() {
    this.renderSummaryScreen()
  },

  onDestroy() {
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

  getRuntimeFinishedMatchState() {
    const app = this.getAppInstance()

    if (!app || !isFinishedMatchState(app.globalData.matchState)) {
      return null
    }

    return cloneMatchState(app.globalData.matchState)
  },

  async refreshFinishedMatchState() {
    const requestId = this.finishedMatchStateRequestId + 1
    this.finishedMatchStateRequestId = requestId

    let persistedMatchState = null

    try {
      persistedMatchState = await loadMatchState()
    } catch {
      persistedMatchState = null
    }

    if (requestId !== this.finishedMatchStateRequestId) {
      return false
    }

    if (isFinishedMatchState(persistedMatchState)) {
      this.finishedMatchState = cloneMatchState(persistedMatchState)
    } else {
      this.finishedMatchState = this.getRuntimeFinishedMatchState()
    }

    this.renderSummaryScreen()
    return this.finishedMatchState !== null
  },

  resetRuntimeMatchState() {
    const app = this.getAppInstance()

    if (!app) {
      return
    }

    app.globalData.matchState = createInitialMatchState()

    if (
      app.globalData.matchHistory &&
      typeof app.globalData.matchHistory.clear === 'function'
    ) {
      app.globalData.matchHistory.clear()
      return
    }

    app.globalData.matchHistory = createHistoryStack()
  },

  navigateToHomePage() {
    if (typeof hmApp === 'undefined' || typeof hmApp.gotoPage !== 'function') {
      return false
    }

    try {
      hmApp.gotoPage({
        url: 'page/index'
      })
      return true
    } catch {
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

  handleNavigateHome() {
    return this.navigateToHomePage()
  },

  async handleStartNewGame() {
    clearState()
    await clearMatchState()
    this.resetRuntimeMatchState()
    this.navigateToSetupPage()
  },

  renderSummaryScreen() {
    if (typeof hmUI === 'undefined') {
      return
    }

    const { width, height } = this.getScreenMetrics()
    const isRoundScreen = Math.abs(width - height) <= Math.round(width * 0.04)
    const viewModel = createSummaryViewModel(this.finishedMatchState)
    const topInset = Math.round(height * SUMMARY_TOKENS.spacingScale.topInset)
    const bottomInset = Math.round(height * SUMMARY_TOKENS.spacingScale.bottomInset)
    const sectionGap = Math.round(height * SUMMARY_TOKENS.spacingScale.sectionGap)
    const baseSectionSideInset = Math.round(
      width *
        (isRoundScreen
          ? SUMMARY_TOKENS.spacingScale.roundSideInset
          : SUMMARY_TOKENS.spacingScale.sideInset)
    )
    const buttonHeight = clamp(Math.round(height * 0.105), 48, 58)
    const actionsSectionHeight = buttonHeight * 2 + sectionGap
    const actionsSectionY = height - bottomInset - actionsSectionHeight
    const minimumHistoryHeight = 72
    const maxHeaderHeight = Math.max(
      64,
      actionsSectionY - topInset - sectionGap * 2 - minimumHistoryHeight
    )
    const headerHeight = clamp(Math.round(height * 0.2), 64, maxHeaderHeight)
    const headerY = topInset
    const historyY = headerY + headerHeight + sectionGap
    const historyHeight = Math.max(1, actionsSectionY - sectionGap - historyY)
    const maxSectionInset = Math.floor((width - 1) / 2)

    const resolveSectionSideInset = (sectionY, sectionHeight) => {
      if (!isRoundScreen) {
        return clamp(baseSectionSideInset, 0, maxSectionInset)
      }

      const roundSafeInset = calculateRoundSafeSectionSideInset(
        width,
        height,
        sectionY,
        sectionHeight,
        Math.round(width * 0.01)
      )

      return clamp(Math.max(baseSectionSideInset, roundSafeInset), 0, maxSectionInset)
    }

    const headerSideInset = resolveSectionSideInset(headerY, headerHeight)
    const historySideInset = resolveSectionSideInset(historyY, historyHeight)
    const actionsSideInset = resolveSectionSideInset(actionsSectionY, actionsSectionHeight)
    const headerX = headerSideInset
    const headerWidth = Math.max(1, width - headerSideInset * 2)
    const historyX = historySideInset
    const historyWidth = Math.max(1, width - historySideInset * 2)
    const actionsX = actionsSideInset
    const actionsWidth = Math.max(1, width - actionsSideInset * 2)
    const titleHeight = clamp(Math.round(headerHeight * 0.28), 24, 34)
    const winnerHeight = clamp(Math.round(headerHeight * 0.36), 28, 44)
    const scoreLabelHeight = clamp(Math.round(headerHeight * 0.18), 16, 24)
    const scoreValueY = headerY + titleHeight + winnerHeight + scoreLabelHeight
    const scoreValueHeight = Math.max(1, headerHeight - titleHeight - winnerHeight - scoreLabelHeight)
    const historyTitleHeight = clamp(Math.round(historyHeight * 0.24), 24, 32)
    const historyBodyY = historyY + historyTitleHeight
    const historyBodyHeight = Math.max(1, historyHeight - historyTitleHeight)
    const maxHistoryRows = Math.max(1, Math.floor(historyBodyHeight / 20))
    const visibleHistoryLines = viewModel.historyLines.slice(0, maxHistoryRows)
    const historyRowHeight = Math.max(1, Math.floor(historyBodyHeight / visibleHistoryLines.length))

    this.clearWidgets()

    this.createWidget(hmUI.widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: width,
      h: height,
      color: SUMMARY_TOKENS.colors.background
    })

    this.createWidget(hmUI.widget.FILL_RECT, {
      x: headerX,
      y: headerY,
      w: headerWidth,
      h: headerHeight,
      radius: Math.round(headerHeight * 0.2),
      color: SUMMARY_TOKENS.colors.cardBackground
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: headerX,
      y: headerY,
      w: headerWidth,
      h: titleHeight,
      color: SUMMARY_TOKENS.colors.mutedText,
      text: gettext('summary.title'),
      text_size: Math.round(width * SUMMARY_TOKENS.fontScale.title),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: headerX,
      y: headerY + titleHeight,
      w: headerWidth,
      h: winnerHeight,
      color: SUMMARY_TOKENS.colors.accent,
      text: viewModel.winnerText,
      text_size: Math.round(width * SUMMARY_TOKENS.fontScale.winner),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: headerX,
      y: headerY + titleHeight + winnerHeight,
      w: headerWidth,
      h: scoreLabelHeight,
      color: SUMMARY_TOKENS.colors.mutedText,
      text: gettext('summary.finalScoreLabel'),
      text_size: Math.round(width * SUMMARY_TOKENS.fontScale.subtitle),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: headerX,
      y: scoreValueY,
      w: headerWidth,
      h: scoreValueHeight,
      color: SUMMARY_TOKENS.colors.text,
      text: viewModel.finalSetsScore,
      text_size: Math.round(width * SUMMARY_TOKENS.fontScale.score),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.FILL_RECT, {
      x: historyX,
      y: historyY,
      w: historyWidth,
      h: historyHeight,
      radius: Math.round(historyHeight * 0.18),
      color: SUMMARY_TOKENS.colors.cardBackground
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: historyX,
      y: historyY,
      w: historyWidth,
      h: historyTitleHeight,
      color: SUMMARY_TOKENS.colors.mutedText,
      text: gettext('summary.setHistoryTitle'),
      text_size: Math.round(width * SUMMARY_TOKENS.fontScale.subtitle),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    visibleHistoryLines.forEach((historyLine, index) => {
      this.createWidget(hmUI.widget.TEXT, {
        x: historyX,
        y: historyBodyY + historyRowHeight * index,
        w: historyWidth,
        h: historyRowHeight,
        color: SUMMARY_TOKENS.colors.text,
        text: historyLine,
        text_size: Math.round(width * SUMMARY_TOKENS.fontScale.body),
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V
      })
    })

    this.createWidget(hmUI.widget.BUTTON, {
      x: actionsX,
      y: actionsSectionY,
      w: actionsWidth,
      h: buttonHeight,
      radius: Math.round(buttonHeight / 2),
      normal_color: SUMMARY_TOKENS.colors.buttonSecondary,
      press_color: SUMMARY_TOKENS.colors.buttonSecondaryPressed,
      color: SUMMARY_TOKENS.colors.buttonSecondaryText,
      text_size: Math.round(width * SUMMARY_TOKENS.fontScale.button),
      text: gettext('summary.home'),
      click_func: () => this.handleNavigateHome()
    })

    this.createWidget(hmUI.widget.BUTTON, {
      x: actionsX,
      y: actionsSectionY + buttonHeight + sectionGap,
      w: actionsWidth,
      h: buttonHeight,
      radius: Math.round(buttonHeight / 2),
      normal_color: SUMMARY_TOKENS.colors.accent,
      press_color: SUMMARY_TOKENS.colors.accentPressed,
      color: SUMMARY_TOKENS.colors.buttonText,
      text_size: Math.round(width * SUMMARY_TOKENS.fontScale.button),
      text: gettext('summary.startNewGame'),
      click_func: () => this.handleStartNewGame()
    })
  }
})
