import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  ACTIVE_SESSION_FILE_PATH,
  clearActiveSession,
  getActiveSession,
  migrateLegacySessions,
  saveActiveSession,
  updateActiveSession,
  updateActiveSessionPartial
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

test('saveActiveSession preserves existing startedAt unless explicit repair option is enabled', () => {
  const seedSession = createDefaultMatchState()
  const { mock } = createHmFsMock()

  withMockedHmFs(mock, () => {
    assert.equal(
      saveActiveSession(seedSession, { preserveUpdatedAt: true }),
      true
    )

    const persistedSeed = getActiveSession()
    assert.notEqual(persistedSeed, null)

    const overwriteAttempt = {
      ...seedSession,
      timing: {
        ...seedSession.timing,
        startedAt: '2030-01-01T00:00:00.000Z'
      }
    }

    assert.equal(
      saveActiveSession(overwriteAttempt, { preserveUpdatedAt: true }),
      true
    )

    const preservedSession = getActiveSession()
    assert.notEqual(preservedSession, null)
    assert.equal(
      preservedSession?.timing?.startedAt,
      persistedSeed?.timing?.startedAt
    )

    assert.equal(
      saveActiveSession(overwriteAttempt, {
        preserveUpdatedAt: true,
        allowStartTimeRepair: true
      }),
      true
    )

    const repairedSession = getActiveSession()
    assert.notEqual(repairedSession, null)
    assert.equal(repairedSession?.timing?.startedAt, '2030-01-01T00:00:00.000Z')
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

test('migrateLegacySessions derives startedAt from earliest reliable legacy timestamps', () => {
  const runtimeLegacySession = loadLegacyFixture('legacy-runtime-session.json')
  runtimeLegacySession.updatedAt = 1700000005000
  runtimeLegacySession.matchStartTime = 1700000001200
  runtimeLegacySession.startedAt = 1700000001500
  runtimeLegacySession.created_at = 1700000001000

  const { mock } = createHmFsMock({
    [LEGACY_RUNTIME_FILENAME]: JSON.stringify(runtimeLegacySession)
  })

  withMockedHmFs(mock, () => {
    const migration = migrateLegacySessions()

    assert.equal(migration.migrated, true)
    assert.equal(migration.source, 'legacy-runtime-storage')

    const loadedSession = getActiveSession()
    assert.notEqual(loadedSession, null)
    assert.equal(loadedSession?.timing?.createdAt, '2023-11-14T22:13:21.000Z')
    assert.equal(loadedSession?.timing?.startedAt, '2023-11-14T22:13:21.200Z')
  })
})

test('updateActiveSession returns null when no active session exists', () => {
  const { mock, fileStore } = createHmFsMock()

  withMockedHmFs(mock, () => {
    const updatedSession = updateActiveSession((session) => ({
      ...session,
      status: 'finished'
    }))

    assert.equal(updatedSession, null)
    assert.equal(getActiveSession(), null)
    assert.equal(fileStore.has(CANONICAL_FILENAME), false)
  })
})

test('updateActiveSession aborts without persisting when updater returns null', () => {
  const seedSession = createDefaultMatchState()
  seedSession.updatedAt = 1700000008199
  const { mock } = createHmFsMock()

  withMockedHmFs(mock, () => {
    assert.equal(
      saveActiveSession(seedSession, { preserveUpdatedAt: true }),
      true
    )

    const beforeUpdate = getActiveSession()
    const updatedSession = updateActiveSession(() => null)
    const afterUpdate = getActiveSession()

    assert.equal(updatedSession, null)
    assert.deepEqual(afterUpdate, beforeUpdate)
  })
})

test('updateActiveSession mutates only persisted snapshots, not caller references', () => {
  const seedSession = createDefaultMatchState()
  seedSession.updatedAt = 1700000008100
  const { mock } = createHmFsMock()

  withMockedHmFs(mock, () => {
    assert.equal(
      saveActiveSession(seedSession, { preserveUpdatedAt: true }),
      true
    )

    const callerSnapshot = getActiveSession()
    assert.notEqual(callerSnapshot, null)

    const updatedSession = updateActiveSession(
      (session) => {
        session.currentSet.games.teamA = 3
      },
      { preserveUpdatedAt: true }
    )

    assert.notEqual(updatedSession, null)
    assert.equal(callerSnapshot?.currentSet?.games?.teamA, 0)
    assert.equal(updatedSession?.currentSet?.games?.teamA, 3)
  })
})

test('updateActiveSession preserves persisted state when updater throws', () => {
  const seedSession = createDefaultMatchState()
  seedSession.updatedAt = 1700000008200
  const { mock } = createHmFsMock()

  withMockedHmFs(mock, () => {
    assert.equal(
      saveActiveSession(seedSession, { preserveUpdatedAt: true }),
      true
    )
    const beforeUpdate = getActiveSession()

    const updatedSession = updateActiveSession(() => {
      throw new Error('boom')
    })

    const afterUpdate = getActiveSession()

    assert.equal(updatedSession, null)
    assert.deepEqual(afterUpdate, beforeUpdate)
  })
})

test('updateActiveSession helpers apply sequential updates deterministically', () => {
  const seedSession = createDefaultMatchState()
  seedSession.updatedAt = 1700000008300
  const { mock } = createHmFsMock()

  withMockedHmFs(mock, () => {
    assert.equal(
      saveActiveSession(seedSession, { preserveUpdatedAt: true }),
      true
    )

    const firstUpdate = updateActiveSessionPartial(
      {
        currentSet: {
          number: 1,
          games: {
            teamA: 2,
            teamB: 1
          }
        }
      },
      { preserveUpdatedAt: true }
    )

    assert.notEqual(firstUpdate, null)

    const secondUpdate = updateActiveSession(
      (session) => ({
        ...session,
        currentSet: {
          ...session.currentSet,
          games: {
            ...session.currentSet.games,
            teamB: session.currentSet.games.teamB + 2
          }
        }
      }),
      { preserveUpdatedAt: true }
    )

    assert.notEqual(secondUpdate, null)
    assert.equal(secondUpdate?.currentSet?.games?.teamA, 2)
    assert.equal(secondUpdate?.currentSet?.games?.teamB, 3)
  })
})

test('updateActiveSession helpers preserve canonical schema fields and updatedAt options', () => {
  const seedSession = createDefaultMatchState()
  seedSession.updatedAt = 1700000008400
  const { mock } = createHmFsMock()

  withMockedHmFs(mock, () => {
    assert.equal(
      saveActiveSession(seedSession, { preserveUpdatedAt: true }),
      true
    )

    const preservedUpdate = updateActiveSessionPartial(
      {
        setsToPlay: 5,
        setsNeededToWin: 3
      },
      { preserveUpdatedAt: true }
    )

    assert.notEqual(preservedUpdate, null)
    assert.equal(preservedUpdate?.updatedAt, seedSession.updatedAt)
    assert.equal(preservedUpdate?.schemaVersion, seedSession.schemaVersion)

    const timestampUpdated = updateActiveSession((session) => ({
      ...session,
      setsWon: {
        teamA: 1,
        teamB: 0
      }
    }))

    assert.notEqual(timestampUpdated, null)
    assert.equal(
      Number.isInteger(timestampUpdated?.updatedAt) &&
        timestampUpdated.updatedAt >= seedSession.updatedAt,
      true
    )
    assert.equal(timestampUpdated?.schemaVersion, seedSession.schemaVersion)
  })
})

test('updateActiveSession helpers do not overwrite initialized startedAt without repair option', () => {
  const seedSession = createDefaultMatchState()
  seedSession.updatedAt = 1700000008450
  const { mock } = createHmFsMock()

  withMockedHmFs(mock, () => {
    assert.equal(
      saveActiveSession(seedSession, { preserveUpdatedAt: true }),
      true
    )

    const persistedSeed = getActiveSession()
    assert.notEqual(persistedSeed, null)

    const updatedSession = updateActiveSessionPartial(
      {
        timing: {
          ...seedSession.timing,
          startedAt: '2042-01-01T00:00:00.000Z'
        }
      },
      { preserveUpdatedAt: true }
    )

    assert.notEqual(updatedSession, null)
    assert.equal(
      updatedSession?.timing?.startedAt,
      persistedSeed?.timing?.startedAt
    )

    const repairedSession = updateActiveSessionPartial(
      {
        timing: {
          ...seedSession.timing,
          startedAt: '2042-01-01T00:00:00.000Z'
        }
      },
      {
        preserveUpdatedAt: true,
        allowStartTimeRepair: true
      }
    )

    assert.notEqual(repairedSession, null)
    assert.equal(repairedSession?.timing?.startedAt, '2042-01-01T00:00:00.000Z')
  })
})

test('updateActiveSession prevents reentrant writes inside updater callbacks', () => {
  const seedSession = createDefaultMatchState()
  seedSession.updatedAt = 1700000008500
  const { mock } = createHmFsMock()

  withMockedHmFs(mock, () => {
    assert.equal(
      saveActiveSession(seedSession, { preserveUpdatedAt: true }),
      true
    )

    let nestedResult = 'not-run'

    const outerResult = updateActiveSession(
      (session) => {
        nestedResult = updateActiveSessionPartial(
          {
            setsWon: {
              teamA: 9,
              teamB: 0
            }
          },
          { preserveUpdatedAt: true }
        )

        session.setsWon.teamA = 1
        return session
      },
      { preserveUpdatedAt: true }
    )

    assert.equal(nestedResult, null)
    assert.notEqual(outerResult, null)
    assert.equal(outerResult?.setsWon?.teamA, 1)
  })
})

test('clearActiveSession is idempotent when canonical file is absent', () => {
  const { mock } = createHmFsMock()

  withMockedHmFs(mock, () => {
    assert.equal(clearActiveSession(), true)
    assert.equal(clearActiveSession(), true)
  })
})
