export function checkSensor() {
  return true
}

export class Vibrator {
  constructor() {
    this.VIBRATOR_SCENE_SHORT_LIGHT = 'short-light'
    this.VIBRATOR_SCENE_STRONG_REMINDER = 'strong-reminder'
    this.VIBRATOR_SCENE_DURATION = 'duration'
    this.VIBRATOR_SCENE_DURATION_LONG = 'duration-long'
  }

  getType() {
    return {
      GENTLE_SHORT: 'gentle-short',
      STRONG_SHORT: 'strong-short',
      URGENT: 'urgent',
      PAUSE: 'pause'
    }
  }

  start(payload) {
    if (!Array.isArray(globalThis.__zosVibratorCalls)) {
      globalThis.__zosVibratorCalls = []
    }

    globalThis.__zosVibratorCalls.push(payload)
    return 0
  }
}

export class Time {
  constructor(date = new Date()) {
    this._date = date
  }

  getTime() {
    return this._date.getTime()
  }

  getFullYear() {
    return this._date.getFullYear()
  }

  getMonth() {
    return this._date.getMonth() + 1
  }

  getDate() {
    return this._date.getDate()
  }

  getHours() {
    return this._date.getHours()
  }

  getMinutes() {
    return this._date.getMinutes()
  }
}
