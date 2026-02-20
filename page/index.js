import { gettext } from 'i18n'
import { createScoreViewModel } from './score-view-model.js'

Page({
  onInit() {
    this.scoreViewModel = null
    this.refreshScoreView()
  },

  build() {
    console.log(gettext('example'))

    this.refreshScoreView()
  },

  resolveApp() {
    if (!this.app) {
      this.app = getApp()
    }

    return this.app
  },

  refreshScoreView(matchState) {
    const app = this.resolveApp()
    const sourceState = matchState || app.globalData.matchState

    this.scoreViewModel = createScoreViewModel(sourceState)
    return this.scoreViewModel
  },

  addPointForTeam(team) {
    const app = this.resolveApp()
    const nextState = app.addPointForTeam(team)

    return this.refreshScoreView(nextState)
  },

  removePoint() {
    const app = this.resolveApp()
    const restoredState = app.removePoint()

    return this.refreshScoreView(restoredState)
  },

  onUndoTap() {
    return this.removePoint()
  }
})
