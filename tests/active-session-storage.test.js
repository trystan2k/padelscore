import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  ACTIVE_SESSION_FILE_PATH,
  clearActiveSession,
  getActiveSession,
  migrateLegacySessions,
  saveActiveSession
} from '../utils/active-session-storage.js'
import {
  createDefaultMatchState,
  STORAGE_KEY as LEGACY_ACTIVE_SESSION_STORAGE_KEY
} from '../utils/match-state-schema.js'
import { MATCH_STATE_STORAGE_KEY } from '../utils/storage.js'
import { createHmFsMock, storageKeyToFilename } from './helpers/hmfs-mock.js'

const CANONICAL_FILENAME = 'active_session.json'
const LEGACY_ACTIVE_FILENAME = storageKeyToFilename(
  LEGACY_ACTIVE_SESSION_STORAGE_KEY
)
const LEGACY_RUNTIME_FILENAME = storageKeyToFilename(MATCH_STATE_STORAGE_KEY)

const FIXTURE_DIR = resolve(process.cwd(), 'tests/fixtures/legacy-sessions')

function loadLegacyFixture(fixtureName) {
  const fixturePath = resolve(FIXTURE_DIR, fixtureName)
  return JSON.parse(readFileSync(fixturePath, 'utf8'))
}

function withMockedHmFs(mock, callback) {
  const originalHmFS = globalThis.hmFS
  globalThis.hmFS = mock

  try {
    callback()
  } finally {
    if (typeof originalHmFS === 'undefined') {
      delete globalThis.hmFS
    } else {
      globalThis.hmFS = originalHmFS
    }
  }
}

test('active-session service exposes canonical platform path', () => {
  assert.equal(ACTIVE_SESSION_FILE_PATH, '/data/active_session.json')
})

test('saveActiveSession/getActiveSession/clearActiveSession round-trip canonical payload', () => {
  const session = createDefaultMatchState()
  const { mock, fileStore } = createHmFsMock()

  withMockedHmFs(mock, () => {
    assert.equal(saveActiveSession(session), true)
    assert.equal(fileStore.has(CANONICAL_FILENAME), true)

    const loadedSession = getActiveSession()
    assert.notEqual(loadedSession, null)
    assert.equal(loadedSession.status, session.status)

    assert.equal(clearActiveSession(), true)
    assert.equal(fileStore.has(CANONICAL_FILENAME), false)
    assert.equal(getActiveSession(), null)
  })
})

test('save/get preserves UTF-8 labels including accents and emoji', () => {
  const session = createDefaultMatchState()
  session.teams = {
    teamA: { id: 'teamA', label: 'Ni\u00f1o \ud83c\udfbe' },
    teamB: { id: 'teamB', label: 'S\u00e3o Paulo \ud83d\ude0a' }
  }

  const { mock } = createHmFsMock()

  withMockedHmFs(mock, () => {
    assert.equal(saveActiveSession(session), true)
    const loadedSession = getActiveSession()

    assert.notEqual(loadedSession, null)
    assert.equal(loadedSession?.teams?.teamA?.label, 'Ni\u00f1o \ud83c\udfbe')
    assert.equal(
      loadedSession?.teams?.teamB?.label,
      'S\u00e3o Paulo \ud83d\ude0a'
    )
  })
})

test('getActiveSession returns null for corrupted canonical payload', () => {
  const { mock } = createHmFsMock({
    [CANONICAL_FILENAME]: '{bad-json'
  })

  withMockedHmFs(mock, () => {
    assert.equal(getActiveSession(), null)
  })
})

test('saveActiveSession returns false and logs warning for invalid payload', () => {
  const { mock } = createHmFsMock()
  const warnings = []
  const originalWarn = console.warn
  console.warn = (...args) => warnings.push(args)

  try {
    withMockedHmFs(mock, () => {
      assert.equal(saveActiveSession({ status: 'active' }), false)
    })
  } finally {
    console.warn = originalWarn
  }

  assert.equal(warnings.length > 0, true)
})

test('getActiveSession falls back to legacy runtime storage when canonical payload is missing', () => {
  const runtimeLegacySession = loadLegacyFixture('legacy-runtime-session.json')
  const { mock } = createHmFsMock({
    [LEGACY_RUNTIME_FILENAME]: JSON.stringify(runtimeLegacySession)
  })

  withMockedHmFs(mock, () => {
    const loadedSession = getActiveSession()

    assert.notEqual(loadedSession, null)
    assert.equal(loadedSession?.currentGame?.points?.teamA, 50)
    assert.equal(loadedSession?.setsToPlay, 3)
    assert.equal(loadedSession?.setsNeededToWin, 2)
  })
})

test('getActiveSession ignores clearly invalid legacy runtime blobs', () => {
  const invalidRuntimeBlob = {
    status: 'active',
    teamA: {
      points: 'bad-value'
    },
    teamB: {
      points: 15
    },
    currentSetStatus: {
      number: 1,
      teamAGames: 0,
      teamBGames: 0
    },
    setsWon: {
      teamA: 0,
      teamB: 0
    },
    updatedAt: 1700000010000
  }
  const { mock } = createHmFsMock({
    [LEGACY_RUNTIME_FILENAME]: JSON.stringify(invalidRuntimeBlob)
  })

  withMockedHmFs(mock, () => {
    assert.equal(getActiveSession(), null)
  })
})

test('clearActiveSession removes legacy runtime storage so stale state cannot be restored', () => {
  const runtimeLegacySession = loadLegacyFixture('legacy-runtime-session.json')
  const { mock, fileStore } = createHmFsMock({
    [LEGACY_RUNTIME_FILENAME]: JSON.stringify(runtimeLegacySession)
  })

  withMockedHmFs(mock, () => {
    const preClearSession = getActiveSession()

    assert.notEqual(preClearSession, null)
    assert.equal(fileStore.has(LEGACY_RUNTIME_FILENAME), true)

    assert.equal(clearActiveSession(), true)
    assert.equal(fileStore.has(LEGACY_RUNTIME_FILENAME), false)
    assert.equal(getActiveSession(), null)
  })
})

test('migrateLegacySessions selects newest legacy source and cleans up idempotently', () => {
  const runtimeLegacySession = loadLegacyFixture('legacy-runtime-session.json')
  const canonicalLegacySession = loadLegacyFixture(
    'legacy-canonical-session.json'
  )
  const { mock, fileStore } = createHmFsMock({
    [LEGACY_RUNTIME_FILENAME]: JSON.stringify(runtimeLegacySession),
    [LEGACY_ACTIVE_FILENAME]: JSON.stringify(canonicalLegacySession)
  })

  withMockedHmFs(mock, () => {
    const firstMigration = migrateLegacySessions()

    assert.equal(firstMigration.migrated, true)
    assert.equal(firstMigration.source, 'legacy-active-file')
    assert.equal(firstMigration.didCleanupLegacy, true)

    const loadedSession = getActiveSession()
    assert.notEqual(loadedSession, null)
    assert.equal(loadedSession?.updatedAt, canonicalLegacySession.updatedAt)
    assert.equal(loadedSession?.teams?.teamA?.label, 'Equipo Nino')

    assert.equal(fileStore.has(LEGACY_ACTIVE_FILENAME), false)
    assert.equal(fileStore.has(LEGACY_RUNTIME_FILENAME), false)

    const secondMigration = migrateLegacySessions()
    assert.equal(secondMigration.migrated, false)
    assert.equal(secondMigration.source, 'canonical')
    assert.equal(secondMigration.reason, null)
  })
})

test('migrateLegacySessions uses runtime legacy source when it is newer', () => {
  const runtimeLegacySession = loadLegacyFixture('legacy-runtime-session.json')
  runtimeLegacySession.updatedAt = 1700000005000

  const canonicalLegacySession = loadLegacyFixture(
    'legacy-canonical-session.json'
  )
  canonicalLegacySession.updatedAt = 1700000004000

  const { mock } = createHmFsMock({
    [LEGACY_RUNTIME_FILENAME]: JSON.stringify(runtimeLegacySession),
    [LEGACY_ACTIVE_FILENAME]: JSON.stringify(canonicalLegacySession)
  })

  withMockedHmFs(mock, () => {
    const migration = migrateLegacySessions()
    assert.equal(migration.migrated, true)
    assert.equal(migration.source, 'legacy-runtime-storage')

    const loadedSession = getActiveSession()
    assert.notEqual(loadedSession, null)
    assert.equal(loadedSession?.updatedAt, 1700000005000)
    assert.equal(loadedSession?.currentGame?.points?.teamA, 50)
  })
})

test('migrateLegacySessions migrates pendingPersistedMatchState from globalData and clears handoff keys', () => {
  const handoffSession = {
    ...createDefaultMatchState(),
    updatedAt: 1700000007000,
    teams: {
      teamA: { id: 'teamA', label: 'Handoff Team A' },
      teamB: { id: 'teamB', label: 'Handoff Team B' }
    }
  }
  const globalData = {
    pendingPersistedMatchState: handoffSession,
    pendingHomeMatchState: {},
    sessionHandoff: {}
  }
  const { mock, fileStore } = createHmFsMock()

  withMockedHmFs(mock, () => {
    const migration = migrateLegacySessions({ globalData })

    assert.equal(migration.migrated, true)
    assert.equal(migration.source, 'handoff-persisted')
    assert.equal(fileStore.has(CANONICAL_FILENAME), true)

    const loadedSession = getActiveSession()
    assert.notEqual(loadedSession, null)
    assert.equal(loadedSession?.updatedAt, handoffSession.updatedAt)
    assert.equal(loadedSession?.teams?.teamA?.label, 'Handoff Team A')

    assert.equal(Object.hasOwn(globalData, 'pendingPersistedMatchState'), false)
    assert.equal(Object.hasOwn(globalData, 'pendingHomeMatchState'), false)
    assert.equal(Object.hasOwn(globalData, 'sessionHandoff'), false)
  })
})

test('migrateLegacySessions prefers newer handoff state over older canonical state', () => {
  const canonicalSession = {
    ...createDefaultMatchState(),
    updatedAt: 1700000008000,
    currentSet: {
      number: 1,
      games: {
        teamA: 1,
        teamB: 0
      }
    }
  }
  const handoffSession = {
    ...createDefaultMatchState(),
    updatedAt: 1700000009000,
    currentSet: {
      number: 1,
      games: {
        teamA: 4,
        teamB: 1
      }
    }
  }
  const { mock } = createHmFsMock({
    [CANONICAL_FILENAME]: JSON.stringify(canonicalSession)
  })

  withMockedHmFs(mock, () => {
    const migration = migrateLegacySessions({
      pendingPersistedMatchState: handoffSession
    })

    assert.equal(migration.migrated, true)
    assert.equal(migration.source, 'handoff-persisted')

    const loadedSession = getActiveSession()
    assert.notEqual(loadedSession, null)
    assert.equal(loadedSession?.updatedAt, handoffSession.updatedAt)
    assert.equal(loadedSession?.currentSet?.games?.teamA, 4)
  })
})

test('clearActiveSession is idempotent when canonical file is absent', () => {
  const { mock } = createHmFsMock()

  withMockedHmFs(mock, () => {
    assert.equal(clearActiveSession(), true)
    assert.equal(clearActiveSession(), true)
  })
})
