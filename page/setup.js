import { gettext } from 'i18n'

import { MATCH_SET_OPTIONS } from '../utils/constants.js'
import { TOKENS, toPercentage } from '../utils/design-tokens.js'
import { resolveLayout } from '../utils/layout-engine.js'
import { createPageWithFooterButton } from '../utils/layout-presets.js'
import { initializeMatchState } from '../utils/match-session-init.js'
import { MATCH_STATUS } from '../utils/match-state-schema.js'
import {
  clearActiveSession,
  getActiveSession,
  saveActiveSession
} from '../utils/match-storage.js'
import { getScreenMetrics } from '../utils/screen-utils.js'
import {
  createBackground,
  createButton,
  createText
} from '../utils/ui-components.js'
import { isRecord, isSupportedSetsToPlay } from '../utils/validation.js'

/**
 * Layout schema for the setup screen.
 * Direct rendering on background with title in header and go back in footer.
 */
const SETUP_BASE_LAYOUT = createPageWithFooterButton({
  icon: 'goback-icon.png',
  footerButtonName: 'goBackButton',
  hasHeader: true,
  top: 0,
  bottom: 0,
  bodyGap: 0,
  headerHeight: '15%',
  footerHeight: '5%',
  headerRoundSafeInset: false,
  bodyRoundSafeInset: false,
  footerRoundSafeInset: false
})

const SETUP_LAYOUT = {
  sections: {
    ...SETUP_BASE_LAYOUT.sections,
    body: {
      ...SETUP_BASE_LAYOUT.sections.body,
      sideInset: '7%'
    }
  },
  elements: {
    ...SETUP_BASE_LAYOUT.elements,
    // Title text (in header section)
    title: {
      section: 'header',
      x: 'center',
      y: '30%',
      width: '100%',
      height: '50%',
      align: 'center',
      _meta: {
        type: 'text',
        style: 'pageTitle',
        text: 'setup.title'
      }
    },
    // Helper text
    helperText: {
      section: 'body',
      x: 0,
      y: '5%',
      width: '100%',
      height: '10%',
      align: 'center',
      _meta: {
        type: 'text',
        style: 'bodyLarge',
        text: 'setup.selectSetsHint',
        color: 'colors.mutedText'
      }
    },
    // Option buttons row - container for the 3 option buttons
    optionsRow: {
      section: 'body',
      x: 0,
      y: '22%',
      width: '100%',
      // height calculated in render using screen height ratio
      align: 'center',
      _meta: {
        type: 'optionsRow',
        options: MATCH_SET_OPTIONS,
        gap: '2.2%'
      }
    },
    // Start button
    startButton: {
      section: 'body',
      x: 'center',
      y: '55%',
      width: toPercentage(TOKENS.sizing.buttonWidth), // '85%' - same as index page
      // height calculated in render using screen height ratio
      align: 'center',
      _meta: {
        type: 'button',
        variant: 'primary',
        text: 'setup.startMatch',
        onClick: 'handleStartMatch'
      }
    },
    // Error message (conditional)
    errorMessage: {
      section: 'body',
      x: 0,
      y: '78%',
      width: '100%',
      height: '10%',
      align: 'center',
      _meta: {
        type: 'text',
        style: 'body',
        text: 'dynamic',
        color: 'colors.danger',
        conditional: 'hasError'
      }
    },
    // Go back button (in footer section)
    goBackButton: {
      ...SETUP_BASE_LAYOUT.elements.goBackButton,
      x: 'center',
      y: '20%',
      _meta: {
        ...SETUP_BASE_LAYOUT.elements.goBackButton._meta,
        onClick: 'navigateBack'
      }
    }
  }
}

function isValidSetsOption(setsToPlay) {
  return isSupportedSetsToPlay(setsToPlay)
}

function _isVerifiedActiveSession(matchState, setsToPlay) {
  return (
    isRecord(matchState) &&
    matchState.status === MATCH_STATUS.ACTIVE &&
    matchState.setsToPlay === setsToPlay &&
    matchState.setsNeededToWin === Math.ceil(setsToPlay / 2) &&
    typeof matchState?.timing?.startedAt === 'string'
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

  build() {
    this.renderSetupScreen()
  },

  onDestroy() {
    this.clearWidgets()
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

  handleStartMatch() {
    if (!this.isStartMatchEnabled()) {
      return false
    }

    this.isPersistingMatchState = true
    this.startErrorMessage = ''
    this.renderSetupScreen()

    let initializedMatchState = null

    try {
      initializedMatchState = initializeMatchState(this.selectedSetsToPlay)
    } catch {
      this.startErrorMessage = gettext('setup.saveFailed')
      this.isPersistingMatchState = false
      this.renderSetupScreen()
      return false
    }

    try {
      this.clearRuntimeMatchState()
    } catch {
      // Non-blocking runtime cleanup failure should not prevent navigation.
    }

    const didPersistMatchState = this.persistMatchStateForGameStart(
      initializedMatchState
    )

    if (!didPersistMatchState) {
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

    return true
  },

  persistMatchStateForGameStart(matchState) {
    try {
      clearActiveSession()
      saveActiveSession(matchState)

      const persistedMatchState = getActiveSession()

      return _isVerifiedActiveSession(
        persistedMatchState,
        this.selectedSetsToPlay
      )
    } catch {
      return false
    }
  },

  clearRuntimeMatchState() {
    const app = this.getAppInstance()

    if (!app || !isRecord(app.globalData)) {
      return
    }

    // Clear the in-memory match state to prevent stale data
    // from a previous match being used in the new game
    app.globalData.matchState = null

    // Also clear the persisted active session to ensure fresh state is loaded
    clearActiveSession()
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

      return app
    } catch {
      return null
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

  navigateBack() {
    // Navigate directly to home instead of goBack() to avoid returning to
    // game.js when setup was opened from a new-match flow (game redirects
    // back to setup when session is invalid, causing an infinite loop).
    if (typeof hmApp === 'undefined' || typeof hmApp.gotoPage !== 'function') {
      return false
    }

    try {
      hmApp.gotoPage({ url: 'page/index' })
      return true
    } catch {
      return false
    }
  },

  renderSetupScreen() {
    if (typeof hmUI === 'undefined') {
      return
    }

    const metrics = getScreenMetrics()
    const { width } = metrics
    const layout = resolveLayout(SETUP_LAYOUT, metrics)

    this.clearWidgets()

    // 1. Background
    const bg = createBackground()
    this.createWidget(bg.widgetType, bg.config)

    // 2. Title text (in header section)
    const titleEl = layout.elements.title
    const titleMeta = SETUP_LAYOUT.elements.title._meta
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

    // 3. Helper text
    const helperEl = layout.elements.helperText
    const helperMeta = SETUP_LAYOUT.elements.helperText._meta
    if (helperEl) {
      const helperConfig = createText({
        text: gettext(helperMeta.text),
        style: helperMeta.style,
        x: helperEl.x,
        y: helperEl.y,
        w: helperEl.w,
        h: helperEl.h,
        color: TOKENS.colors.mutedText
      })
      this.createWidget(helperConfig.widgetType, helperConfig.config)
    }

    // 4. Option buttons (1, 3, 5 sets) - circular buttons
    const optionsEl = layout.elements.optionsRow
    if (optionsEl) {
      const optionGap = Math.round(width * 0.022)
      const optionButtonWidth = Math.round(
        (optionsEl.w - (MATCH_SET_OPTIONS.length - 1) * optionGap) /
          MATCH_SET_OPTIONS.length
      )

      MATCH_SET_OPTIONS.forEach((setsToPlay, index) => {
        const isSelected = this.selectedSetsToPlay === setsToPlay
        const optionButtonX =
          optionsEl.x + (optionButtonWidth + optionGap) * index

        // Make buttons circular by using radius = half of width (or height)
        const circularRadius = Math.round(optionButtonWidth / 2)

        const optionBtn = createButton({
          x: optionButtonX,
          y: optionsEl.y,
          w: optionButtonWidth,
          radius: circularRadius,
          variant: isSelected ? 'primary' : 'secondary',
          text: this.getOptionLabel(setsToPlay),
          onClick: () => this.handleSelectSets(setsToPlay)
        })
        this.createWidget(optionBtn.widgetType, optionBtn.config)
      })
    }

    // 5. Start button
    const startEl = layout.elements.startButton
    const startMeta = SETUP_LAYOUT.elements.startButton._meta
    const canStartMatch = this.isStartMatchEnabled()
    if (startEl) {
      const startBtn = createButton({
        x: startEl.x,
        y: startEl.y,
        w: startEl.w,
        variant: canStartMatch ? 'primary' : 'secondary',
        text: gettext(startMeta.text),
        disabled: !canStartMatch,
        onClick: () => {
          if (!canStartMatch) {
            return false
          }
          return this.handleStartMatch()
        }
      })
      this.createWidget(startBtn.widgetType, startBtn.config)
    }

    // 6. Error message (conditional)
    if (this.startErrorMessage.length > 0) {
      const errorEl = layout.elements.errorMessage
      const errorMeta = SETUP_LAYOUT.elements.errorMessage._meta
      if (errorEl) {
        const errorConfig = createText({
          text: this.startErrorMessage,
          style: errorMeta.style,
          x: errorEl.x,
          y: errorEl.y,
          w: errorEl.w,
          h: errorEl.h,
          color: TOKENS.colors.danger
        })
        this.createWidget(errorConfig.widgetType, errorConfig.config)
      }
    }

    // 7. Go back button (in footer section)
    const goBackEl = layout.elements.goBackButton
    const goBackMeta = SETUP_LAYOUT.elements.goBackButton._meta
    if (goBackEl) {
      const goBackBtn = createButton({
        x: goBackEl.x,
        y: goBackEl.y,
        variant: 'icon',
        normal_src: goBackMeta.icon,
        onClick: () => this.navigateBack()
      })
      this.createWidget(goBackBtn.widgetType, goBackBtn.config)
    }
  }
})
