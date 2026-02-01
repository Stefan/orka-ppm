/**
 * Jest config for __tests__ (frontend unit/integration)
 * Enterprise Test Strategy - Task 1.2
 * Use from repo root: jest --config __tests__/jest.config.js
 * Root jest.config.js is the default; this file provides 80% coverage thresholds for CI.
 */

const nextJest = require('next/jest');
const createJestConfig = nextJest({ dir: './' });

const customJestConfig = {
  displayName: 'frontend',
  testMatch: [
    '<rootDir>/__tests__/**/*.test.{ts,tsx}',
    '<rootDir>/__tests__/**/*.property.test.{ts,tsx}',
    '<rootDir>/__tests__/**/*.integration.test.{ts,tsx}',
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/$1' },
};

module.exports = createJestConfig(customJestConfig);
