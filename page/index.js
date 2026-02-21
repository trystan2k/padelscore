import { gettext } from 'i18n'
import { createHistoryStack } from '../utils/history-stack.js'
import { clearMatchState } from '../utils/match-storage.js'
import { createInitialMatchState } from '../utils/match-state.js'
import { clearState, loadState } from '../utils/storage.js'

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

Page({
  onInit() {
    this.widgets = []
    this.savedMatchState = null
    this.hasSavedGame = false
    this.refreshSavedMatchState()
  },

  onShow() {
    this.refreshSavedMatchState()
    this.renderHomeScreen()
  },

  build() {
    this.renderHomeScreen()
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

  refreshSavedMatchState() {
    const savedMatchState = loadState()
    this.savedMatchState = savedMatchState
    this.hasSavedGame = savedMatchState !== null
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
      text: gettext('home.startNewGame'),
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

  async handleStartNewGame() {
    clearState()
    await clearMatchState()
    this.resetRuntimeMatchState()
    this.navigateToSetupPage()
  },

  handleResumeGame() {
    if (!this.savedMatchState) {
      return
    }

    this.restoreRuntimeMatchState(this.savedMatchState)
    this.navigateToGamePage()
  },

  resetRuntimeMatchState() {
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

  navigateToSetupPage() {
    if (typeof hmApp === 'undefined' || typeof hmApp.gotoPage !== 'function') {
      return
    }

    hmApp.gotoPage({
      url: 'page/setup'
    })
  }
})
