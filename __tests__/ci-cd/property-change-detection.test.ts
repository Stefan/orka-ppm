/**
 * Property Test: Conditional Pipeline Execution
 *
 * Validates: Requirements 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 7.1, 7.2, 7.3
 *
 * This test validates that the CI/CD pipeline correctly detects changes
 * and conditionally executes appropriate jobs based on the changeset.
 */

import { describe, test, expect } from '@jest/globals'

// Mock the GitHub Actions environment
const mockCore = {
  getInput: jest.fn(),
  setOutput: jest.fn(),
  setFailed: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  error: jest.fn(),
}

const mockGithub = {
  context: {
    payload: {},
    eventName: 'push',
    sha: 'abc123',
    ref: 'refs/heads/main',
    workflow: 'CI/CD Pipeline',
    action: '__run',
    actor: 'test-user',
    job: 'detect-changes',
    runNumber: 1,
    runId: 1,
  },
}

jest.mock('@actions/core', () => mockCore)
jest.mock('@actions/github', () => mockGithub)

interface ChangeDetectionResult {
  frontend: boolean
  backend: boolean
  shared: boolean
  docs: boolean
  ci: boolean
  docker: boolean
}

interface TestCase {
  name: string
  changedFiles: string[]
  expected: ChangeDetectionResult
  description: string
}

describe('Property 1: Conditional Pipeline Execution', () => {
  const testCases: TestCase[] = [
    {
      name: 'Frontend only changes',
      changedFiles: ['app/page.tsx', 'components/Button.tsx', 'package.json'],
      expected: { frontend: true, backend: false, shared: false, docs: false, ci: false, docker: false },
      description: 'Only frontend jobs should run when frontend files change'
    },
    {
      name: 'Backend only changes',
      changedFiles: ['backend/main.py', 'backend/routers/users.py', 'requirements.txt'],
      expected: { frontend: false, backend: true, shared: false, docs: false, ci: false, docker: false },
      description: 'Only backend jobs should run when backend files change'
    },
    {
      name: 'Shared changes',
      changedFiles: ['types/api.ts', 'utils/helpers.ts'],
      expected: { frontend: false, backend: false, shared: true, docs: false, ci: false, docker: false },
      description: 'Shared changes should trigger appropriate jobs'
    },
    {
      name: 'Documentation changes',
      changedFiles: ['docs/README.md', 'docs/api.md', '.kiro/specs/workflow.md'],
      expected: { frontend: false, backend: false, shared: false, docs: true, ci: false, docker: false },
      description: 'Documentation changes should be detected'
    },
    {
      name: 'CI/CD changes',
      changedFiles: ['.github/workflows/ci-cd.yml', 'scripts/deploy.sh'],
      expected: { frontend: false, backend: false, shared: false, docs: false, ci: true, docker: false },
      description: 'CI/CD infrastructure changes should be detected'
    },
    {
      name: 'Docker changes',
      changedFiles: ['Dockerfile', 'docker-compose.yml'],
      expected: { frontend: false, backend: false, shared: false, docs: false, ci: false, docker: true },
      description: 'Docker-related changes should trigger build validation'
    },
    {
      name: 'Mixed frontend and backend changes',
      changedFiles: ['app/page.tsx', 'backend/main.py', 'package.json', 'requirements.txt'],
      expected: { frontend: true, backend: true, shared: false, docs: false, ci: false, docker: false },
      description: 'Mixed changes should trigger both frontend and backend jobs'
    },
    {
      name: 'No relevant changes',
      changedFiles: ['.gitignore', 'LICENSE', 'README.md'],
      expected: { frontend: false, backend: false, shared: false, docs: false, ci: false, docker: false },
      description: 'Irrelevant changes should not trigger any jobs'
    }
  ]

  test.each(testCases)('$name: $description', ({ changedFiles, expected }) => {
    // This test validates the path patterns used in the GitHub Actions workflow
    // The actual implementation uses dorny/paths-filter which handles the pattern matching

    // Frontend patterns from workflow
    const frontendPatterns = [
      'app/**', 'components/**', 'contexts/**', 'hooks/**', 'lib/**',
      'styles/**', 'public/**', 'package.json', 'package-lock.json',
      'next.config.ts', 'postcss.config.mjs', 'tailwind.config.js',
      'tsconfig.json', 'jest.config.js', 'jest.env.js', 'jest.setup.js',
      '.eslintrc.*', 'eslint.config.mjs'
    ]

    // Backend patterns from workflow
    const backendPatterns = [
      'backend/**', 'pyproject.toml', 'pytest.ini', 'requirements*.txt',
      'Dockerfile', 'docker-compose.yml', 'docker-compose.override.yml'
    ]

    // Shared patterns from workflow
    const sharedPatterns = ['types/**', 'utils/**', 'data/**']

    // Docs patterns from workflow
    const docsPatterns = ['docs/**', '*.md', '.kiro/**']

    // CI patterns from workflow
    const ciPatterns = ['.github/**', 'scripts/**']

    // Docker patterns from workflow
    const dockerPatterns = ['Dockerfile', 'docker-compose.yml', 'docker-compose.override.yml', '.dockerignore']

    // Helper function to check if file matches any pattern
    const matchesPattern = (file: string, patterns: string[]): boolean => {
      return patterns.some(pattern => {
        if (pattern.includes('**')) {
          // Simple glob matching for ** patterns
          const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$')
          return regex.test(file)
        } else {
          // Exact match for non-glob patterns
          return file === pattern
        }
      })
    }

    // Test the change detection logic
    const frontendChanged = changedFiles.some(file =>
      matchesPattern(file, frontendPatterns)
    )
    const backendChanged = changedFiles.some(file =>
      matchesPattern(file, backendPatterns)
    )
    const sharedChanged = changedFiles.some(file =>
      matchesPattern(file, sharedPatterns)
    )
    const docsChanged = changedFiles.some(file =>
      matchesPattern(file, docsPatterns)
    )
    const ciChanged = changedFiles.some(file =>
      matchesPattern(file, ciPatterns)
    )
    const dockerChanged = changedFiles.some(file =>
      matchesPattern(file, dockerPatterns)
    )

    expect(frontendChanged).toBe(expected.frontend)
    expect(backendChanged).toBe(expected.backend)
    expect(sharedChanged).toBe(expected.shared)
    expect(docsChanged).toBe(expected.docs)
    expect(ciChanged).toBe(expected.ci)
    expect(dockerChanged).toBe(expected.docker)
  })

  test('Change detection patterns are comprehensive', () => {
    // This test ensures all important file types are covered by the change detection

    const importantFiles = [
      // Frontend
      'app/page.tsx', 'components/Button.tsx', 'lib/api.ts', 'hooks/useAuth.ts',
      'styles/globals.css', 'public/favicon.ico', 'package.json', 'tsconfig.json',
      'jest.config.js', 'eslint.config.mjs',

      // Backend
      'backend/main.py', 'backend/routers/users.py', 'backend/models/user.py',
      'requirements.txt', 'pyproject.toml', 'pytest.ini',

      // Shared
      'types/api.ts', 'utils/helpers.ts', 'data/sample.json',

      // Docs
      'docs/README.md', 'docs/api.md', '.kiro/specs/workflow.md',

      // CI
      '.github/workflows/ci-cd.yml', 'scripts/deploy.sh',

      // Docker
      'Dockerfile', 'docker-compose.yml', '.dockerignore'
    ]

    // Ensure each important file is covered by at least one pattern
    for (const file of importantFiles) {
      const isCovered = [
        // Frontend patterns
        ['app/**', 'components/**', 'contexts/**', 'hooks/**', 'lib/**', 'styles/**', 'public/**',
         'package.json', 'package-lock.json', 'next.config.ts', 'postcss.config.mjs', 'tailwind.config.js',
         'tsconfig.json', 'jest.config.js', 'jest.env.js', 'jest.setup.js', '.eslintrc.*', 'eslint.config.mjs'],

        // Backend patterns
        ['backend/**', 'pyproject.toml', 'pytest.ini', 'requirements*.txt',
         'Dockerfile', 'docker-compose.yml', 'docker-compose.override.yml'],

        // Shared patterns
        ['types/**', 'utils/**', 'data/**'],

        // Docs patterns
        ['docs/**', '*.md', '.kiro/**'],

        // CI patterns
        ['.github/**', 'scripts/**'],

        // Docker patterns
        ['Dockerfile', 'docker-compose.yml', 'docker-compose.override.yml', '.dockerignore']
      ].some(patterns => {
        return patterns.some(pattern => {
          if (pattern.includes('**')) {
            const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$')
            return regex.test(file)
          } else {
            return file === pattern
          }
        })
      })

      expect(isCovered).toBe(true)
    }
  })

  test('Change detection prevents unnecessary job execution', () => {
    // This test validates that jobs only run when relevant changes occur

    const scenarios = [
      {
        name: 'Only README change',
        changedFiles: ['README.md'],
        shouldRunFrontend: false,
        shouldRunBackend: false,
        shouldRunShared: false
      },
      {
        name: 'Only package.json change',
        changedFiles: ['package.json'],
        shouldRunFrontend: true,
        shouldRunBackend: false,
        shouldRunShared: false
      },
      {
        name: 'Only backend router change',
        changedFiles: ['backend/routers/users.py'],
        shouldRunFrontend: false,
        shouldRunBackend: true,
        shouldRunShared: false
      }
    ]

    for (const scenario of scenarios) {
      const frontendPatterns = [
        'app/**', 'components/**', 'contexts/**', 'hooks/**', 'lib/**',
        'styles/**', 'public/**', 'package.json', 'package-lock.json',
        'next.config.ts', 'postcss.config.mjs', 'tailwind.config.js',
        'tsconfig.json', 'jest.config.js', 'jest.env.js', 'jest.setup.js',
        '.eslintrc.*', 'eslint.config.mjs'
      ]

      const backendPatterns = [
        'backend/**', 'pyproject.toml', 'pytest.ini', 'requirements*.txt',
        'Dockerfile', 'docker-compose.yml', 'docker-compose.override.yml'
      ]

      const frontendChanged = scenario.changedFiles.some(file =>
        frontendPatterns.some(pattern => {
          if (pattern.includes('**')) {
            const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$')
            return regex.test(file)
          } else {
            return file === pattern
          }
        })
      )

      const backendChanged = scenario.changedFiles.some(file =>
        backendPatterns.some(pattern => {
          if (pattern.includes('**')) {
            const regex = new RegExp('^' + pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '$')
            return regex.test(file)
          } else {
            return file === pattern
          }
        })
      )

      expect(frontendChanged).toBe(scenario.shouldRunFrontend)
      expect(backendChanged).toBe(scenario.shouldRunBackend)
    }
  })
})