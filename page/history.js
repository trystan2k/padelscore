import { getText as gettext } from '@zos/i18n'
import * as hmUI from '@zos/ui'
import { getFontSize, TOKENS, toPercentage } from '../utils/design-tokens.js'
import { resolveLayout } from '../utils/layout-engine.js'
import { createStandardPageLayout } from '../utils/layout-presets.js'
import { loadMatchHistory } from '../utils/match-history-storage.js'
import { router } from '../utils/platform-adapters.js'
import { clamp, getScreenMetrics } from '../utils/screen-utils.js'
import {
  createBackground,
  createButton,
  createText
} from '../utils/ui-components.js'
import { formatDate } from '../utils/validation.js'

/**
 * Layout schema for the history screen.
 * Uses declarative positioning resolved by layout-engine.
 * Matches the summary page layout structure.
 */
const HISTORY_LAYOUT = {
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
    // Title text ("Match History")
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
        textKey: 'history.title'
      }
    },
    // History scroll list (in body section)
    scrollListCard: {
      section: 'body',
      x: 0,
      y: 0,
      width: '100%',
      height: '100%',
      align: 'center',
      _meta: {
        type: 'card'
      }
    },
    // Empty state when no history
    emptyState: {
      section: 'body',
      x: 0,
      y: 0,
      width: '100%',
      height: '100%',
      align: 'center',
      _meta: {
        type: 'text',
        style: 'body',
        textKey: 'history.empty',
        color: TOKENS.colors.mutedText,
        conditional: 'isEmpty'
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
        onClick: 'goBack'
      }
    }
  }
}

Page({
  onInit(_params) {
    this.widgets = []
    this.historyEntries = []
    this.scrollList = null

    // Load history data during init
    try {
      this.historyEntries = loadMatchHistory()
    } catch {
      this.historyEntries = []
    }
  },

  build() {
    this.renderHistoryScreen()
  },

  onDestroy() {
    this.clearWidgets()
  },

  clearWidgets() {
    if (typeof hmUI?.createWidget !== 'function') {
      this.widgets = []
      this.scrollList = null
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

  refreshHistory() {
    try {
      this.historyEntries = loadMatchHistory()
    } catch {
      this.historyEntries = []
    }

    this.renderHistoryScreen()
  },

  goBack() {
    router.navigateBack()
  },

  navigateToHistoryDetail(matchId) {
    if (!matchId) {
      return
    }

    router.navigateTo('page/history-detail', { id: matchId })
  },

  handleHistoryItemClick(index) {
    const entry = this.historyEntries[index]
    if (entry?.id) {
      this.navigateToHistoryDetail(entry.id)
    }
  },

  renderHistoryScreen() {
    if (typeof hmUI?.createWidget !== 'function') {
      return
    }

    const metrics = getScreenMetrics()
    const layout = resolveLayout(HISTORY_LAYOUT, metrics)

    this.clearWidgets()

    // ── Background ────────────────────────────────────────────────────────
    const bg = createBackground()
    this.createWidget(bg.widgetType, bg.config)

    // ── Header Section ─────────────────────────────────────────────────────
    const headerSection = layout.sections.header
    const elements = HISTORY_LAYOUT.elements

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

    // ── Body Section (History List) ────────────────────────────────────────
    const listEl = layout.elements.scrollListCard

    if (this.historyEntries.length === 0) {
      // Empty state
      const emptyMeta = HISTORY_LAYOUT.elements.emptyState._meta
      const emptyConfig = createText({
        text: gettext(emptyMeta.textKey),
        style: emptyMeta.style,
        x: listEl.x,
        y: listEl.y,
        w: listEl.w,
        h: listEl.h,
        color: emptyMeta.color
      })
      this.createWidget(emptyConfig.widgetType, emptyConfig.config)
    } else {
      // Calculate row height matching summary.js pattern
      const rowHeight = clamp(
        Math.round(metrics.width * TOKENS.typography.body * 3.5),
        88,
        88
      )

      // Font sizes
      const dateTextSize = getFontSize('body')
      const scoreTextSize = Math.round(getFontSize('score') * 0.8)

      // Icon sizing (fixed 48px)
      const iconSize = TOKENS.sizing.iconLarge
      const iconX = listEl.w - Math.round(iconSize * 1.8)
      const iconY = Math.round((rowHeight - iconSize) / 2)

      // Text positioning (same Y and H as icon for centering)
      const textY = iconY
      const textH = iconSize
      const dateX = Math.round(metrics.width * 0.1)
      const dateWidth = Math.round(listEl.w * 0.45)
      const scoreX = Math.round(listEl.w * 0.5)
      const scoreWidth = iconX - Math.round(scoreX * 0.8)

      // Build data array
      const scrollDataArray = this.historyEntries.map((entry) => ({
        date: formatDate(entry),
        score: `${entry.setsWonTeamA}-${entry.setsWonTeamB}`,
        icon: 'chevron-icon.png'
      }))

      // Single item config
      const itemConfig = {
        type_id: 1,
        item_height: rowHeight,
        item_bg_color: TOKENS.colors.background,
        item_bg_radius: 0,
        text_view: [
          {
            x: dateX,
            y: Math.round(textY * 1.05),
            w: dateWidth,
            h: textH,
            key: 'date',
            color: TOKENS.colors.text,
            text_size: dateTextSize,
            action: true
          },
          {
            x: scoreX,
            y: Math.round(textY * 0.8),
            w: scoreWidth,
            h: textH,
            key: 'score',
            color: TOKENS.colors.accent,
            text_size: scoreTextSize,
            action: true
          }
        ],
        text_view_count: 2,
        image_view: [
          {
            x: iconX,
            y: iconY,
            w: iconSize,
            h: iconSize,
            key: 'icon',
            action: true
          }
        ],
        image_view_count: 1
      }

      // Create scroll list
      this.scrollList = this.createWidget(hmUI.widget.SCROLL_LIST, {
        x: listEl.x,
        y: listEl.y,
        w: listEl.w,
        h: rowHeight * 3,
        item_space: 0,
        item_config: [itemConfig],
        item_config_count: 1,
        data_array: scrollDataArray,
        data_count: scrollDataArray.length,
        item_click_func: (_list, index) => {
          this.handleHistoryItemClick(index)
        }
      })
    }

    // ── Footer Section ─────────────────────────────────────────────────────
    const goBackEl = layout.elements.goBackButton
    const goBackMeta = HISTORY_LAYOUT.elements.goBackButton._meta
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
