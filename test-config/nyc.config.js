/**
 * NYC (Istanbul) coverage configuration for frontend tests
 * Enterprise Test Strategy - Task 1.2
 * Requirements: 4.2, 4.4, 5.2
 *
 * Use with: jest --coverage (Jest uses its own coverage; this is for standalone nyc if needed)
 */

module.exports = {
  all: true,
  include: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'contexts/**/*.{ts,tsx}',
  ],
  exclude: [
    '**/*.d.ts',
    '**/*.stories.{ts,tsx}',
    '**/__tests__/**',
    '**/node_modules/**',
    '**/.next/**',
    '**/coverage/**',
  ],
  reporter: ['text', 'text-summary', 'html', 'lcov'],
  'report-dir': 'coverage',
  'check-coverage': true,
  branches: 80,
  functions: 80,
  lines: 80,
  statements: 80,
  watermarks: {
    branches: [70, 80],
    functions: [70, 80],
    lines: [70, 80],
    statements: [70, 80],
  },
};
