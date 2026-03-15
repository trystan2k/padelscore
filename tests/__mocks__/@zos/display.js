export function setWakeUpRelaunch(enabled) {
  if (typeof globalThis.hmApp?.setWakeUpRelaunch === 'function') {
    return globalThis.hmApp.setWakeUpRelaunch(enabled)
  }
  return undefined
}

export function pauseDropWristScreenOff() {
  if (typeof globalThis.hmApp?.pauseDropWristScreenOff === 'function') {
    return globalThis.hmApp.pauseDropWristScreenOff()
  }
  return undefined
}

export function pausePalmScreenOff() {
  if (typeof globalThis.hmApp?.pausePalmScreenOff === 'function') {
    return globalThis.hmApp.pausePalmScreenOff()
  }
  return undefined
}

export function resetDropWristScreenOff() {
  if (typeof globalThis.hmApp?.resetDropWristScreenOff === 'function') {
    return globalThis.hmApp.resetDropWristScreenOff()
  }
  return undefined
}

export function resetPageBrightTime() {
  if (typeof globalThis.hmApp?.resetPageBrightTime === 'function') {
    return globalThis.hmApp.resetPageBrightTime()
  }
  return undefined
}

export function resetPalmScreenOff() {
  if (typeof globalThis.hmApp?.resetPalmScreenOff === 'function') {
    return globalThis.hmApp.resetPalmScreenOff()
  }
  return undefined
}

export function setPageBrightTime(duration) {
  if (typeof globalThis.hmApp?.setPageBrightTime === 'function') {
    return globalThis.hmApp.setPageBrightTime(duration)
  }
  return undefined
}
