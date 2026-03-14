import assert from 'node:assert/strict'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'

const SUPPORTED_FAMILIES = ['w390-s', 'w454-r', 'w466-r', 'w480-r']

function getFamilyAssetDir(screenFamily) {
  return path.join(process.cwd(), 'assets', `gt.${screenFamily}`)
}

test('app.json targets the supported screen family matrix', async () => {
  const appConfigPath = path.join(process.cwd(), 'app.json')
  const appConfig = JSON.parse(await readFile(appConfigPath, 'utf8'))
  const platforms = appConfig?.targets?.gt?.platforms ?? []
  const resolvedFamilies = platforms
    .map((platform) => `${platform?.sr}-${platform?.st}`)
    .sort()

  assert.deepEqual(resolvedFamilies, [...SUPPORTED_FAMILIES].sort())
})

test('family asset folders stay in sync across supported screen families', async () => {
  const assetEntriesByFamily = await Promise.all(
    SUPPORTED_FAMILIES.map(async (screenFamily) => {
      const assetDir = getFamilyAssetDir(screenFamily)
      const fileNames = (await readdir(assetDir)).sort()
      return [screenFamily, fileNames]
    })
  )

  const assetMap = new Map(assetEntriesByFamily)
  const baselineFiles = assetMap.get('w390-s')

  assert.ok(Array.isArray(baselineFiles))
  assert.equal(baselineFiles.length > 0, true)

  SUPPORTED_FAMILIES.forEach((screenFamily) => {
    assert.deepEqual(
      assetMap.get(screenFamily),
      baselineFiles,
      `${screenFamily} should expose the same asset file set as w390-s`
    )
  })
})
