const __mocks__ = {
  device: {
    getDeviceId: () => 'test-device',
    getWidth: () => 466,
    getHeight: () => 466,
    getScreenType: () => 0,
    getDeviceInfo: () => ({ width: 466, height: 466, screenType: 0 })
  },
  ui: {
    createWidget: vi.fn(() => ({})),
    deleteWidget: vi.fn(),
    widget: {
      TEXT: 'TEXT',
      IMAGE: 'IMAGE',
      RECT: 'RECT',
      FILL_RECT: 'FILL_RECT',
      STROKE_RECT: 'STROKE_RECT',
      ARC: 'ARC',
      CIRCLE: 'CIRCLE',
      LINE: 'LINE',
      BUTTON: 'BUTTON'
    },
    align: {
      CENTER_H: 'CENTER_H',
      CENTER_V: 'CENTER_V',
      LEFT: 'LEFT',
      RIGHT: 'RIGHT',
      TOP: 'TOP',
      BOTTOM: 'BOTTOM'
    },
    text_style: {
      WRAP: 'WRAP',
      ELLIPSIS: 'ELLIPSIS'
    },
    prop: {
      MORE: 'MORE',
      X: 'X',
      Y: 'Y',
      W: 'W',
      H: 'H',
      TEXT: 'TEXT',
      COLOR: 'COLOR',
      TEXT_SIZE: 'TEXT_SIZE',
      SRC: 'SRC'
    }
  },
  display: {
    resetUpdateValue: vi.fn(),
    getUpdateValue: vi.fn(() => 1),
    setPartialRefresh: vi.fn()
  },
  sensor: {
    onAccelerometerChange: vi.fn(),
    offAccelerometerChange: vi.fn(),
    onGeolocationChange: vi.fn(),
    offGeolocationChange: vi.fn(),
    onHeartRateChange: vi.fn(),
    offHeartRateChange: vi.fn()
  },
  router: {
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    getSetupPageUrl: vi.fn(() => 'zepp://setup'),
    openAppSettings: vi.fn()
  },
  i18n: {
    getLocale: vi.fn(() => 'en-US'),
    t: vi.fn((key) => key)
  },
  storage: {
    getStorageConfig: vi.fn(() => ({})),
    setStorageConfig: vi.fn()
  },
  fs: {
    O_RDONLY: 0,
    O_WRONLY: 1,
    O_CREAT: 64,
    O_TRUNC: 512,
    open: vi.fn(),
    close: vi.fn(),
    write: vi.fn(),
    read: vi.fn(),
    stat: vi.fn()
  },
  file: {
    read: vi.fn(() => ''),
    write: vi.fn(),
    exists: vi.fn(() => false)
  },
  util: {
    getCurrentTime: vi.fn(() => ({ hour: 12, minute: 0, second: 0 })),
    formatTime: vi.fn(() => '12:00'),
    formatDate: vi.fn(() => '01/01/2026')
  },
  settings: {
    getDeviceInfo: vi.fn(() => ({ width: 466, height: 466 })),
    getScreenType: vi.fn(() => 0)
  },
  app: {
    getAppInfo: vi.fn(() => ({ appId: 'test-app', appVersion: '1.0.0' })),
    getColor: vi.fn(() => 0xffffff)
  },
  image: {
    read: vi.fn(() => null)
  },
  time: {
    format: vi.fn(() => '12:00')
  },
  page: {
    setState: vi.fn(),
    getState: vi.fn(() => ({}))
  },
  event: {
    on: vi.fn(),
    off: vi.fn(),
    emit: vi.fn()
  },
  haptics: {
    startVibration: vi.fn()
  }
}

export function resetAllMocks() {
  Object.values(__mocks__).forEach((module) => {
    Object.values(module).forEach((fn) => {
      if (vi.isMockFunction(fn)) {
        fn.mockClear()
      }
    })
  })
}

export default __mocks__
