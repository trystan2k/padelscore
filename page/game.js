import { gettext } from 'i18n'

import { createScoreViewModel } from './score-view-model.js'
import { createHistoryStack, deepCopyState } from '../utils/history-stack.js'
import { createInitialMatchState } from '../utils/match-state.js'
import { addPoint, removePoint } from '../utils/scoring-engine.js'
import { loadState, saveState } from '../utils/storage.js'

const GAME_TOKENS = Object.freeze({
  colors: {
    accent: 0x1eb98c,
    background: 0x000000,
    buttonText: 0x000000,
    cardBackground: 0x111111,
    mutedText: 0xb2b2b2,
    text: 0xffffff
  },
  fontScale: {
    button: 0.038,
    label: 0.04,
    points: 0.1,
    setScore: 0.078,
    setTeam: 0.034
  },
  spacingScale: {
    cardTop: 0.2,
    controlsBottom: 0.07,
    controlsColumnGap: 0.04,
    controlsRowGap: 0.018,
    controlsSideInset: 0.07,
    controlsSideInsetRound: 0.12,
    setSectionTop: 0.04,
    sectionGap: 0.03
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

function isRecord(value) {
  return typeof value === 'object' && value !== null
}

function isValidRuntimeMatchState(matchState) {
  return (
    isRecord(matchState) &&
    isRecord(matchState.teams) &&
    isRecord(matchState.teams.teamA) &&
    isRecord(matchState.teams.teamB) &&
    isRecord(matchState.teamA) &&
    isRecord(matchState.teamB) &&
    isRecord(matchState.currentSetStatus)
  )
}

function isHistoryStackLike(historyStack) {
  return (
    isRecord(historyStack) &&
    typeof historyStack.push === 'function' &&
    typeof historyStack.pop === 'function' &&
    typeof historyStack.clear === 'function' &&
    typeof historyStack.isEmpty === 'function'
  )
}

function isTeamIdentifier(team) {
  return team === 'teamA' || team === 'teamB'
}

function isSameMatchState(leftState, rightState) {
  try {
    return JSON.stringify(leftState) === JSON.stringify(rightState)
  } catch {
    return false
  }
}

function getScoringTeamForTransition(previousState, nextState) {
  const nextStateAfterTeamA = addPoint(previousState, 'teamA')
  if (isSameMatchState(nextStateAfterTeamA, nextState)) {
    return 'teamA'
  }

  const nextStateAfterTeamB = addPoint(previousState, 'teamB')
  if (isSameMatchState(nextStateAfterTeamB, nextState)) {
    return 'teamB'
  }

  return null
}

function popHistorySnapshotsInOrder(historyStack) {
  const reverseChronologicalSnapshots = []

  while (!historyStack.isEmpty()) {
    const snapshot = historyStack.pop()
    if (snapshot === null) {
      break
    }

    reverseChronologicalSnapshots.push(snapshot)
  }

  return reverseChronologicalSnapshots.reverse()
}

function restoreHistorySnapshots(historyStack, snapshots) {
  historyStack.clear()

  snapshots.forEach((snapshot) => {
    historyStack.push(snapshot)
  })
}

Page({
  onInit() {
    this.widgets = []
    this.ensureRuntimeState()
  },

  onShow() {
    this.ensureRuntimeState()
    this.renderGameScreen()
  },

  build() {
    this.renderGameScreen()
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

  ensureRuntimeState() {
    const app = this.getAppInstance()

    if (!app) {
      return
    }

    if (!isHistoryStackLike(app.globalData.matchHistory)) {
      app.globalData.matchHistory = createHistoryStack()
    }

    if (isValidRuntimeMatchState(app.globalData.matchState)) {
      return
    }

    const persistedState = loadState()

    app.globalData.matchState =
      persistedState !== null ? cloneMatchState(persistedState) : createInitialMatchState()
  },

  getRuntimeMatchState() {
    const app = this.getAppInstance()

    if (!app) {
      return createInitialMatchState()
    }

    if (!isValidRuntimeMatchState(app.globalData.matchState)) {
      app.globalData.matchState = createInitialMatchState()
    }

    return app.globalData.matchState
  },

  updateRuntimeMatchState(nextState) {
    const app = this.getAppInstance()

    if (!app || !isValidRuntimeMatchState(nextState)) {
      return
    }

    app.globalData.matchState = nextState
  },

  addPointForTeam(team) {
    const app = this.getAppInstance()

    if (!app) {
      return null
    }

    if (typeof app.addPointForTeam === 'function') {
      return app.addPointForTeam(team)
    }

    const nextState = addPoint(app.globalData.matchState, team, app.globalData.matchHistory)
    app.globalData.matchState = nextState
    return nextState
  },

  removePoint() {
    const app = this.getAppInstance()

    if (!app) {
      return null
    }

    if (typeof app.removePoint === 'function') {
      return app.removePoint()
    }

    const nextState = removePoint(app.globalData.matchState, app.globalData.matchHistory)
    app.globalData.matchState = nextState
    return nextState
  },

  removePointForTeam(team) {
    const app = this.getAppInstance()

    if (!app || !isTeamIdentifier(team)) {
      return null
    }

    if (typeof app.removePointForTeam === 'function') {
      return app.removePointForTeam(team)
    }

    if (
      !isValidRuntimeMatchState(app.globalData.matchState) ||
      !isHistoryStackLike(app.globalData.matchHistory)
    ) {
      return null
    }

    const historySnapshots = popHistorySnapshotsInOrder(app.globalData.matchHistory)
    const stateTimeline = [...historySnapshots, deepCopyState(app.globalData.matchState)]
    const scoringTeams = []

    for (let index = 1; index < stateTimeline.length; index += 1) {
      const scoringTeam = getScoringTeamForTransition(
        stateTimeline[index - 1],
        stateTimeline[index]
      )

      if (!scoringTeam) {
        restoreHistorySnapshots(app.globalData.matchHistory, historySnapshots)
        return deepCopyState(app.globalData.matchState)
      }

      scoringTeams.push(scoringTeam)
    }

    let removedEventIndex = -1
    for (let index = scoringTeams.length - 1; index >= 0; index -= 1) {
      if (scoringTeams[index] === team) {
        removedEventIndex = index
        break
      }
    }

    if (removedEventIndex === -1) {
      restoreHistorySnapshots(app.globalData.matchHistory, historySnapshots)
      return deepCopyState(app.globalData.matchState)
    }

    const rebuiltHistory = createHistoryStack()
    let rebuiltState = deepCopyState(stateTimeline[0])

    for (let index = 0; index < scoringTeams.length; index += 1) {
      if (index === removedEventIndex) {
        continue
      }

      rebuiltState = addPoint(rebuiltState, scoringTeams[index], rebuiltHistory)
    }

    app.globalData.matchHistory = rebuiltHistory
    app.globalData.matchState = rebuiltState

    return rebuiltState
  },

  persistAndRender(nextState) {
    if (!isValidRuntimeMatchState(nextState)) {
      return
    }

    this.updateRuntimeMatchState(nextState)
    saveState(nextState)
    this.renderGameScreen()
  },

  handleAddPointForTeam(team) {
    const nextState = this.addPointForTeam(team)

    if (!nextState) {
      return
    }

    this.persistAndRender(nextState)
  },

  handleRemovePoint() {
    const nextState = this.removePoint()

    if (!nextState) {
      return
    }

    this.persistAndRender(nextState)
  },

  handleRemovePointForTeam(team) {
    const nextState = this.removePointForTeam(team)

    if (!nextState) {
      return
    }

    this.persistAndRender(nextState)
  },

  renderGameScreen() {
    if (typeof hmUI === 'undefined') {
      return
    }

    const matchState = this.getRuntimeMatchState()
    const viewModel = createScoreViewModel(matchState)
    const { width, height } = this.getScreenMetrics()
    const isRoundScreen = Math.abs(width - height) <= Math.round(width * 0.04)

    const baseSectionSideInset = Math.round(width * 0.06)

    const setSectionHeight = Math.round(height * 0.12)
    const setSectionY = Math.round(height * GAME_TOKENS.spacingScale.setSectionTop)
    let setSectionSideInset = baseSectionSideInset
    if (isRoundScreen) {
      setSectionSideInset = Math.max(
        setSectionSideInset,
        calculateRoundSafeSectionSideInset(
          width,
          height,
          setSectionY,
          setSectionHeight,
          Math.round(width * 0.01)
        )
      )
    }

    const maxSectionInset = Math.floor((width - 1) / 2)
    setSectionSideInset = clamp(setSectionSideInset, 0, maxSectionInset)
    const setSectionX = setSectionSideInset
    const setSectionWidth = Math.max(1, width - setSectionSideInset * 2)
    const setLabelHeight = Math.round(setSectionHeight * 0.4)
    const setScoreY = setSectionY + setLabelHeight
    const setScoreHeight = setSectionHeight - setLabelHeight
    const setTeamWidth = Math.round(setSectionWidth / 2)
    const rightTeamX = setSectionX + setTeamWidth
    let controlsSideInset = Math.round(
      width *
        (isRoundScreen
          ? GAME_TOKENS.spacingScale.controlsSideInsetRound
          : GAME_TOKENS.spacingScale.controlsSideInset)
    )
    const controlsColumnGap = Math.round(width * GAME_TOKENS.spacingScale.controlsColumnGap)
    const controlsRowGap = Math.round(height * GAME_TOKENS.spacingScale.controlsRowGap)
    const buttonHeight = clamp(Math.round(height * 0.104), 46, 58)
    const baseControlsBottomInset = Math.round(height * GAME_TOKENS.spacingScale.controlsBottom)
    const controlsBottomInset = isRoundScreen
      ? Math.max(baseControlsBottomInset, Math.round(height * 0.11))
      : baseControlsBottomInset
    const addButtonsY =
      height - controlsBottomInset - buttonHeight * 2 - controlsRowGap
    const removeButtonsY = addButtonsY + buttonHeight + controlsRowGap
    if (isRoundScreen) {
      const controlsSectionHeight = buttonHeight * 2 + controlsRowGap
      const controlsSectionSafeInset = calculateRoundSafeSectionSideInset(
        width,
        height,
        addButtonsY,
        controlsSectionHeight,
        Math.round(width * 0.012)
      )

      controlsSideInset = Math.max(controlsSideInset, controlsSectionSafeInset)
    }

    const maxControlsInset = Math.floor((width - controlsColumnGap - 2) / 2)
    controlsSideInset = clamp(controlsSideInset, 0, maxControlsInset)

    const buttonWidth = Math.round((width - controlsSideInset * 2 - controlsColumnGap) / 2)
    const leftButtonX = controlsSideInset
    const rightButtonX = leftButtonX + buttonWidth + controlsColumnGap
    const pointsSectionY =
      setSectionY + setSectionHeight + Math.round(height * GAME_TOKENS.spacingScale.sectionGap)
    const pointsSectionBottom = addButtonsY - Math.round(height * GAME_TOKENS.spacingScale.sectionGap)
    const pointsSectionHeight = Math.max(0, pointsSectionBottom - pointsSectionY)
    let pointsSectionSideInset = baseSectionSideInset
    if (isRoundScreen && pointsSectionHeight > 0) {
      pointsSectionSideInset = Math.max(
        pointsSectionSideInset,
        calculateRoundSafeSectionSideInset(
          width,
          height,
          pointsSectionY,
          pointsSectionHeight,
          Math.round(width * 0.01)
        )
      )
    }

    pointsSectionSideInset = clamp(pointsSectionSideInset, 0, maxSectionInset)
    const pointsSectionX = pointsSectionSideInset
    const pointsSectionWidth = Math.max(1, width - pointsSectionSideInset * 2)
    const pointsLabelHeight = Math.round(pointsSectionHeight * 0.3)
    const pointsValueY = pointsSectionY + pointsLabelHeight
    const pointsValueHeight = pointsSectionHeight - pointsLabelHeight
    const pointsValueTextSize = clamp(Math.round(width * 0.128), 44, 64)

    this.clearWidgets()

    this.createWidget(hmUI.widget.FILL_RECT, {
      x: 0,
      y: 0,
      w: width,
      h: height,
      color: GAME_TOKENS.colors.background
    })

    this.createWidget(hmUI.widget.FILL_RECT, {
      x: setSectionX,
      y: setSectionY,
      w: setSectionWidth,
      h: setSectionHeight,
      radius: Math.round(setSectionHeight * 0.24),
      color: GAME_TOKENS.colors.cardBackground
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: setSectionX,
      y: setSectionY,
      w: setTeamWidth,
      h: setLabelHeight,
      color: GAME_TOKENS.colors.accent,
      text: viewModel.teamA.label,
      text_size: Math.round(width * GAME_TOKENS.fontScale.setTeam),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: rightTeamX,
      y: setSectionY,
      w: setTeamWidth,
      h: setLabelHeight,
      color: GAME_TOKENS.colors.accent,
      text: viewModel.teamB.label,
      text_size: Math.round(width * GAME_TOKENS.fontScale.setTeam),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: setSectionX,
      y: setScoreY,
      w: setTeamWidth,
      h: setScoreHeight,
      color: GAME_TOKENS.colors.text,
      text: String(viewModel.currentSetGames.teamA),
      text_size: Math.round(width * GAME_TOKENS.fontScale.setScore),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: rightTeamX,
      y: setScoreY,
      w: setTeamWidth,
      h: setScoreHeight,
      color: GAME_TOKENS.colors.text,
      text: String(viewModel.currentSetGames.teamB),
      text_size: Math.round(width * GAME_TOKENS.fontScale.setScore),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.FILL_RECT, {
      x: pointsSectionX,
      y: pointsSectionY,
      w: pointsSectionWidth,
      h: pointsSectionHeight,
      radius: Math.round(pointsSectionWidth * 0.08),
      color: GAME_TOKENS.colors.cardBackground
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: pointsSectionX,
      y: pointsSectionY,
      w: pointsSectionWidth,
      h: pointsLabelHeight,
      color: GAME_TOKENS.colors.accent,
      text: gettext('game.title'),
      text_size: Math.round(width * GAME_TOKENS.fontScale.label),
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.TEXT, {
      x: pointsSectionX,
      y: pointsValueY,
      w: pointsSectionWidth,
      h: pointsValueHeight,
      color: GAME_TOKENS.colors.text,
      text: `${viewModel.teamA.points} - ${viewModel.teamB.points}`,
      text_size: pointsValueTextSize,
      align_h: hmUI.align.CENTER_H,
      align_v: hmUI.align.CENTER_V
    })

    this.createWidget(hmUI.widget.BUTTON, {
      x: leftButtonX,
      y: addButtonsY,
      w: buttonWidth,
      h: buttonHeight,
      radius: Math.round(buttonHeight / 2),
      normal_color: GAME_TOKENS.colors.accent,
      press_color: GAME_TOKENS.colors.accent,
      color: GAME_TOKENS.colors.buttonText,
      text_size: Math.round(width * GAME_TOKENS.fontScale.button),
      text: gettext('game.teamAAddPoint'),
      click_func: () => this.handleAddPointForTeam('teamA')
    })

    this.createWidget(hmUI.widget.BUTTON, {
      x: rightButtonX,
      y: addButtonsY,
      w: buttonWidth,
      h: buttonHeight,
      radius: Math.round(buttonHeight / 2),
      normal_color: GAME_TOKENS.colors.accent,
      press_color: GAME_TOKENS.colors.accent,
      color: GAME_TOKENS.colors.buttonText,
      text_size: Math.round(width * GAME_TOKENS.fontScale.button),
      text: gettext('game.teamBAddPoint'),
      click_func: () => this.handleAddPointForTeam('teamB')
    })

    this.createWidget(hmUI.widget.BUTTON, {
      x: leftButtonX,
      y: removeButtonsY,
      w: buttonWidth,
      h: buttonHeight,
      radius: Math.round(buttonHeight / 2),
      normal_color: GAME_TOKENS.colors.accent,
      press_color: GAME_TOKENS.colors.accent,
      color: GAME_TOKENS.colors.buttonText,
      text_size: Math.round(width * GAME_TOKENS.fontScale.button),
      text: gettext('game.teamARemovePoint'),
      click_func: () => this.handleRemovePointForTeam('teamA')
    })

    this.createWidget(hmUI.widget.BUTTON, {
      x: rightButtonX,
      y: removeButtonsY,
      w: buttonWidth,
      h: buttonHeight,
      radius: Math.round(buttonHeight / 2),
      normal_color: GAME_TOKENS.colors.accent,
      press_color: GAME_TOKENS.colors.accent,
      color: GAME_TOKENS.colors.buttonText,
      text_size: Math.round(width * GAME_TOKENS.fontScale.button),
      text: gettext('game.teamBRemovePoint'),
      click_func: () => this.handleRemovePointForTeam('teamB')
    })
  }
})
