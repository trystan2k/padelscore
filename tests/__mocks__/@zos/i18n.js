export function getText(key) {
  if (typeof globalThis.hmI18n?.getText === 'function') {
    return globalThis.hmI18n.getText(key)
  }
  return key
}
