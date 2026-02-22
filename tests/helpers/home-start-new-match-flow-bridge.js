export async function startNewMatchFlow(...args) {
  if (typeof globalThis.__homeScreenStartNewMatchFlow !== 'function') {
    throw new Error('Missing home startNewMatchFlow bridge.')
  }

  return globalThis.__homeScreenStartNewMatchFlow(...args)
}
