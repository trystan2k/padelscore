export async function startNewMatchFlow(...args) {
  if (typeof globalThis.__summaryScreenStartNewMatchFlow !== 'function') {
    throw new Error('Missing summary startNewMatchFlow bridge.')
  }

  return globalThis.__summaryScreenStartNewMatchFlow(...args)
}
