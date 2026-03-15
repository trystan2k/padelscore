import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['tests/setup.js'],
    include: ['tests/unit/**/*.test.js'],
    exclude: [
      'tests/unification-regression/**',
      'tests/__mocks__/**',
      'tests/fixtures/**',
      'tests/helpers/**'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['utils/**/*.js'],
      exclude: ['utils/**/constants.js', 'utils/design-tokens.js']
    },
    testTimeout: 10000,
    hookTimeout: 10000
  }
})
