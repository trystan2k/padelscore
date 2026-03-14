import assert from 'node:assert/strict'
import { beforeEach, test } from 'node:test'

import {
  getGestureRegistrations,
  getHapticsCalls,
  getKeepAwakeState,
  getRouterHistory,
  getStorageSnapshot,
  getToastState,
  deviceInfo as mockDeviceInfo,
  gesture as mockGesture,
  haptics as mockHaptics,
  keepAwake as mockKeepAwake,
  router as mockRouter,
  storage as mockStorage,
  toast as mockToast,
  resetPlatformAdaptersMock,
  setMockDeviceInfo,
  triggerGesture
} from './__mocks__/platform-adapters.js'
import { toProjectFileUrl } from './helpers/project-paths.js'

const RUNTIME_GLOBAL_KEYS = [
  'LocalStorage',
  '__zosDevice',
  '__zosDisplay',
  '__zosHaptics',
  '__zosInteraction',
  '__zosRouter',
  '__zosStorage',
  'device',
  'display',
  'hmApp',
  'hmSensor',
  'hmSetting',
  'hmUI',
  'haptics',
  'interaction',
  'localStorage',
  'router',
  'settingsStorage',
  'vibrator'
]
const STORAGE_VALUE_PREFIX = '__padel_buddy_platform_adapters__:'

beforeEach(() => {
  resetPlatformAdaptersMock()
})

test('platform adapters export the expected seven adapter contracts', async () => {
  const platformAdapters = await importFresh('utils/platform-adapters.js')

  assert.equal(typeof platformAdapters.router.navigateTo, 'function')
  assert.equal(typeof platformAdapters.router.redirectTo, 'function')
  assert.equal(typeof platformAdapters.router.navigateBack, 'function')
  assert.equal(typeof platformAdapters.gesture.registerGesture, 'function')
  assert.equal(typeof platformAdapters.gesture.unregisterGesture, 'function')
  assert.equal(typeof platformAdapters.toast.showToast, 'function')
  assert.equal(typeof platformAdapters.toast.hideToast, 'function')
  assert.equal(typeof platformAdapters.deviceInfo.getDeviceInfo, 'function')
  assert.equal(typeof platformAdapters.deviceInfo.isRoundScreen, 'function')
  assert.equal(typeof platformAdapters.keepAwake.setKeepAwake, 'function')
  assert.equal(typeof platformAdapters.keepAwake.getKeepAwakeStatus, 'function')
  assert.equal(typeof platformAdapters.storage.setItem, 'function')
  assert.equal(typeof platformAdapters.storage.getItem, 'function')
  assert.equal(typeof platformAdapters.storage.removeItem, 'function')
  assert.equal(typeof platformAdapters.storage.clear, 'function')
  assert.equal(typeof platformAdapters.haptics.vibrate, 'function')
  assert.equal(typeof platformAdapters.haptics.vibratePattern, 'function')
})

test('platform adapters load and smoke-test safely without a Zepp runtime', async () => {
  await withRuntimeGlobals({}, async () => {
    const platformAdapters = await importFresh('utils/platform-adapters.js')
    const gestureElement = { id: 'smoke' }

    assert.doesNotThrow(() => {
      platformAdapters.router.navigateTo('page/setup', { from: 'test' })
      platformAdapters.router.redirectTo('page/game', { mode: 'resume' })
      platformAdapters.router.navigateBack(2)
      platformAdapters.gesture.registerGesture(
        gestureElement,
        'RIGHT',
        () => true
      )
      platformAdapters.gesture.unregisterGesture(gestureElement, 'RIGHT')
      platformAdapters.toast.showToast('Saved', 1200)
      platformAdapters.toast.hideToast()
      platformAdapters.haptics.vibrate(80)
      platformAdapters.haptics.vibratePattern([30, 40, 30])
    })

    assert.deepEqual(platformAdapters.deviceInfo.getDeviceInfo(), {
      width: 390,
      height: 450,
      screenShape: 'square',
      isRound: false
    })
    assert.equal(platformAdapters.deviceInfo.isRoundScreen(), false)

    assert.equal(platformAdapters.keepAwake.getKeepAwakeStatus(), false)
    assert.equal(platformAdapters.keepAwake.setKeepAwake(true), true)
    assert.equal(platformAdapters.keepAwake.getKeepAwakeStatus(), true)
    assert.equal(platformAdapters.keepAwake.setKeepAwake(false), false)

    const storedValue = {
      taskId: 75,
      mode: 'adapter-only',
      smoke: true
    }

    platformAdapters.storage.setItem('platform-adapters', storedValue)
    assert.deepEqual(
      platformAdapters.storage.getItem('platform-adapters'),
      storedValue
    )
    platformAdapters.storage.removeItem('platform-adapters')
    assert.equal(platformAdapters.storage.getItem('platform-adapters'), null)
    platformAdapters.storage.setItem('transient', 'value')
    platformAdapters.storage.clear()
    assert.equal(platformAdapters.storage.getItem('transient'), null)
  })
})

test('platform adapters clone fallback storage values instead of sharing references', async () => {
  await withRuntimeGlobals({}, async () => {
    const platformAdapters = await importFresh('utils/platform-adapters.js')
    const storedValue = {
      score: {
        home: 15,
        away: 0
      }
    }

    platformAdapters.storage.setItem('session', storedValue)
    storedValue.score.home = 30

    const firstRead = platformAdapters.storage.getItem('session')
    assert.deepEqual(firstRead, {
      score: {
        home: 15,
        away: 0
      }
    })

    firstRead.score.away = 15

    assert.deepEqual(platformAdapters.storage.getItem('session'), {
      score: {
        home: 15,
        away: 0
      }
    })
  })
})

test('platform adapters fall back to in-memory storage when runtime values are malformed', async () => {
  let runtimeStorage = null

  await withRuntimeGlobals(
    {
      LocalStorage: class {
        constructor() {
          this.values = new Map()
          runtimeStorage = this
        }

        setItem(key, value) {
          this.values.set(key, value)
        }

        getItem(key) {
          return this.values.has(key) ? this.values.get(key) : null
        }

        removeItem(key) {
          this.values.delete(key)
        }

        clear() {
          this.values.clear()
        }
      }
    },
    async () => {
      const platformAdapters = await importFresh('utils/platform-adapters.js')
      const expectedValue = {
        enabled: true,
        mode: 'recovery'
      }

      platformAdapters.storage.setItem('settings', expectedValue)
      runtimeStorage.values.set('settings', `${STORAGE_VALUE_PREFIX}{bad-json}`)

      assert.deepEqual(
        platformAdapters.storage.getItem('settings'),
        expectedValue
      )
    }
  )
})

test('platform adapters return null and preserve prior value when setItem cannot serialize', async () => {
  await withRuntimeGlobals({}, async () => {
    const platformAdapters = await importFresh('utils/platform-adapters.js')
    const circularValue = {}

    circularValue.self = circularValue

    platformAdapters.storage.setItem('settings', { enabled: true })

    assert.equal(
      platformAdapters.storage.setItem('settings', circularValue),
      null
    )
    assert.deepEqual(platformAdapters.storage.getItem('settings'), {
      enabled: true
    })
  })
})

test('platform adapters return null for silent serialization failures and preserve prior value', async () => {
  await withRuntimeGlobals({}, async () => {
    const platformAdapters = await importFresh('utils/platform-adapters.js')

    platformAdapters.storage.setItem('settings', { enabled: true })

    assert.equal(platformAdapters.storage.setItem('settings', undefined), null)
    assert.deepEqual(platformAdapters.storage.getItem('settings'), {
      enabled: true
    })
    assert.equal(
      platformAdapters.storage.setItem('settings', () => true),
      null
    )
    assert.deepEqual(platformAdapters.storage.getItem('settings'), {
      enabled: true
    })
  })
})

test('platform adapters prefer modern-style runtime shims when available', async () => {
  const runtimeCalls = {
    router: [],
    interaction: [],
    display: [],
    haptics: [],
    legacyKeepAwake: []
  }

  await withRuntimeGlobals(
    {
      router: {
        push(payload) {
          runtimeCalls.router.push({ type: 'push', payload })
        },
        replace(payload) {
          runtimeCalls.router.push({ type: 'replace', payload })
        },
        back(payload) {
          runtimeCalls.router.push({ type: 'back', payload })
        }
      },
      interaction: {
        onGesture(gestureType, callback) {
          runtimeCalls.interaction.push({
            type: 'onGesture',
            gestureType,
            callback
          })
        },
        offGesture(gestureType) {
          runtimeCalls.interaction.push({ type: 'offGesture', gestureType })
        },
        showToast(payload) {
          runtimeCalls.interaction.push({ type: 'showToast', payload })
        },
        hideToast() {
          runtimeCalls.interaction.push({ type: 'hideToast' })
        }
      },
      device: {
        getDeviceInfo() {
          return { width: 466, height: 466, screenShape: 'round' }
        }
      },
      display: {
        setPageBrightTime(duration) {
          runtimeCalls.display.push({ type: 'setPageBrightTime', duration })
        },
        pauseDropWristScreenOff() {
          runtimeCalls.display.push({ type: 'pauseDropWristScreenOff' })
        },
        resetPageBrightTime() {
          runtimeCalls.display.push({ type: 'resetPageBrightTime' })
        },
        resetDropWristScreenOff() {
          runtimeCalls.display.push({ type: 'resetDropWristScreenOff' })
        }
      },
      hmSetting: {
        setBrightScreen(duration) {
          runtimeCalls.legacyKeepAwake.push({
            type: 'setBrightScreen',
            duration
          })
        },
        setBrightScreenCancel() {
          runtimeCalls.legacyKeepAwake.push({ type: 'setBrightScreenCancel' })
        }
      },
      LocalStorage: class {
        constructor() {
          this.values = new Map()
        }

        setItem(key, value) {
          this.values.set(key, value)
        }

        getItem(key) {
          return this.values.has(key) ? this.values.get(key) : null
        }

        removeItem(key) {
          this.values.delete(key)
        }

        clear() {
          this.values.clear()
        }
      },
      vibrator: {
        vibrate(duration) {
          runtimeCalls.haptics.push({ type: 'vibrate', duration })
        },
        vibratePattern(pattern) {
          runtimeCalls.haptics.push({ type: 'vibratePattern', pattern })
        }
      }
    },
    async () => {
      const platformAdapters = await importFresh('utils/platform-adapters.js')
      const gestureElement = { id: 'gesture-target' }
      const gestureCallback = () => true

      platformAdapters.router.navigateTo('page/setup', { matchId: 12 })
      platformAdapters.router.redirectTo('page/game', { resumed: true })
      platformAdapters.router.navigateBack(3)

      platformAdapters.gesture.registerGesture(
        gestureElement,
        'RIGHT',
        gestureCallback
      )
      platformAdapters.gesture.unregisterGesture(gestureElement, 'RIGHT')

      platformAdapters.toast.showToast('Linked', 900)
      platformAdapters.toast.hideToast()

      assert.equal(platformAdapters.deviceInfo.isRoundScreen(), true)
      assert.equal(
        platformAdapters.deviceInfo.getDeviceInfo().screenShape,
        'round'
      )

      platformAdapters.keepAwake.setKeepAwake(true)
      platformAdapters.keepAwake.setKeepAwake(false)

      platformAdapters.storage.setItem('settings', { enabled: true })
      assert.deepEqual(platformAdapters.storage.getItem('settings'), {
        enabled: true
      })
      platformAdapters.storage.removeItem('settings')

      platformAdapters.haptics.vibrate(45)
      platformAdapters.haptics.vibratePattern([15, 20, 15])

      assert.deepEqual(runtimeCalls.router, [
        {
          type: 'push',
          payload: {
            url: 'page/setup?matchId=12',
            params: { matchId: 12 }
          }
        },
        {
          type: 'replace',
          payload: {
            url: 'page/game?resumed=true',
            params: { resumed: true }
          }
        },
        {
          type: 'back',
          payload: { delta: 3 }
        }
      ])

      assert.equal(runtimeCalls.interaction[0].type, 'onGesture')
      assert.equal(runtimeCalls.interaction[0].gestureType, 'RIGHT')
      assert.equal(runtimeCalls.interaction[1].type, 'offGesture')
      assert.equal(runtimeCalls.interaction[1].gestureType, 'RIGHT')
      assert.deepEqual(runtimeCalls.interaction[2], {
        type: 'showToast',
        payload: {
          content: 'Linked',
          text: 'Linked',
          duration: 900
        }
      })
      assert.deepEqual(runtimeCalls.interaction[3], { type: 'hideToast' })
      assert.deepEqual(runtimeCalls.display, [
        { type: 'setPageBrightTime', duration: 2147483 },
        { type: 'pauseDropWristScreenOff' },
        { type: 'resetPageBrightTime' },
        { type: 'resetDropWristScreenOff' }
      ])
      assert.deepEqual(runtimeCalls.legacyKeepAwake, [])
      assert.deepEqual(runtimeCalls.haptics, [
        { type: 'vibrate', duration: 45 },
        { type: 'vibratePattern', pattern: [15, 20, 15] }
      ])
    }
  )
})

test('platform adapters use legacy globals when modern shims are unavailable', async () => {
  const runtimeCalls = {
    router: [],
    toast: [],
    keepAwake: [],
    haptics: []
  }
  const gestureEvents = []
  let legacyGestureHandler = null
  const originalSetTimeout = globalThis.setTimeout

  try {
    globalThis.setTimeout = (callback) => {
      callback()
      return 1
    }

    await withRuntimeGlobals(
      {
        hmApp: {
          gesture: {
            RIGHT: 7,
            LEFT: 8
          },
          gotoPage(payload) {
            runtimeCalls.router.push({ type: 'gotoPage', payload })
          },
          goBack() {
            runtimeCalls.router.push({ type: 'goBack' })
          },
          registerGestureEvent(callback) {
            legacyGestureHandler = callback
          },
          unregisterGestureEvent() {
            runtimeCalls.router.push({ type: 'unregisterGestureEvent' })
          }
        },
        hmUI: {
          showToast(payload) {
            runtimeCalls.toast.push(payload)
          }
        },
        hmSetting: {
          getDeviceInfo() {
            return { width: 454, height: 454, screenShape: 'round' }
          },
          setBrightScreen(duration) {
            runtimeCalls.keepAwake.push({ type: 'setBrightScreen', duration })
          },
          setBrightScreenCancel() {
            runtimeCalls.keepAwake.push({ type: 'setBrightScreenCancel' })
          }
        },
        hmSensor: {
          id: {
            VIBRATE: 'vibrate'
          },
          createSensor(sensorId) {
            runtimeCalls.haptics.push({ type: 'createSensor', sensorId })

            return {
              start() {
                runtimeCalls.haptics.push({ type: 'start' })
              },
              stop() {
                runtimeCalls.haptics.push({ type: 'stop' })
              }
            }
          }
        }
      },
      async () => {
        const platformAdapters = await importFresh('utils/platform-adapters.js')
        const gestureElement = { id: 'legacy-page' }

        platformAdapters.router.navigateTo('page/history', { filter: 'recent' })
        platformAdapters.router.redirectTo('page/index')
        platformAdapters.router.navigateBack(2)

        platformAdapters.toast.showToast('Archived', 1500)

        platformAdapters.keepAwake.setKeepAwake(true)
        platformAdapters.keepAwake.setKeepAwake(false)

        platformAdapters.haptics.vibrate(75)

        platformAdapters.gesture.registerGesture(
          gestureElement,
          'RIGHT',
          (event) => {
            gestureEvents.push(event)
            return true
          }
        )

        assert.equal(typeof legacyGestureHandler, 'function')
        assert.equal(legacyGestureHandler(7), true)
        assert.deepEqual(gestureEvents, [7])

        platformAdapters.gesture.unregisterGesture(gestureElement, 'RIGHT')

        assert.equal(platformAdapters.deviceInfo.isRoundScreen(), true)
        assert.deepEqual(platformAdapters.deviceInfo.getDeviceInfo(), {
          width: 454,
          height: 454,
          screenShape: 'round',
          isRound: true
        })
      }
    )
  } finally {
    globalThis.setTimeout = originalSetTimeout
  }

  assert.deepEqual(runtimeCalls.router, [
    {
      type: 'gotoPage',
      payload: {
        url: 'page/history?filter=recent',
        param: { filter: 'recent' }
      }
    },
    { type: 'gotoPage', payload: { url: 'page/index' } },
    { type: 'goBack' },
    { type: 'goBack' },
    { type: 'unregisterGestureEvent' }
  ])
  assert.deepEqual(runtimeCalls.toast, [
    {
      text: 'Archived',
      duration: 1500
    }
  ])
  assert.deepEqual(runtimeCalls.keepAwake, [
    { type: 'setBrightScreen', duration: 2147483 },
    { type: 'setBrightScreenCancel' }
  ])
  assert.deepEqual(runtimeCalls.haptics, [
    { type: 'createSensor', sensorId: 'vibrate' },
    { type: 'stop' },
    { type: 'start' },
    { type: 'stop' }
  ])
})

test('platform adapter mock tracks router, toast, storage, keep-awake, device, haptics, and gestures', () => {
  const gestureElement = { id: 'home-screen' }
  const triggeredPayloads = []

  mockRouter.navigateTo('page/setup', { flow: 'new-match' })
  mockRouter.redirectTo('page/game', { flow: 'resume' })
  mockRouter.navigateBack(2)

  mockToast.showToast('Ready', 1500)
  mockKeepAwake.setKeepAwake(true)
  mockStorage.setItem('session', { score: '15-0' })
  setMockDeviceInfo({ width: 466, height: 466 })
  mockHaptics.vibrate(60)
  mockHaptics.vibratePattern([20, 20, 20])
  mockGesture.registerGesture(gestureElement, 'RIGHT', (payload) => {
    triggeredPayloads.push(payload)
    return true
  })

  assert.equal(
    triggerGesture(gestureElement, 'RIGHT', { source: 'test' }),
    true
  )
  assert.deepEqual(triggeredPayloads, [{ source: 'test' }])
  assert.deepEqual(getRouterHistory(), [
    {
      type: 'navigateTo',
      pagePath: 'page/setup',
      params: { flow: 'new-match' }
    },
    {
      type: 'redirectTo',
      pagePath: 'page/game',
      params: { flow: 'resume' }
    },
    {
      type: 'navigateBack',
      delta: 2
    }
  ])
  assert.deepEqual(getToastState(), {
    visible: true,
    message: 'Ready',
    duration: 1500
  })
  assert.deepEqual(getStorageSnapshot(), {
    session: { score: '15-0' }
  })
  assert.equal(getKeepAwakeState(), true)
  assert.equal(mockDeviceInfo.isRoundScreen(), true)
  assert.deepEqual(mockDeviceInfo.getDeviceInfo(), {
    width: 466,
    height: 466,
    screenShape: 'round',
    isRound: true
  })
  assert.deepEqual(getHapticsCalls(), [
    { type: 'vibrate', duration: 60 },
    { type: 'vibratePattern', pattern: [20, 20, 20] }
  ])
  assert.equal(getGestureRegistrations().length, 1)
})

test('platform adapter mock rejects non-function gesture callbacks', () => {
  const gestureElement = { id: 'invalid-callback' }

  assert.equal(
    mockGesture.registerGesture(gestureElement, 'RIGHT', null),
    false
  )
  assert.deepEqual(getGestureRegistrations(), [])
})

test('platform adapter mock storage preserves prior value when cloning fails', () => {
  const circularValue = {}

  circularValue.self = circularValue

  mockStorage.setItem('settings', { enabled: true })

  assert.equal(mockStorage.setItem('settings', undefined), null)
  assert.deepEqual(mockStorage.getItem('settings'), {
    enabled: true
  })
  assert.equal(mockStorage.setItem('settings', circularValue), null)
  assert.deepEqual(mockStorage.getItem('settings'), {
    enabled: true
  })
})

test('platform adapter mock normalizes toast and haptics like production adapters', () => {
  mockToast.showToast(123, 0)
  mockHaptics.vibrate(-20)
  mockHaptics.vibratePattern([15.2, 0, -5, '30', 20.6])

  assert.deepEqual(getToastState(), {
    visible: true,
    message: '123',
    duration: 2000
  })
  assert.deepEqual(getHapticsCalls(), [
    { type: 'vibrate', duration: 50 },
    { type: 'vibratePattern', pattern: [15, 21] }
  ])
})

test('platform adapter mock normalizes navigateBack delta like production adapters', () => {
  mockRouter.navigateBack(0)
  mockRouter.navigateBack(2.4)
  mockRouter.navigateBack('bad')

  assert.deepEqual(getRouterHistory(), [
    { type: 'navigateBack', delta: 1 },
    { type: 'navigateBack', delta: 2 },
    { type: 'navigateBack', delta: 1 }
  ])
})

test('platform adapter mock reset clears state for isolated tests', () => {
  assert.deepEqual(getRouterHistory(), [])
  assert.deepEqual(getGestureRegistrations(), [])
  assert.deepEqual(getToastState(), {
    visible: false,
    message: '',
    duration: 0
  })
  assert.deepEqual(getStorageSnapshot(), {})
  assert.equal(getKeepAwakeState(), false)
  assert.equal(mockDeviceInfo.isRoundScreen(), false)
  assert.deepEqual(getHapticsCalls(), [])
})

test('platform adapter mock supports unregister, hide, remove, and clear flows', () => {
  const gestureElement = { id: 'details-screen' }

  mockGesture.registerGesture(gestureElement, 'LEFT', () => true)
  mockToast.showToast('Transient', 300)
  mockStorage.setItem('a', 1)
  mockStorage.setItem('b', 2)

  assert.equal(mockGesture.unregisterGesture(gestureElement, 'LEFT'), true)
  assert.equal(triggerGesture(gestureElement, 'LEFT'), false)

  mockToast.hideToast()
  assert.equal(getToastState().visible, false)

  mockStorage.removeItem('a')
  assert.deepEqual(getStorageSnapshot(), { b: 2 })

  mockStorage.clear()
  assert.deepEqual(getStorageSnapshot(), {})
})

function captureRuntimeGlobals() {
  return Object.fromEntries(
    RUNTIME_GLOBAL_KEYS.map((key) => [
      key,
      {
        exists: Object.hasOwn(globalThis, key),
        value: globalThis[key]
      }
    ])
  )
}

async function withRuntimeGlobals(nextGlobals, run) {
  const snapshot = captureRuntimeGlobals()

  try {
    for (let index = 0; index < RUNTIME_GLOBAL_KEYS.length; index += 1) {
      const key = RUNTIME_GLOBAL_KEYS[index]

      if (Object.hasOwn(nextGlobals, key)) {
        globalThis[key] = nextGlobals[key]
      } else {
        delete globalThis[key]
      }
    }

    return await run()
  } finally {
    for (let index = 0; index < RUNTIME_GLOBAL_KEYS.length; index += 1) {
      const key = RUNTIME_GLOBAL_KEYS[index]
      const entry = snapshot[key]

      if (entry.exists) {
        globalThis[key] = entry.value
      } else {
        delete globalThis[key]
      }
    }
  }
}

async function importFresh(relativePath) {
  return import(
    `${toProjectFileUrl(relativePath).href}?t=${Date.now()}-${Math.random()}`
  )
}
