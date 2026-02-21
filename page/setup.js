import { gettext } from 'i18n'

import { initializeMatchState } from '../utils/match-session-init.js'
import { loadMatchState, saveMatchState } from '../utils/match-storage.js'
import { MATCH_STATUS } from '../utils/match-state-schema.js'

const MATCH_SET_OPTIONS = Object.freeze([1, 3, 5])

const SETUP_TOKENS = Object.freeze({
  colors: {
    background: 0x000000,
    buttonText: 0x000000,
    cardBackground: 0x111318,
    disabledButton: 0x2a2d34,
    disabledButtonText: 0x7d8289,
    errorText: 0xff6d78,
    mutedText: 0x7d8289,
    optionButton: 0x24262b,
    optionButtonPressed: 0x2d3036,
    optionButtonText: 0xffffff,
    optionSelectedButton: 0x1eb98c,
    optionSelectedButtonPressed: 0x1aa07a,
    optionSelectedButtonText: 0x000000,
    startButton: 0x1eb98c,
    startButtonPressed: 0x1aa07a,
    title: 0xffffff
  },
  fontScale: {
    helper: 0.04,
    option: 0.05,
    start: 0.052,
    title: 0.1
  },
  spacingScale: {
    cardTop: 0.2,
    cardHorizontalInset: 0.07,
    helperToOptions: 0.03,
    optionsToStart: 0.08,
    startToError: 0.025,
    titleToHelper: 0.03
  }
})

function ensureNumber(value, fallback) {
  return Number.isFinite(value) && value > 0 ? value : fallback
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max)
}

function isValidSetsOption(setsToPlay) {
  return MATCH_SET_OPTIONS.includes(setsToPlay)
}

function isRecord(value) {
  return typeof value === 'object' && value !== null
}

function isVerifiedActiveSession(matchState, setsToPlay) {
  return (
    isRecord(matchState) &&
    matchState.status === MATCH_STATUS.ACTIVE &&
    matchState.setsToPlay === setsToPlay &&
    matchState.setsNeededToWin === Math.ceil(setsToPlay / 2)
  )
}

Page({
  onInit() {
    this.widgets = []
    this.isPersistingMatchState = false
    this.isNavigatingToGame = false
    this.selectedSetsToPlay = null
    this.startErrorMessage = ''
  },

  onShow() {
    this.isNavigatingToGame = false
    this.renderSetupScreen()
  },

  build() {
    this.renderSetupScreen()
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

  hasSetSelection() {
    return isValidSetsOption(this.selectedSetsToPlay)
  },

  isStartMatchEnabled() {
    return (
      this.hasSetSelection() &&
      !this.isPersistingMatchState &&
      !this.isNavigatingToGame
    )
  },

  getOptionLabel(setsToPlay) {
    if (setsToPlay === 1) {
      return gettext('setup.option.oneSet')
    }

    if (setsToPlay === 3) {
      return gettext('setup.option.threeSets')
    }

    return gettext('setup.option.fiveSets')
  },

  handleSelectSets(setsToPlay) {
    if (!isValidSetsOption(setsToPlay)) {
      return
    }

    if (this.selectedSetsToPlay === setsToPlay) {
      return
    }

    this.startErrorMessage = ''
    this.selectedSetsToPlay = setsToPlay
    this.renderSetupScreen()
  },

  async handleStartMatch() {
    if (!this.isStartMatchEnabled()) {
      return false
    }

    this.isPersistingMatchState = true
    this.startErrorMessage = ''
    this.renderSetupScreen()

    let initializedMatchState = null
    let hasVerifiedPersistedSession = false

    try {
      initializedMatchState = initializeMatchState(this.selectedSetsToPlay)
      await saveMatchState(initializedMatchState)
      hasVerifiedPersistedSession = await this.verifyPersistedActiveSession(
        this.selectedSetsToPlay
      )
    } catch {
      this.startErrorMessage = gettext('setup.saveFailed')
      this.isPersistingMatchState = false
      this.renderSetupScreen()
      return false
    }

    if (!hasVerifiedPersistedSession) {
      this.startErrorMessage = gettext('setup.saveFailed')
      this.isPersistingMatchState = false
      this.renderSetupScreen()
      return false
    }

    this.isPersistingMatchState = false
    this.isNavigatingToGame = true
    this.startErrorMessage = ''

    const didNavigateToGame = this.navigateToGamePage()

    if (!didNavigateToGame) {
      this.isNavigatingToGame = false
      this.startErrorMessage = gettext('setup.saveFailed')
      this.renderSetupScreen()
      return false
    }

    if (typeof this.onStartMatch === 'function') {
      this.onStartMatch(this.selectedSetsToPlay, initializedMatchState)
    }

    return true
  },

  async verifyPersistedActiveSession(setsToPlay) {
    if (!isValidSetsOption(setsToPlay)) {
      return false
    }

    try {
      const persistedMatchState = await loadMatchState()
      return isVerifiedActiveSession(persistedMatchState, setsToPlay)
    } catch {
      return false
    }
  },

  navigateToGamePage() {
    if (typeof hmApp === 'undefined' || typeof hmApp.gotoPage !== 'function') {
      return false
    }

    try {
      hmApp.gotoPage({
        url: 'page/game'
      })
      return true
    } catch {
      return false
    }
  },

  renderSetupScreen() {
    if (typeof hmUI === 'undefined') {
      return
    }

    const { width, height } = this.getScreenMetrics()
    const cardInset = Math.round(width * SETUP_TOKENS.spacingScale.cardHorizontalInset)
    const cardWidth = Math.max(1, width - cardInset * 2)
    const cardHeight = Math.round(height * 0.54)
    const cardY = Math.round(height * SETUP_TOKENS.spacingScale.cardTop)
    const titleHeight = Math.round(height * 0.09)
    const helperY =
      cardY +
      titleHeight +
      Math.round(height * SETUP_TOKENS.spacingScale.titleToHelper)
    const helperHeight = Math.round(height * 0.05)
    const optionButtonHeight = clamp(Math.round(height * 0.102), 48, 62)
    const optionColumnGap = Math.round(width * 0.022)
    const optionsRowY =
      helperY +
      helperHeight +
      Math.round(height * SETUP_TOKENS.spacingScale.helperToOptions)
    const optionsTotalGap = optionColumnGap * (MATCH_SET_OPTIONS.length - 1)
    const optionButtonWidth = Math.max(
      1,
      Math.round((cardWidth - optionsTotalGap) / MATCH_SET_OPTIONS.length)
    )
    const startButtonHeight = clamp(Math.round(height * 0.105), 50, 64)
    const startButtonY =
      optionsRowY +
      optionButtonHeight +
      Math.round(height * SETUP_TOKENS.spacingScale.optionsToStart)
    const startButtonWidth = Math.round(cardWidth * 0.78)
    const startButtonX = Math.round((width - startButtonWidth) / 2)
    const canStartMatch = this.isStartMatchEnabled()
    const errorY =
      startButtonY +
      startButtonHeight +
      Math.round(height * SETUP_TOKENS.spacingScale.startToError)
    const errorHeight = Math.round(height * 0.06)

    this.clearWidgets()

    this.createWidget(hmUI.widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: width,
      h: height,
      color: SETUP_TOKENS.colors.background
    })

    this.createWidget(hmUI.widget.FILL_RECT, {
      x: cardInset,
      y: cardY,
      w: cardWidth,
      h: cardHeight,
      radius: Math.round(cardWidth * 0.07),
      color: SETUP_TOKENS.colors.cardBackground
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: cardInset,
      y: cardY,
      w: cardWidth,
      h: titleHeight,
      color: SETUP_TOKENS.colors.title,
      text: gettext('setup.title'),
      text_size: Math.round(width * SETUP_TOKENS.fontScale.title),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: cardInset,
      y: helperY,
      w: cardWidth,
      h: helperHeight,
      color: SETUP_TOKENS.colors.mutedText,
      text: gettext('setup.selectSetsHint'),
      text_size: Math.round(width * SETUP_TOKENS.fontScale.helper),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    MATCH_SET_OPTIONS.forEach((setsToPlay, index) => {
      const isSelected = this.selectedSetsToPlay === setsToPlay
      const optionButtonX = cardInset + (optionButtonWidth + optionColumnGap) * index

      this.createWidget(hmUI.widget.BUTTON, {
        x: optionButtonX,
        y: optionsRowY,
        w: optionButtonWidth,
        h: optionButtonHeight,
        radius: Math.round(optionButtonHeight / 2),
        normal_color: isSelected
          ? SETUP_TOKENS.colors.optionSelectedButton
          : SETUP_TOKENS.colors.optionButton,
        press_color: isSelected
          ? SETUP_TOKENS.colors.optionSelectedButtonPressed
          : SETUP_TOKENS.colors.optionButtonPressed,
        color: isSelected
          ? SETUP_TOKENS.colors.optionSelectedButtonText
          : SETUP_TOKENS.colors.optionButtonText,
        text_size: Math.round(width * SETUP_TOKENS.fontScale.option),
        text: this.getOptionLabel(setsToPlay),
        click_func: () => this.handleSelectSets(setsToPlay)
      })
    })

    this.createWidget(hmUI.widget.BUTTON, {
      x: startButtonX,
      y: startButtonY,
      w: startButtonWidth,
      h: startButtonHeight,
      radius: Math.round(startButtonHeight / 2),
      normal_color: canStartMatch
        ? SETUP_TOKENS.colors.startButton
        : SETUP_TOKENS.colors.disabledButton,
      press_color: canStartMatch
        ? SETUP_TOKENS.colors.startButtonPressed
        : SETUP_TOKENS.colors.disabledButton,
      color: canStartMatch
        ? SETUP_TOKENS.colors.buttonText
        : SETUP_TOKENS.colors.disabledButtonText,
      text_size: Math.round(width * SETUP_TOKENS.fontScale.start),
      text: gettext('setup.startMatch'),
      click_func: () => {
        if (!canStartMatch) {
          return false
        }

        return this.handleStartMatch()
      }
    })

    if (this.startErrorMessage.length > 0) {
      this.createWidget(hmUI.widget.TEXT, {
        x: cardInset,
        y: errorY,
        w: cardWidth,
        h: errorHeight,
        color: SETUP_TOKENS.colors.errorText,
        text: this.startErrorMessage,
        text_size: Math.round(width * SETUP_TOKENS.fontScale.helper),
        align_h: hmUI.align.CENTER_H,
        align_v: hmUI.align.CENTER_V
      })
    }
  }
})
