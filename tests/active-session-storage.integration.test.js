import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  getActiveSession,
  saveActiveSession
} from '../utils/active-session-storage.js'
import {
  clearMatchHistory,
  loadMatchHistory,
  saveMatchToHistory
} from '../utils/match-history-storage.js'
import {
  createDefaultMatchState,
  STORAGE_KEY as LEGACY_ACTIVE_SESSION_STORAGE_KEY
} from '../utils/match-state-schema.js'
import { MATCH_STATE_STORAGE_KEY } from '../utils/storage.js'
import { createHmFsMock, storageKeyToFilename } from './helpers/hmfs-mock.js'
import { toProjectFileUrl } from './helpers/project-paths.js'

const LEGACY_ACTIVE_FILENAME = storageKeyToFilename(
  LEGACY_ACTIVE_SESSION_STORAGE_KEY
)
const LEGACY_RUNTIME_FILENAME = storageKeyToFilename(MATCH_STATE_STORAGE_KEY)
const CANONICAL_FILENAME = 'active_session.json'

const FIXTURE_DIR = resolve(process.cwd(), 'tests/fixtures/legacy-sessions')

let appImportCounter = 0

function loadLegacyFixture(fixtureName) {
  const fixturePath = resolve(FIXTURE_DIR, fixtureName)
  return JSON.parse(readFileSync(fixturePath, 'utf8'))
}

async function loadAppDefinition() {
  const originalApp = globalThis.App
  let capturedDefinition = null

  globalThis.App = (definition) => {
    capturedDefinition = definition
  }

  const moduleUrl = toProjectFileUrl('app.js')
  moduleUrl.search = `pad54=${Date.now()}-${appImportCounter}`
  appImportCounter += 1

  try {
    await import(moduleUrl.href)
  } finally {
    if (typeof originalApp === 'undefined') {
      delete globalThis.App
    } else {
      globalThis.App = originalApp
    }
  }

  if (!capturedDefinition) {
    throw new Error('App definition was not registered by app.js.')
  }

  return capturedDefinition
}

test('app startup migration is one-time and idempotent per app lifecycle', async () => {
  const runtimeLegacySession = loadLegacyFixture('legacy-runtime-session.json')
  const { mock, fileStore } = createHmFsMock({
    [LEGACY_RUNTIME_FILENAME]: JSON.stringify(runtimeLegacySession)
  })

  const originalHmFS = globalThis.hmFS
  const originalHmApp = globalThis.hmApp

  globalThis.hmFS = mock
  globalThis.hmApp = {
    setScreenKeep() {}
  }

  try {
    const app = await loadAppDefinition()

    app.onCreate.call(app, {})
    const migratedSession = getActiveSession()

    assert.notEqual(migratedSession, null)
    assert.equal(migratedSession?.updatedAt, runtimeLegacySession.updatedAt)
    assert.equal(migratedSession?.currentGame?.points?.teamA, 50)
    assert.equal(fileStore.has(CANONICAL_FILENAME), true)
    assert.equal(fileStore.has(LEGACY_RUNTIME_FILENAME), false)

    app.globalData.__migrationSentinel = {
      status: 'active',
      updatedAt: 1700000009999
    }

    app.onCreate.call(app, {})
    const secondPassSession = getActiveSession()
    assert.deepEqual(secondPassSession, migratedSession)
    assert.equal(fileStore.has(LEGACY_ACTIVE_FILENAME), false)
    assert.equal(
      app.globalData.__migrationSentinel?.updatedAt,
      1700000009999,
      'startup migration should execute once per app lifecycle'
    )
  } finally {
    if (typeof originalHmFS === 'undefined') {
      delete globalThis.hmFS
    } else {
      globalThis.hmFS = originalHmFS
    }

    if (typeof originalHmApp === 'undefined') {
      delete globalThis.hmApp
    } else {
      globalThis.hmApp = originalHmApp
    }
  }
})

test('startup migration derives and preserves timing.startedAt across later saves', async () => {
  const runtimeLegacySession = loadLegacyFixture('legacy-runtime-session.json')
  runtimeLegacySession.created_at = 1700000000000
  runtimeLegacySession.matchStartTime = 1700000000100

  const { mock } = createHmFsMock({
    [LEGACY_RUNTIME_FILENAME]: JSON.stringify(runtimeLegacySession)
  })

  const originalHmFS = globalThis.hmFS
  const originalHmApp = globalThis.hmApp

  globalThis.hmFS = mock
  globalThis.hmApp = {
    setScreenKeep() {}
  }

  try {
    const app = await loadAppDefinition()
    app.onCreate.call(app, {})

    const migratedSession = getActiveSession()
    assert.notEqual(migratedSession, null)
    assert.equal(migratedSession?.timing?.startedAt, '2023-11-14T22:13:20.100Z')

    assert.equal(
      saveActiveSession(
        {
          ...migratedSession,
          timing: {
            ...migratedSession.timing,
            startedAt: '2030-01-01T00:00:00.000Z'
          }
        },
        { preserveUpdatedAt: true }
      ),
      true
    )

    const persistedAfterSave = getActiveSession()
    assert.notEqual(persistedAfterSave, null)
    assert.equal(
      persistedAfterSave?.timing?.startedAt,
      migratedSession?.timing?.startedAt
    )
  } finally {
    if (typeof originalHmFS === 'undefined') {
      delete globalThis.hmFS
    } else {
      globalThis.hmFS = originalHmFS
    }

    if (typeof originalHmApp === 'undefined') {
      delete globalThis.hmApp
    } else {
      globalThis.hmApp = originalHmApp
    }
  }
})

test('canonical active session payload remains compatible with Task 29 history storage', () => {
  const { mock } = createHmFsMock()
  const originalHmFS = globalThis.hmFS

  globalThis.hmFS = mock

  try {
    const finishedSession = {
      ...createDefaultMatchState(),
      status: 'finished',
      setsWon: {
        teamA: 2,
        teamB: 1
      },
      setHistory: [
        { setNumber: 1, teamAGames: 6, teamBGames: 4 },
        { setNumber: 2, teamAGames: 3, teamBGames: 6 },
        { setNumber: 3, teamAGames: 6, teamBGames: 2 }
      ],
      teams: {
        teamA: { id: 'teamA', label: 'Team Alpha' },
        teamB: { id: 'teamB', label: 'Team Beta' }
      },
      completedAt: 1700000009000,
      updatedAt: 1700000009000
    }

    assert.equal(
      saveActiveSession(finishedSession, { preserveUpdatedAt: true }),
      true
    )
    const persistedSession = getActiveSession()

    assert.notEqual(persistedSession, null)
    assert.equal(saveMatchToHistory(persistedSession), true)

    const history = loadMatchHistory()
    assert.equal(history.length, 1)
    assert.equal(history[0].teamALabel, 'Team Alpha')
    assert.equal(history[0].teamBLabel, 'Team Beta')
    assert.equal(history[0].setsWonTeamA, 2)
    assert.equal(history[0].setsWonTeamB, 1)

    assert.equal(clearMatchHistory(), true)
  } finally {
    if (typeof originalHmFS === 'undefined') {
      delete globalThis.hmFS
    } else {
      globalThis.hmFS = originalHmFS
    }
  }
})
