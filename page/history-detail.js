import { gettext } from 'i18n'
import { getFontSize, TOKENS, toPercentage } from '../utils/design-tokens.js'
import { resolveLayout } from '../utils/layout-engine.js'
import { createStandardPageLayout } from '../utils/layout-presets.js'
import {
  deleteMatchFromHistory,
  loadMatchById
} from '../utils/match-history-storage.js'
import { clamp, getScreenMetrics } from '../utils/screen-utils.js'
import {
  createBackground,
  createButton,
  createText
} from '../utils/ui-components.js'
import { formatDate } from '../utils/validation.js'

/**
 * Layout schema for the history detail screen.
 * Uses declarative positioning resolved by layout-engine.
 * Matches the summary page layout structure with 2 footer buttons.
 */
const HISTORY_DETAIL_LAYOUT = {
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
    // Title text ("Match Details")
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
        textKey: 'history.detail.title'
      }
    },
    datetimeText: {
      section: 'body',
      x: 0,
      y: '0%',
      width: '100%',
      height: '15%',
      align: 'center',
      _meta: {
        type: 'text',
        style: 'body',
        color: 'text',
        textKey: 'datetimeText' // Dynamic
      }
    },
    // Final score value (e.g., "2-1")
    scoreValue: {
      section: 'body',
      x: 0,
      y: '25%',
      width: '100%',
      height: '12%',
      align: 'center',
      _meta: {
        type: 'text',
        style: 'score',
        color: 'accent',
        textKey: 'finalSetsScore' // Dynamic
      }
    },
    // Delete button (left side of footer)
    deleteButton: {
      section: 'footer',

      x: '35%',
      y: 'center',
      width: TOKENS.sizing.iconLarge,
      height: TOKENS.sizing.iconLarge,
      _meta: {
        type: 'iconButton',
        icon: 'delete-icon.png',
        confirmIcon: 'remove-icon.png',
        onClick: 'handleDeleteClick'
      }
    },
    // Go back button (right side of footer)
    goBackButton: {
      section: 'footer',
      x: '55%',
      y: 'center',
      width: TOKENS.sizing.iconLarge,
      height: TOKENS.sizing.iconLarge,
      _meta: {
        type: 'iconButton',
        icon: 'goback-icon.png',
        onClick: 'goBack'
      }
    }
  }
}

Page({
  onInit(params) {
    this.widgets = []
    this.matchEntry = null
    this.deleteConfirmMode = false
    this.confirmTimeout = null
    this.deleteButton = null
    this.parseParams(params)
    // Render screen after loading data (v1.0 compatible - no onShow)
    this.renderDetailScreen()
  },

  build() {
    // Don't re-render in build() - onInit already rendered
  },

  onDestroy() {
    if (this.confirmTimeout) {
      clearTimeout(this.confirmTimeout)
      this.confirmTimeout = null
    }
    this.deleteButton = null
    this.clearWidgets()
  },

  parseParams(params) {
    // Zepp OS v1.0: params is passed directly from gotoPage 'param' property
    if (!params) {
      return
    }

    let matchId = null

    // Check if params looks like a query string (contains '=' or '?')
    if (
      typeof params === 'string' &&
      (params.includes('=') || params.includes('?'))
    ) {
      // Parse query string format
      const queryString = params.split('?').pop() || params
      const pairs = queryString.split('&')

      for (let i = 0; i < pairs.length; i += 1) {
        const pair = pairs[i].split('=')
        if (pair[0] === 'id' && pair.length > 1) {
          matchId = decodeURIComponent(pair[1])
          break
        }
      }
    } else {
      // params IS the matchId directly
      matchId = params
    }

    if (matchId) {
      try {
        this.matchEntry = loadMatchById(matchId)
      } catch {
        this.matchEntry = null
      }
    }
  },

  clearWidgets() {
    if (typeof hmUI === 'undefined') {
      this.widgets = []
      this.deleteButton = null
      return
    }

    this.widgets.forEach((widget) => hmUI.deleteWidget(widget))
    this.widgets = []
    this.deleteButton = null
  },

  createWidget(widgetType, properties) {
    if (typeof hmUI === 'undefined') {
      return null
    }

    const widget = hmUI.createWidget(widgetType, properties)
    this.widgets.push(widget)
    return widget
  },

  goBack() {
    if (typeof hmApp === 'undefined' || typeof hmApp.goBack !== 'function') {
      return
    }

    try {
      hmApp.goBack()
    } catch {
      // Ignore navigation errors
    }
  },

  handleDeleteClick() {
    if (!this.matchEntry) return

    if (this.deleteConfirmMode) {
      // Second tap - execute deletion
      this.deleteConfirmMode = false
      if (this.confirmTimeout) {
        clearTimeout(this.confirmTimeout)
        this.confirmTimeout = null
      }

      // Perform deletion
      const success = deleteMatchFromHistory(this.matchEntry.id)

      if (success) {
        // Navigate back to history list
        this.goBack()
      } else {
        // If failed, just reset the icon
        this.updateDeleteButtonIcon(false)
      }
    } else {
      // First tap - enter confirm mode
      this.deleteConfirmMode = true
      this.updateDeleteButtonIcon(true)

      // Show toast
      hmUI.showToast({ text: gettext('history.deleteConfirmToast') })

      // Auto-reset after 3 seconds
      this.confirmTimeout = setTimeout(() => {
        this.deleteConfirmMode = false
        this.confirmTimeout = null
        this.updateDeleteButtonIcon(false)
      }, 3000)
    }
  },

  updateDeleteButtonIcon(isConfirmMode) {
    if (typeof hmUI === 'undefined') return

    const metrics = getScreenMetrics()
    const layout = resolveLayout(HISTORY_DETAIL_LAYOUT, metrics)

    // Get button position from layout
    const deleteEl = layout.elements.deleteButton
    if (!deleteEl) return

    // Delete old button
    if (this.deleteButton) {
      hmUI.deleteWidget(this.deleteButton)
      this.deleteButton = null
    }

    // Create new button with updated icon
    const deleteMeta = HISTORY_DETAIL_LAYOUT.elements.deleteButton._meta
    this.deleteButton = hmUI.createWidget(hmUI.widget.BUTTON, {
      x: deleteEl.x,
      y: deleteEl.y,
      w: deleteEl.w,
      h: deleteEl.h,
      normal_src: isConfirmMode ? deleteMeta.confirmIcon : deleteMeta.icon,
      press_src: isConfirmMode ? deleteMeta.confirmIcon : deleteMeta.icon,
      click_func: () => this.handleDeleteClick()
    })
  },

  renderDetailScreen() {
    if (typeof hmUI === 'undefined') {
      return
    }

    // Get screen metrics and resolve layout
    const metrics = getScreenMetrics()
    const layout = resolveLayout(HISTORY_DETAIL_LAYOUT, metrics)

    // Create view model from match entry
    const viewModel = this.createDetailViewModel()

    this.clearWidgets()

    // ── Background ────────────────────────────────────────────────────────
    const bg = createBackground()
    this.createWidget(bg.widgetType, bg.config)

    // ── Header Section ─────────────────────────────────────────────────────
    this.renderHeaderSection(layout)

    // ── Body Section (Winner, Score, Set History) ──────────────────────────
    this.renderBodySection(layout, viewModel, metrics)

    // ── Footer Section ─────────────────────────────────────────────────────
    this.renderFooterSection(layout)
  },

  /**
   * Creates a view model from the match entry for rendering.
   */
  createDetailViewModel() {
    if (!this.matchEntry) {
      return {
        datetimeText: gettext('history.detail.notFound'),
        finalSetsScore: '',
        historyLines: []
      }
    }

    const datetimeText = formatDate(this.matchEntry)

    const historyLines =
      this.matchEntry.setHistory && this.matchEntry.setHistory.length > 0
        ? this.matchEntry.setHistory.map(
            (set) => `Set ${set.setNumber}: ${set.teamAGames}-${set.teamBGames}`
          )
        : [gettext('summary.noSetHistory')]

    return {
      datetimeText,
      finalSetsScore: `${this.matchEntry.setsWonTeamA}-${this.matchEntry.setsWonTeamB}`,
      historyLines
    }
  },

  /**
   * Renders the header section with title only.
   */
  renderHeaderSection(layout) {
    const headerSection = layout.sections.header
    const elements = HISTORY_DETAIL_LAYOUT.elements

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
  },

  /**
   * Renders the body section with winner text, score, and set history scroll list.
   */
  renderBodySection(layout, viewModel, metrics) {
    const bodySection = layout.sections.body
    const elements = HISTORY_DETAIL_LAYOUT.elements

    // Datetime text (dynamic)
    const datetimeMeta = elements.datetimeText._meta
    const datetimeHeight = Math.round(bodySection.h * 0.12)
    const datetimeConfig = createText({
      text: viewModel.datetimeText,
      style: datetimeMeta.style,
      x: bodySection.x,
      y: bodySection.y,
      w: bodySection.w,
      h: datetimeHeight,
      color: TOKENS.colors[datetimeMeta.color]
    })
    this.createWidget(datetimeConfig.widgetType, datetimeConfig.config)

    // Score value (dynamic)
    const scoreValueMeta = elements.scoreValue._meta
    const scoreValueHeight = Math.round(bodySection.h * 0.2)
    const scoreValueY = bodySection.y + datetimeHeight
    const scoreValueConfig = createText({
      text: viewModel.finalSetsScore,
      style: scoreValueMeta.style,
      x: bodySection.x,
      y: scoreValueY,
      w: bodySection.w,
      h: scoreValueHeight,
      color: TOKENS.colors[scoreValueMeta.color]
    })
    this.createWidget(scoreValueConfig.widgetType, scoreValueConfig.config)

    // SCROLL_LIST for set history
    // Calculate bounds within the body section (below winner and score)
    const historyBodyY =
      scoreValueY + scoreValueHeight + Math.round(TOKENS.spacing.sectionGap * 5)
    const historyRowHeight = clamp(
      Math.round(metrics.width * TOKENS.typography.body * 2.2),
      28,
      56
    )

    // Build data array for SCROLL_LIST
    const scrollDataArray = viewModel.historyLines.map((line) => ({ line }))

    // Create SCROLL_LIST widget
    this.createWidget(hmUI.widget.SCROLL_LIST, {
      x: bodySection.x,
      y: historyBodyY,
      w: bodySection.w,
      h: historyRowHeight * 3,
      item_space: 0,
      item_config: [
        {
          type_id: 1,
          item_height: historyRowHeight,
          item_bg_color: TOKENS.colors.cardBackground,
          item_bg_radius: 0,
          text_view: [
            {
              x: 0,
              y: 0,
              w: bodySection.w,
              h: historyRowHeight,
              key: 'line',
              color: TOKENS.colors.text,
              text_size: getFontSize('bodyLarge')
            }
          ],
          text_view_count: 1
        }
      ],
      item_config_count: 1,
      data_array: scrollDataArray,
      data_count: scrollDataArray.length
    })
  },

  /**
   * Renders the footer section with delete and go back buttons side by side.
   */
  renderFooterSection(layout) {
    const elements = HISTORY_DETAIL_LAYOUT.elements

    // Delete button (left side)
    const deleteEl = layout.elements.deleteButton
    const deleteMeta = elements.deleteButton._meta
    if (deleteEl) {
      this.deleteButton = this.createWidget(hmUI.widget.BUTTON, {
        x: deleteEl.x,
        y: deleteEl.y,
        w: deleteEl.w,
        h: deleteEl.h,
        normal_src: deleteMeta.icon,
        press_src: deleteMeta.icon,
        click_func: () => this.handleDeleteClick()
      })
    }

    // Go back button (right side)
    const goBackEl = layout.elements.goBackButton
    const goBackMeta = elements.goBackButton._meta
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
