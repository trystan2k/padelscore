import { dirname, resolve as pathResolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const mockDir = pathToFileURL('./tests/__mocks__/@zos/').href
const projectRoot = pathResolve(process.cwd())

function isRelativeImport(specifier) {
  return specifier.startsWith('./') || specifier.startsWith('../')
}

function resolveLocalImport(specifier, parentUrl) {
  if (!parentUrl || !isRelativeImport(specifier)) {
    return null
  }

  try {
    const parentPath = fileURLToPath(parentUrl)
    const parentDir = dirname(parentPath)
    const resolvedPath = pathResolve(parentDir, specifier)

    if (!resolvedPath.startsWith(projectRoot)) {
      return null
    }

    return pathToFileURL(resolvedPath).href
  } catch {
    return null
  }
}

export async function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith('@zos/')) {
    const mockPath = `${specifier.replace('@zos/', mockDir)}.js`
    return nextResolve(mockPath, context)
  }

  if (isRelativeImport(specifier) && context.parentURL) {
    const localPath = resolveLocalImport(specifier, context.parentURL)
    if (localPath) {
      return nextResolve(localPath, context)
    }
  }

  return nextResolve(specifier, context)
}

export async function load(url, context, nextLoad) {
  return nextLoad(url, context)
}
