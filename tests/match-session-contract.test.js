import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import test from 'node:test'

import {
  CURRENT_SCHEMA_VERSION,
  deserializeMatchSession,
  MATCH_STATUS,
  serializeMatchSession,
  validateMatchSession
} from '../utils/match-state-schema.js'
import {
  activeInProgressSession,
  emptyNewSession,
  finishedSessionWithHistory,
  specialCharacterTeamNamesSession
} from './fixtures/match-session-examples.js'

const SCHEMA_PATH = resolve(process.cwd(), 'docs/schema/match-session.json')

test('canonical JSON schema includes required top-level contract keys', () => {
  const schema = JSON.parse(readFileSync(SCHEMA_PATH, 'utf8'))
  const required = new Set(schema.required)

  assert.equal(required.has('teams'), true)
  assert.equal(required.has('scores'), true)
  assert.equal(required.has('settings'), true)
  assert.equal(required.has('status'), true)
  assert.equal(required.has('metadata'), true)
  assert.equal(required.has('timing'), true)
  assert.equal(required.has('setHistory'), true)
  assert.equal(required.has('schemaVersion'), true)
})

test('example sessions are schema-aligned through runtime validation', () => {
  assert.equal(validateMatchSession(emptyNewSession), true)
  assert.equal(validateMatchSession(activeInProgressSession), true)
  assert.equal(validateMatchSession(finishedSessionWithHistory), true)
  assert.equal(validateMatchSession(specialCharacterTeamNamesSession), true)
})

test('round-trip serialization preserves special-character team names', () => {
  const serialized = serializeMatchSession(specialCharacterTeamNamesSession)
  const deserialized = deserializeMatchSession(serialized)

  assert.notEqual(deserialized, null)
  assert.equal(deserialized?.teams.teamA.label, 'Niño 🎾')
  assert.equal(deserialized?.teams.teamB.label, 'São Paulo 😊')
})

test('legacy v0 payload deserializes into current canonical schema version', () => {
  const legacyV0Payload = {
    status: 'active',
    setsToPlay: 3,
    setsNeededToWin: 2,
    setsWon: {
      teamA: 0,
      teamB: 0
    },
    currentSet: {
      number: 1,
      games: {
        teamA: 0,
        teamB: 0
      }
    },
    currentGame: {
      points: {
        teamA: 0,
        teamB: 0
      }
    },
    setHistory: [],
    updatedAt: 1704067200000
  }

  const deserialized = deserializeMatchSession(JSON.stringify(legacyV0Payload))

  assert.notEqual(deserialized, null)
  assert.equal(deserialized?.schemaVersion, CURRENT_SCHEMA_VERSION)
  assert.equal(deserialized?.status, MATCH_STATUS.ACTIVE)
  assert.equal(deserialized?.metadata.matchId.startsWith('match-'), true)
  assert.equal(validateMatchSession(deserialized), true)
})

test('timing.updatedAt remains synchronized with numeric updatedAt mirror', () => {
  const serialized = serializeMatchSession(activeInProgressSession)
  const deserialized = deserializeMatchSession(serialized)

  assert.notEqual(deserialized, null)
  assert.equal(
    Date.parse(deserialized?.timing.updatedAt ?? ''),
    deserialized?.updatedAt
  )
})
