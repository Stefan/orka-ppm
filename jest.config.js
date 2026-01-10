const nextJest = require('next/jest')

const createJestConfig = nextJest({
  // Provide the path to your Next.js app to load next.config.js and .env files
  dir: './',
})

// Add any custom config to be passed to Jest
const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: ['<rootDir>/.next/', '<rootDir>/node_modules/', '<rootDir>/frontend/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(react-markdown|remark-gfm|rehype-highlight|unified|bail|is-plain-obj|trough|vfile|unist-util-stringify-position|mdast-util-from-markdown|mdast-util-to-markdown|micromark|decode-named-character-reference|character-entities|mdast-util-to-string|unist-util-visit|unist-util-is|unist-util-visit-parents|mdast-util-definitions|mdast-util-gfm|mdast-util-gfm-table|mdast-util-gfm-strikethrough|mdast-util-gfm-task-list-item|mdast-util-gfm-autolink-literal|mdast-util-gfm-footnote|micromark-extension-gfm|micromark-util-combine-extensions|micromark-extension-gfm-table|micromark-extension-gfm-strikethrough|micromark-extension-gfm-task-list-item|micromark-extension-gfm-autolink-literal|micromark-extension-gfm-footnote|micromark-extension-gfm-tagfilter|hast-util-to-jsx-runtime|hast-util-whitespace|property-information|hast-util-parse-selector|hastscript|comma-separated-tokens|space-separated-tokens|web-namespaces|fast-check)/)'
  ],
  
  // Property-based testing configuration
  testTimeout: 30000, // 30 seconds for property tests
  maxWorkers: process.env.CI ? 2 : 4,
  
  // Jest globals configuration
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  
  // Environment variables for tests
  setupFiles: ['<rootDir>/jest.env.js'],
  
  // Coverage configuration
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'hooks/**/*.{ts,tsx}',
    'app/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/*.stories.{ts,tsx}',
    '!**/__tests__/**',
    '!**/node_modules/**'
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Test categorization - simplified for now
  testMatch: [
    '<rootDir>/**/*.test.{ts,tsx}',
    '<rootDir>/**/*.property.test.{ts,tsx}',
    '<rootDir>/**/*.integration.test.{ts,tsx}',
    '<rootDir>/**/*.a11y.test.{ts,tsx}',
    '<rootDir>/**/*.perf.test.{ts,tsx}'
  ]
}

// createJestConfig is exported this way to ensure that next/jest can load the Next.js config which is async
module.exports = createJestConfig(customJestConfig)