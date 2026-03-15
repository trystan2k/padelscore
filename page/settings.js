import { getText as gettext } from '@zos/i18n'
import * as hmUI from '@zos/ui'
import { clearAllAppData } from '../utils/app-data-clear.js'
import { queueHomeFeedbackMessage } from '../utils/app-feedback.js'
import { getFontSize, TOKENS, toPercentage } from '../utils/design-tokens.js'
import { resolveLayout } from '../utils/layout-engine.js'
import { createStandardPageLayout } from '../utils/layout-presets.js'
import { router, toast } from '../utils/platform-adapters.js'
import { clamp, getScreenMetrics } from '../utils/screen-utils.js'
import {
  createBackground,
  createButton,
  createText
} from '../utils/ui-components.js'
import { APP_VERSION } from '../utils/version.js'

/**
 * Layout schema for the settings screen.
 * Uses declarative positioning resolved by layout-engine.
 * Matches the summary page layout structure.
 */
const SETTINGS_LAYOUT = {
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
    // Title text ("Settings")
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
        textKey: 'settings.title'
      }
    },
    // Settings scroll list (in body section)
    scrollList: {
      section: 'body',
      x: 0,
      y: 0,
      width: '100%',
      height: '100%',
      align: 'center',
      _meta: {
        type: 'scrollList'
      }
    },
    // Go back button (centered in footer)
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
        onClick: 'navigateToHomePage'
      }
    }
  }
}

Page({
  onInit() {
    this.widgets = []
    this.scrollList = null
    this.clearConfirmMode = false
  },

  build() {
    this.renderSettingsScreen()
  },

  onDestroy() {
    this.clearConfirmMode = false
    this.clearWidgets()
  },

  clearWidgets() {
    if (typeof hmUI?.createWidget !== 'function') {
      this.widgets = []
      return
    }

    this.widgets.forEach((widget) => hmUI.deleteWidget(widget))
    this.widgets = []
    this.scrollList = null
  },

  createWidget(widgetType, properties) {
    if (typeof hmUI?.createWidget !== 'function') {
      return null
    }

    const widget = hmUI.createWidget(widgetType, properties)
    this.widgets.push(widget)
    return widget
  },

  navigateToHistoryPage() {
    router.navigateTo('page/history')
  },

  navigateToHomePage() {
    router.redirectTo('page/index')
  },

  navigateToGameSettingsPage() {
    router.navigateTo('page/game-settings')
  },

  resetClearConfirmMode() {
    if (!this.clearConfirmMode) {
      return false
    }

    this.clearConfirmMode = false
    this.updateListData(false)

    return true
  },

  // type_id 1 = normal, type_id 2 = danger (red), type_id 3 = version (muted)
  updateListData(confirmMode) {
    if (!this.scrollList) return

    this.scrollList.setProperty(hmUI.prop.UPDATE_DATA, {
      data_type_config: [
        { start: 0, end: 0, type_id: 1 },
        { start: 1, end: 1, type_id: 1 },
        { start: 2, end: 2, type_id: confirmMode ? 2 : 1 },
        { start: 3, end: 3, type_id: 3 }
      ],
      data_type_config_count: 4,
      data_array: [
        {
          label: gettext('settings.previousMatches'),
          icon: 'chevron-icon.png'
        },
        {
          label: gettext('settings.gameSettings'),
          icon: 'chevron-icon.png'
        },
        {
          label: confirmMode
            ? gettext('settings.clearDataConfirm')
            : gettext('settings.clearAppData'),
          icon: 'delete-icon.png'
        },
        {
          version: `${gettext('settings.version')} ${APP_VERSION}`
        }
      ],
      data_count: 4,
      on_page: 1
    })
  },

  handleListItemClick(index) {
    if (this.clearConfirmMode && index !== 2) {
      this.resetClearConfirmMode()
    }

    if (index === 0) {
      this.navigateToHistoryPage()
    } else if (index === 1) {
      this.navigateToGameSettingsPage()
    } else if (index === 2) {
      if (this.clearConfirmMode) {
        this.resetClearConfirmMode()
        const success = clearAllAppData()

        if (success) {
          queueHomeFeedbackMessage('settings.dataCleared')
          this.navigateToHomePage()
        } else {
          toast.showToast(gettext('settings.clearFailed'))
        }
      } else {
        this.clearConfirmMode = true
        this.updateListData(true)
      }
    }
    // index === 3 is version item - do nothing (non-clickable)
  },

  renderSettingsScreen() {
    if (typeof hmUI?.createWidget !== 'function') {
      return
    }

    const metrics = getScreenMetrics()
    const layout = resolveLayout(SETTINGS_LAYOUT, metrics)

    this.clearWidgets()

    // ── Background ────────────────────────────────────────────────────────
    const bg = createBackground()
    this.createWidget(bg.widgetType, bg.config)

    // ── Header Section ─────────────────────────────────────────────────────
    const headerSection = layout.sections.header
    const elements = SETTINGS_LAYOUT.elements

    const titleMeta = elements.pageTitle._meta
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

    // ── Body Section (Scroll List) ─────────────────────────────────────────
    const listEl = layout.elements.scrollList
    if (listEl) {
      // Calculate row height matching summary.js pattern (doubled for better touch targets)
      const rowHeight = clamp(
        Math.round(metrics.width * TOKENS.typography.body * 3.5),
        88,
        88
      )

      // Text sizing
      const itemTextSize = getFontSize('bodyLarge')
      const versionTextSize = getFontSize('sectionTitle')
      const textH = Math.round(itemTextSize * 1.4)
      const textY = Math.round((rowHeight - textH) / 2)
      const padding = Math.round(metrics.width * 0.02)
      // Icon sizing
      const iconSize = TOKENS.sizing.iconLarge

      // Text positioning (starts from left, limited width)
      const textX = padding
      const textW = Math.round(listEl.w * 0.75)

      // Icon positioning (immediately after text, not at far right edge)
      const iconX = textX + textW + padding
      const iconY = Math.round((rowHeight - iconSize) / 2)

      // Version text (centered, smaller)
      const versionTextH = Math.round(versionTextSize * 1.4)
      const versionTextY = Math.round((rowHeight - versionTextH) / 2)
      const scrollListHeight = Math.min(rowHeight * 3, listEl.h)

      // Item configs: type_id 1 = normal, type_id 2 = danger (red), type_id 3 = version (muted)
      const itemConfigNormal = {
        type_id: 1,
        item_height: rowHeight,
        item_bg_color: TOKENS.colors.background,
        item_bg_radius: 0,
        text_view: [
          {
            x: textX,
            y: Math.round(textY * 0.9),
            w: textW,
            h: textH,
            key: 'label',
            color: TOKENS.colors.text,
            text_size: itemTextSize
          }
        ],
        text_view_count: 1,
        image_view: [
          { x: iconX, y: iconY, w: iconSize, h: iconSize, key: 'icon' }
        ],
        image_view_count: 1
      }

      const itemConfigDanger = {
        type_id: 2,
        item_height: rowHeight,
        item_bg_color: TOKENS.colors.background,
        item_bg_radius: 0,
        text_view: [
          {
            x: textX,
            y: Math.round(textY * 0.85),
            w: textW,
            h: textH,
            key: 'label',
            color: TOKENS.colors.danger,
            text_size: itemTextSize
          }
        ],
        text_view_count: 1,
        image_view: [
          { x: iconX, y: iconY, w: iconSize, h: iconSize, key: 'icon' }
        ],
        image_view_count: 1
      }

      const itemConfigVersion = {
        type_id: 3,
        item_height: rowHeight,
        item_bg_color: TOKENS.colors.background,
        item_bg_radius: 0,
        text_view: [
          {
            x: 0,
            y: versionTextY,
            w: listEl.w,
            h: versionTextH,
            key: 'version',
            color: TOKENS.colors.mutedText,
            text_size: versionTextSize
          }
        ],
        text_view_count: 1,
        image_view: [],
        image_view_count: 0
      }

      // Create scroll list
      this.scrollList = this.createWidget(hmUI.widget.SCROLL_LIST, {
        x: listEl.x,
        y: listEl.y,
        w: listEl.w,
        h: scrollListHeight,
        item_space: 0,
        item_config: [itemConfigNormal, itemConfigDanger, itemConfigVersion],
        item_config_count: 3,
        data_array: [
          {
            label: gettext('settings.previousMatches'),
            icon: 'chevron-icon.png'
          },
          { label: gettext('settings.gameSettings'), icon: 'chevron-icon.png' },
          { label: gettext('settings.clearAppData'), icon: 'delete-icon.png' },
          { version: `${gettext('settings.version')} ${APP_VERSION}` }
        ],
        data_count: 4,
        item_click_func: (_list, index) => {
          this.handleListItemClick(index)
        },
        data_type_config: [
          { start: 0, end: 0, type_id: 1 },
          { start: 1, end: 1, type_id: 1 },
          { start: 2, end: 2, type_id: 1 },
          { start: 3, end: 3, type_id: 3 }
        ],
        data_type_config_count: 4
      })
    }

    // ── Footer Section ─────────────────────────────────────────────────────
    const goBackEl = layout.elements.goBackButton
    const goBackMeta = SETTINGS_LAYOUT.elements.goBackButton._meta
    if (goBackEl) {
      const goBackBtn = createButton({
        x: goBackEl.x,
        y: goBackEl.y,
        variant: 'icon',
        normal_src: goBackMeta.icon,
        onClick: () => this.navigateToHomePage()
      })
      this.createWidget(goBackBtn.widgetType, goBackBtn.config)
    }
  }
})
