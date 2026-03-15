import { getText as gettext } from '@zos/i18n'
import * as hmUI from '@zos/ui'
import { getFontSize, TOKENS, toPercentage } from '../utils/design-tokens.js'
import {
  loadHapticFeedbackEnabled,
  saveHapticFeedbackEnabled
} from '../utils/haptic-feedback-settings.js'
import { resolveLayout } from '../utils/layout-engine.js'
import { createStandardPageLayout } from '../utils/layout-presets.js'
import { router } from '../utils/platform-adapters.js'
import { clamp, getScreenMetrics } from '../utils/screen-utils.js'
import {
  createBackground,
  createButton,
  createText
} from '../utils/ui-components.js'

const GAME_SETTINGS_LAYOUT = {
  sections: createStandardPageLayout({
    top: toPercentage(TOKENS.spacing.pageTop),
    bottom: toPercentage(TOKENS.spacing.pageBottom),
    bodyGap: toPercentage(TOKENS.spacing.sectionGap),
    headerHeight: '10%',
    footerHeight: '10%',
    headerRoundSafeInset: false,
    bodyRoundSafeInset: false,
    footerRoundSafeInset: false
  }).sections,
  elements: {
    pageTitle: {
      section: 'header',
      x: 'center',
      y: '30%',
      width: '100%',
      height: '50%',
      align: 'center',
      _meta: {
        type: 'text',
        style: 'pageTitle',
        textKey: 'gameSettings.title'
      }
    },
    goBackButton: {
      section: 'footer',
      x: 'center',
      y: 'center',
      width: TOKENS.sizing.iconLarge,
      height: TOKENS.sizing.iconLarge,
      align: 'center',
      _meta: {
        type: 'iconButton',
        icon: 'goback-icon.png',
        onClick: 'goBack'
      }
    }
  }
}

Page({
  onInit() {
    this.widgets = []
    this.hapticFeedbackEnabled = loadHapticFeedbackEnabled()
  },

  build() {
    this.renderGameSettingsScreen()
  },

  onDestroy() {
    this.clearWidgets()
  },

  clearWidgets() {
    if (typeof hmUI?.createWidget !== 'function') {
      this.widgets = []
      return
    }

    this.widgets.forEach((widget) => hmUI.deleteWidget(widget))
    this.widgets = []
  },

  createWidget(widgetType, properties) {
    if (typeof hmUI?.createWidget !== 'function') {
      return null
    }

    const widget = hmUI.createWidget(widgetType, properties)
    this.widgets.push(widget)
    return widget
  },

  normalizeSwitchValue(value) {
    return value === true || value === 1 || value === '1'
  },

  handleVibrationFeedbackChange(nextValue) {
    const enabled = this.normalizeSwitchValue(nextValue)
    this.hapticFeedbackEnabled = saveHapticFeedbackEnabled(enabled)
  },

  goBack() {
    if (router.navigateBack() !== true) {
      router.navigateTo('page/settings')
    }
  },

  renderGameSettingsScreen() {
    if (typeof hmUI?.createWidget !== 'function') {
      return
    }

    const metrics = getScreenMetrics()
    const layout = resolveLayout(GAME_SETTINGS_LAYOUT, metrics)

    this.clearWidgets()

    const bg = createBackground()
    this.createWidget(bg.widgetType, bg.config)

    const headerSection = layout.sections.header
    const titleMeta = GAME_SETTINGS_LAYOUT.elements.pageTitle._meta
    const titleConfig = createText({
      text: gettext(titleMeta.textKey),
      style: titleMeta.style,
      x: headerSection.x,
      y: headerSection.y,
      w: headerSection.w,
      h: headerSection.h,
      color: TOKENS.colors[titleMeta.color]
    })
    this.createWidget(titleConfig.widgetType, titleConfig.config)

    const bodySection = layout.sections.body
    const rowHeight = clamp(
      Math.round(metrics.width * TOKENS.typography.body * 3.5),
      88,
      88
    )
    const contentInset = Math.round(metrics.width * 0.06)
    const contentX = bodySection.x + contentInset
    const contentWidth = bodySection.w - contentInset * 2
    const padding = Math.round(metrics.width * 0.03)
    const switchWidth = Math.round(rowHeight * 0.85)
    const switchHeight = Math.round(rowHeight * 0.42)
    const labelTextSize = getFontSize('bodyLarge')
    const labelTextHeight = Math.round(labelTextSize * 1.4)
    const rowTop = bodySection.y

    const labelConfig = createText({
      text: gettext('settings.vibrationFeedback'),
      style: 'bodyLarge',
      x: contentX + padding,
      y: rowTop + Math.round((rowHeight - labelTextHeight) / 2),
      w: contentWidth - padding * 3 - switchWidth,
      h: labelTextHeight,
      color: TOKENS.colors.text
    })
    this.createWidget(labelConfig.widgetType, labelConfig.config)

    const slideSwitchWidgetType = hmUI.widget.SLIDE_SWITCH
    const switchX = contentX + contentWidth - padding - switchWidth
    const switchY = rowTop + Math.round((rowHeight - switchHeight) / 2)
    const sliderSize = switchHeight

    this.createWidget(slideSwitchWidgetType, {
      x: switchX,
      y: switchY,
      w: switchWidth,
      h: switchHeight,
      checked: this.hapticFeedbackEnabled,
      select_bg: 'switch_on.png',
      un_select_bg: 'switch_off.png',
      slide_src: 'switch_thumb.png',
      slide_select_x: switchWidth - sliderSize,
      slide_un_select_x: 0,
      checked_change_func: (_slideSwitch, checked) =>
        this.handleVibrationFeedbackChange(checked)
    })

    const goBackEl = layout.elements.goBackButton
    const goBackMeta = GAME_SETTINGS_LAYOUT.elements.goBackButton._meta

    if (goBackEl) {
      const goBackBtn = createButton({
        x: goBackEl.x,
        y: goBackEl.y,
        variant: 'icon',
        normal_src: goBackMeta.icon,
        onClick: () => this.goBack()
      })
      this.createWidget(goBackBtn.widgetType, goBackBtn.config)
    }
  }
})
