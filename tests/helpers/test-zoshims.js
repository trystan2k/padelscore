const hmUI = {
  widget: {
    TEXT: 'TEXT',
    BUTTON: 'BUTTON',
    IMG: 'IMG',
    FILL_RECT: 'FILL_RECT',
    SCROLL_LIST: 'SCROLL_LIST'
  },
  createWidget: () => ({}),
  deleteWidget: () => true,
  getTextLayout: (text, options) => ({
    width: String(text ?? '').length * 10,
    height: options?.text_size ?? 24
  })
}

const gettext = (key) => key

const getDeviceInfo = () => ({ width: 390, height: 450 })

const router = {
  push: () => undefined,
  replace: () => undefined,
  back: () => undefined,
  exit: () => undefined
}

const sensor = {
  checkSensor: () => true,
  Vibrator: class {
    start() {
      return 0
    }
  },
  Time: class {
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
}

const LocalStorage = class {
  constructor() {
    this._data = new Map()
  }
  setItem(key, value) {
    this._data.set(key, value)
  }
  getItem(key) {
    return this._data.get(key) ?? null
  }
  removeItem(key) {
    this._data.delete(key)
  }
  clear() {
    this._data.clear()
  }
}

const display = {
  setWakeUpRelaunch: () => undefined
}

export { hmUI, gettext, getDeviceInfo, router, sensor, LocalStorage, display }
export default {
  hmUI,
  gettext,
  getDeviceInfo,
  router,
  sensor,
  LocalStorage,
  display
}
