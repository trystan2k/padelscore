function callRouter(method, payload) {
  const targets = [globalThis.__zosRouter, globalThis.router]

  for (const target of targets) {
    if (typeof target?.[method] === 'function') {
      return target[method](payload)
    }
  }

  if (typeof globalThis.hmApp?.gotoPage === 'function' && method === 'push') {
    return globalThis.hmApp.gotoPage(payload)
  }

  if (typeof globalThis.hmApp?.goBack === 'function' && method === 'back') {
    return globalThis.hmApp.goBack(payload)
  }

  return undefined
}

export function push(payload) {
  return callRouter('push', payload)
}

export function replace(payload) {
  return callRouter('replace', payload)
}

export function back(payload) {
  return callRouter('back', payload)
}

export function exit(payload) {
  return callRouter('exit', payload)
}
