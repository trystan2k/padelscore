export function getDeviceInfo() {
  if (typeof globalThis.hmSetting?.getDeviceInfo === 'function') {
    return globalThis.hmSetting.getDeviceInfo()
  }
  return { width: 390, height: 450, dpr: 2 }
}
