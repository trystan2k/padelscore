import * as hmUI from '@zos/ui'
import { getFontSize, TOKENS, toPercentage } from '../../utils/design-tokens.js'
import { resolveLayout } from '../../utils/layout-engine.js'
import { createScorePageLayout } from '../../utils/layout-presets.js'
import { getScreenMetrics } from '../../utils/screen-utils.js'
import {
  createBackground,
  createButton,
  createDivider,
  createText
} from '../../utils/ui-components.js'
import { createScoreViewModel } from '../score-view-model.js'

export const FOOTER_ICON_BUTTON_OFFSET = 36

/**
 * Layout schema for the game screen.
 * Uses declarative positioning resolved by layout-engine.
 * Two-column layout: Team A (left) | Team B (right)
 */
export const GAME_LAYOUT = {
  sections: createScorePageLayout({
    headerTop: toPercentage(TOKENS.spacing.headerTop),
    headerHeight: '15%',
    scoreAreaGap: toPercentage(TOKENS.spacing.headerToContent),
    footerBottom: toPercentage(TOKENS.spacing.footerBottom),
    footerHeight: '5%',
    headerRoundSafeInset: false,
    scoreAreaRoundSafeInset: false,
    footerRoundSafeInset: false
  }).sections,
  elements: {
    // Header elements: SETS row
    setsLabel: {
      section: 'header',
      x: '5%',
      y: '0%',
      width: '42%',
      height: '50%',
      align: 'left',
      _meta: { type: 'text', style: 'body', colorKey: 'mutedText' }
    },
    setsValue: {
      section: 'header',
      x: '48%',
      y: '0%',
      width: '52%',
      height: '50%',
      align: 'left',
      _meta: { type: 'text', style: 'body', colorKey: 'accent' }
    },
    // Header elements: GAMES row
    gamesLabel: {
      section: 'header',
      x: '5%',
      y: '50%',
      width: '42%',
      height: '50%',
      align: 'left',
      _meta: { type: 'text', style: 'body', colorKey: 'mutedText' }
    },
    gamesValue: {
      section: 'header',
      x: '48%',
      y: '50%',
      width: '52%',
      height: '50%',
      align: 'left',
      _meta: { type: 'text', style: 'body', colorKey: 'accent' }
    },
    // Score area: Team labels
    teamALabel: {
      section: 'scoreArea',
      x: '0%',
      y: '0%',
      width: '50%',
      height: '10%',
      align: 'left',
      _meta: { type: 'text', style: 'body', colorKey: 'mutedText', text: 'A' }
    },
    teamBLabel: {
      section: 'scoreArea',
      x: '50%',
      y: '0%',
      width: '50%',
      height: '10%',
      align: 'left',
      _meta: { type: 'text', style: 'body', colorKey: 'mutedText', text: 'B' }
    },
    // Score area: Score buttons (large tappable area)
    teamAScore: {
      section: 'scoreArea',
      x: '0%',
      y: '10%',
      width: '50%',
      height: '50%',
      align: 'left',
      _meta: { type: 'scoreButton', team: 'teamA' }
    },
    teamBScore: {
      section: 'scoreArea',
      x: '50%',
      y: '10%',
      width: '50%',
      height: '50%',
      align: 'left',
      _meta: { type: 'scoreButton', team: 'teamB' }
    },
    // Score area: Vertical divider
    divider: {
      section: 'scoreArea',
      x: 'center',
      y: '5%',
      width: 1,
      height: '55%',
      _meta: { type: 'divider', orientation: 'vertical' }
    },
    // Score area: Minus buttons
    teamAMinus: {
      section: 'scoreArea',
      x: '5%',
      y: '65%',
      width: '20%',
      height: '13%',
      align: 'center',
      _meta: { type: 'minusButton', team: 'teamA' }
    },
    teamBMinus: {
      section: 'scoreArea',
      x: '75%',
      y: '65%',
      width: '20%',
      height: '13%',
      align: 'center',
      _meta: { type: 'minusButton', team: 'teamB' }
    },
    // Footer: Home button
    homeButton: {
      section: 'footer',
      x: 'center',
      y: 'center',
      width: TOKENS.sizing.iconLarge,
      height: TOKENS.sizing.iconLarge,
      align: 'center',
      _meta: {
        type: 'iconButton',
        icon: 'home-icon.png',
        onClick: 'handleBackToHome'
      }
    },
    // Footer: Manual finish button
    confirmFinishButton: {
      section: 'footer',
      x: 'center',
      y: 'center',
      width: TOKENS.sizing.iconLarge,
      height: TOKENS.sizing.iconLarge,
      align: 'center',
      _meta: {
        type: 'iconButton',
        icon: 'coach-icon.png',
        confirmIcon: 'whistle-icon.png',
        onClick: 'handleManualFinish'
      }
    }
  }
}

export function clearWidgets(widgets) {
  if (typeof hmUI?.createWidget !== 'function' || !Array.isArray(widgets)) {
    return []
  }

  widgets.forEach((widget) => hmUI.deleteWidget(widget))
  return []
}

export function createWidget(widgets, widgetType, properties) {
  if (typeof hmUI?.createWidget !== 'function' || !Array.isArray(widgets)) {
    return null
  }

  const widget = hmUI.createWidget(widgetType, properties)
  widgets.push(widget)
  return widget
}

function noop() {}

function resolveGettext(options = {}) {
  return typeof options.gettext === 'function' ? options.gettext : (key) => key
}

function resolveCreateWidget(options = {}) {
  return typeof options.createWidget === 'function'
    ? options.createWidget
    : noop
}

export function renderGameScreen(options = {}) {
  if (typeof hmUI?.createWidget !== 'function') {
    return
  }

  const matchState = options.runtimeMatchState
  const viewModel = createScoreViewModel(matchState, {
    persistedMatchState: options.persistedMatchState
  })
  const isMatchFinished = viewModel.status === 'finished'
  const metrics = getScreenMetrics()
  const layout = resolveLayout(GAME_LAYOUT, metrics)

  if (typeof options.clearWidgets === 'function') {
    options.clearWidgets()
  }

  const createWidgetCallback = resolveCreateWidget(options)
  const bg = createBackground()
  createWidgetCallback(bg.widgetType, bg.config)

  renderHeaderElements(layout, viewModel, {
    createWidget: createWidgetCallback,
    gettext: resolveGettext(options)
  })

  if (isMatchFinished) {
    if (typeof options.onMatchFinished === 'function') {
      options.onMatchFinished()
    }
    return
  }

  renderActiveState(layout, viewModel, {
    createWidget: createWidgetCallback,
    onAddPointForTeam: options.onAddPointForTeam,
    onRemovePointForTeam: options.onRemovePointForTeam,
    onTriggerHapticFeedback: options.onTriggerHapticFeedback
  })

  renderFooterElements(layout, {
    createWidget: createWidgetCallback,
    manualFinishConfirmMode: options.manualFinishConfirmMode,
    onBackToHome: options.onBackToHome,
    onManualFinishTap: options.onManualFinishTap
  })
}

export function renderHeaderElements(layout, viewModel, options = {}) {
  const headerSection = layout.sections.header
  if (!headerSection) {
    return
  }

  const localize = resolveGettext(options)
  const createWidgetCallback = resolveCreateWidget(options)

  const labelWidth = Math.round(headerSection.w * 0.42)
  const valueWidth = Math.round(headerSection.w * 0.52)
  const rowHeight = Math.round(headerSection.h / 2)
  const pairX =
    headerSection.x +
    Math.round((headerSection.w - (labelWidth + valueWidth)) / 2)
  const valueX = pairX + labelWidth

  const setsLabelConfig = createText({
    text: localize('game.setsLabel'),
    style: 'body',
    x: pairX,
    y: headerSection.y,
    w: labelWidth,
    h: rowHeight,
    color: TOKENS.colors.mutedText,
    align_h: hmUI.align.RIGHT,
    align_v: hmUI.align.CENTER_V
  })
  createWidgetCallback(setsLabelConfig.widgetType, setsLabelConfig.config)

  const setsValueConfig = createText({
    text: `  ${viewModel.setsWon.teamA} – ${viewModel.setsWon.teamB}`,
    style: 'bodyLarge',
    x: valueX,
    y: headerSection.y,
    w: valueWidth,
    h: rowHeight,
    color: TOKENS.colors.accent,
    align_h: hmUI.align.LEFT,
    align_v: hmUI.align.CENTER_V
  })
  createWidgetCallback(setsValueConfig.widgetType, setsValueConfig.config)

  const gamesLabelConfig = createText({
    text: localize('game.gamesLabel'),
    style: 'body',
    x: pairX,
    y: headerSection.y + rowHeight,
    w: labelWidth,
    h: rowHeight,
    color: TOKENS.colors.mutedText,
    align_h: hmUI.align.RIGHT,
    align_v: hmUI.align.CENTER_V
  })
  createWidgetCallback(gamesLabelConfig.widgetType, gamesLabelConfig.config)

  const gamesValueConfig = createText({
    text: `  ${viewModel.currentSetGames.teamA} – ${viewModel.currentSetGames.teamB}`,
    style: 'bodyLarge',
    x: valueX,
    y: headerSection.y + rowHeight,
    w: valueWidth,
    h: rowHeight,
    color: TOKENS.colors.accent,
    align_h: hmUI.align.LEFT,
    align_v: hmUI.align.CENTER_V
  })
  createWidgetCallback(gamesValueConfig.widgetType, gamesValueConfig.config)
}

export function renderActiveState(layout, viewModel, options = {}) {
  const scoreArea = layout.sections.scoreArea
  if (!scoreArea) {
    return
  }

  const createWidgetCallback = resolveCreateWidget(options)
  const { width } = getScreenMetrics()
  const halfWidth = Math.round(width / 2)

  const teamALabelEl = layout.elements.teamALabel
  if (teamALabelEl) {
    const teamALabelConfig = createText({
      text: 'A',
      style: 'body',
      x: teamALabelEl.x,
      y: teamALabelEl.y,
      w: teamALabelEl.w,
      h: teamALabelEl.h,
      color: TOKENS.colors.mutedText,
      align_h: hmUI.align.CENTER_H
    })
    createWidgetCallback(teamALabelConfig.widgetType, teamALabelConfig.config)
  }

  const teamBLabelEl = layout.elements.teamBLabel
  if (teamBLabelEl) {
    const teamBLabelConfig = createText({
      text: 'B',
      style: 'body',
      x: teamBLabelEl.x,
      y: teamBLabelEl.y,
      w: teamBLabelEl.w,
      h: teamBLabelEl.h,
      color: TOKENS.colors.mutedText,
      align_h: hmUI.align.CENTER_H
    })
    createWidgetCallback(teamBLabelConfig.widgetType, teamBLabelConfig.config)
  }

  const teamAScoreEl = layout.elements.teamAScore
  if (teamAScoreEl) {
    renderScoreButton(teamAScoreEl, viewModel.teamA.points, 'teamA', {
      createWidget: createWidgetCallback,
      onAddPointForTeam: options.onAddPointForTeam,
      onTriggerHapticFeedback: options.onTriggerHapticFeedback
    })
  }

  const teamBScoreEl = layout.elements.teamBScore
  if (teamBScoreEl) {
    renderScoreButton(teamBScoreEl, viewModel.teamB.points, 'teamB', {
      createWidget: createWidgetCallback,
      onAddPointForTeam: options.onAddPointForTeam,
      onTriggerHapticFeedback: options.onTriggerHapticFeedback
    })
  }

  const dividerEl = layout.elements.divider
  if (dividerEl) {
    const dividerConfig = createDivider({
      x: Math.round(width / 2) - 1,
      y: dividerEl.y,
      h: dividerEl.h,
      orientation: 'vertical',
      color: TOKENS.colors.divider
    })
    createWidgetCallback(dividerConfig.widgetType, dividerConfig.config)
  }

  const teamAMinusEl = layout.elements.teamAMinus
  if (teamAMinusEl) {
    renderMinusButton(teamAMinusEl, 'teamA', halfWidth, 0, {
      createWidget: createWidgetCallback,
      onRemovePointForTeam: options.onRemovePointForTeam,
      onTriggerHapticFeedback: options.onTriggerHapticFeedback
    })
  }

  const teamBMinusEl = layout.elements.teamBMinus
  if (teamBMinusEl) {
    renderMinusButton(teamBMinusEl, 'teamB', halfWidth, halfWidth, {
      createWidget: createWidgetCallback,
      onRemovePointForTeam: options.onRemovePointForTeam,
      onTriggerHapticFeedback: options.onTriggerHapticFeedback
    })
  }
}

export function renderScoreButton(element, points, team, options = {}) {
  if (!element) {
    return
  }

  const createWidgetCallback = resolveCreateWidget(options)
  const onAddPointForTeam =
    typeof options.onAddPointForTeam === 'function'
      ? options.onAddPointForTeam
      : noop
  const onTriggerHapticFeedback =
    typeof options.onTriggerHapticFeedback === 'function'
      ? options.onTriggerHapticFeedback
      : noop

  const scoreTextSize = getFontSize('scoreDisplay')

  createWidgetCallback(hmUI.widget.BUTTON, {
    x: element.x,
    y: element.y,
    w: element.w,
    h: element.h,
    radius: 0,
    normal_color: TOKENS.colors.background,
    press_color: TOKENS.colors.background,
    color: TOKENS.colors.text,
    text_size: scoreTextSize,
    text: String(points),
    click_func: () => {
      onAddPointForTeam(team)
      onTriggerHapticFeedback()
    }
  })
}

export function renderMinusButton(
  element,
  team,
  halfWidth,
  columnOffset,
  options = {}
) {
  if (!element) {
    return
  }

  const createWidgetCallback = resolveCreateWidget(options)
  const onRemovePointForTeam =
    typeof options.onRemovePointForTeam === 'function'
      ? options.onRemovePointForTeam
      : noop
  const onTriggerHapticFeedback =
    typeof options.onTriggerHapticFeedback === 'function'
      ? options.onTriggerHapticFeedback
      : noop

  const MIN_TOUCH_SIZE = 48
  const buttonWidth = Math.max(element.w, MIN_TOUCH_SIZE)
  const buttonHeight = Math.max(element.h, MIN_TOUCH_SIZE)

  const buttonX = columnOffset + Math.round((halfWidth - buttonWidth) / 2)
  const buttonY = element.y + Math.round((element.h - buttonHeight) / 2)

  const minusBtn = createButton({
    x: buttonX,
    y: buttonY,
    w: buttonWidth,
    h: buttonHeight,
    variant: 'secondary',
    text: '−',
    onClick: () => {
      onRemovePointForTeam(team)
      onTriggerHapticFeedback()
    }
  })

  const visualRadius = Math.round(Math.min(element.w, element.h) / 2)
  minusBtn.config.radius = visualRadius
  minusBtn.config.color = TOKENS.colors.danger
  minusBtn.config.press_color = 0x2d3036

  createWidgetCallback(minusBtn.widgetType, minusBtn.config)
}

export function renderFooterElements(layout, options = {}) {
  const createWidgetCallback = resolveCreateWidget(options)
  const onBackToHome =
    typeof options.onBackToHome === 'function' ? options.onBackToHome : noop
  const onManualFinishTap =
    typeof options.onManualFinishTap === 'function'
      ? options.onManualFinishTap
      : noop

  const homeButtonEl = layout.elements.homeButton
  const homeButtonMeta = GAME_LAYOUT.elements.homeButton._meta
  const confirmFinishButtonEl = layout.elements.confirmFinishButton
  const confirmFinishMeta = GAME_LAYOUT.elements.confirmFinishButton._meta

  if (homeButtonEl && homeButtonMeta) {
    const homeBtn = createButton({
      x: Math.max(0, homeButtonEl.x - FOOTER_ICON_BUTTON_OFFSET),
      y: homeButtonEl.y,
      variant: 'icon',
      normal_src: homeButtonMeta.icon,
      onClick: () => onBackToHome()
    })
    createWidgetCallback(homeBtn.widgetType, homeBtn.config)
  }

  if (confirmFinishButtonEl && confirmFinishMeta) {
    const icon = options.manualFinishConfirmMode
      ? confirmFinishMeta.confirmIcon
      : confirmFinishMeta.icon
    const confirmBtn = createButton({
      x: confirmFinishButtonEl.x + FOOTER_ICON_BUTTON_OFFSET,
      y: confirmFinishButtonEl.y,
      variant: 'icon',
      normal_src: icon,
      press_src: icon,
      onClick: () => onManualFinishTap()
    })
    createWidgetCallback(confirmBtn.widgetType, confirmBtn.config)
  }
}
