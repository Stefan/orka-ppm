/**
 * Unit Tests for GitignoreUpdater
 * 
 * These tests verify specific examples and edge cases for the GitignoreUpdater component.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GitignoreUpdater } from '../GitignoreUpdater';

describe('GitignoreUpdater - Unit Tests', () => {
  let tempDir: string;
  let gitignorePath: string;

  beforeEach(() => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitignore-test-'));
    gitignorePath = path.join(tempDir, '.gitignore');
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('readGitignore', () => {
    it('should read existing .gitignore file', () => {
      const content = '*.log\nnode_modules/\n# Comment\n';
      fs.writeFileSync(gitignorePath, content, 'utf-8');

      const updater = new GitignoreUpdater(tempDir);
      const lines = updater.readGitignore();

      expect(lines).toEqual(['*.log', 'node_modules/', '# Comment', '']);
    });

    it('should return empty array for non-existent .gitignore', () => {
      const updater = new GitignoreUpdater(tempDir);
      const lines = updater.readGitignore();

      expect(lines).toEqual([]);
    });

    it('should handle empty .gitignore file', () => {
      fs.writeFileSync(gitignorePath, '', 'utf-8');

      const updater = new GitignoreUpdater(tempDir);
      const lines = updater.readGitignore();

      expect(lines).toEqual(['']);
    });
  });

  describe('addPatterns', () => {
    it('should add new patterns with comment', () => {
      const updater = new GitignoreUpdater(tempDir);
      updater.readGitignore();

      updater.addPatterns(['*.log', '*.tmp'], 'Temporary files');
      const lines = updater.getLines();

      expect(lines).toContain('# Temporary files');
      expect(lines).toContain('*.log');
      expect(lines).toContain('*.tmp');
    });

    it('should preserve existing entries when adding patterns', () => {
      fs.writeFileSync(gitignorePath, 'node_modules/\n*.env\n', 'utf-8');

      const updater = new GitignoreUpdater(tempDir);
      updater.readGitignore();

      updater.addPatterns(['*.log'], 'Logs');
      const lines = updater.getLines();

      expect(lines).toContain('node_modules/');
      expect(lines).toContain('*.env');
      expect(lines).toContain('*.log');
    });

    it('should not duplicate existing patterns', () => {
      fs.writeFileSync(gitignorePath, '*.log\n', 'utf-8');

      const updater = new GitignoreUpdater(tempDir);
      updater.readGitignore();

      updater.addPatterns(['*.log', '*.tmp'], 'Temporary files');
      const lines = updater.getLines();

      const logCount = lines.filter(line => line.trim() === '*.log').length;
      expect(logCount).toBe(1);
      expect(lines).toContain('*.tmp');
    });

    it('should add blank line before new section if file does not end with blank line', () => {
      fs.writeFileSync(gitignorePath, 'node_modules/', 'utf-8');

      const updater = new GitignoreUpdater(tempDir);
      updater.readGitignore();

      updater.addPatterns(['*.log'], 'Logs');
      const lines = updater.getLines();

      const commentIndex = lines.indexOf('# Logs');
      expect(commentIndex).toBeGreaterThan(0);
      expect(lines[commentIndex - 1]).toBe('');
    });

    it('should not add patterns if all already exist', () => {
      fs.writeFileSync(gitignorePath, '*.log\n*.tmp\n', 'utf-8');

      const updater = new GitignoreUpdater(tempDir);
      updater.readGitignore();

      const linesBefore = updater.getLines().length;
      updater.addPatterns(['*.log', '*.tmp'], 'Temporary files');
      const linesAfter = updater.getLines().length;

      expect(linesAfter).toBe(linesBefore);
    });

    it('should handle multiple addPatterns calls', () => {
      const updater = new GitignoreUpdater(tempDir);
      updater.readGitignore();

      updater.addPatterns(['*.log'], 'Logs');
      updater.addPatterns(['*.tmp'], 'Temporary');
      updater.addPatterns(['*.bak'], 'Backups');

      const lines = updater.getLines();

      expect(lines).toContain('# Logs');
      expect(lines).toContain('*.log');
      expect(lines).toContain('# Temporary');
      expect(lines).toContain('*.tmp');
      expect(lines).toContain('# Backups');
      expect(lines).toContain('*.bak');
    });
  });

  describe('validateSyntax', () => {
    it('should validate simple patterns', () => {
      const updater = new GitignoreUpdater(tempDir);
      fs.writeFileSync(gitignorePath, '*.log\nnode_modules/\n*.tmp\n', 'utf-8');
      updater.readGitignore();

      expect(updater.validateSyntax()).toBe(true);
    });

    it('should validate comments and empty lines', () => {
      const updater = new GitignoreUpdater(tempDir);
      fs.writeFileSync(gitignorePath, '# Comment\n\n*.log\n# Another comment\n', 'utf-8');
      updater.readGitignore();

      expect(updater.validateSyntax()).toBe(true);
    });

    it('should validate negation patterns', () => {
      const updater = new GitignoreUpdater(tempDir);
      fs.writeFileSync(gitignorePath, '*.log\n!important.log\n', 'utf-8');
      updater.readGitignore();

      expect(updater.validateSyntax()).toBe(true);
    });

    it('should validate wildcard patterns', () => {
      const updater = new GitignoreUpdater(tempDir);
      fs.writeFileSync(gitignorePath, '**/*.log\n**/node_modules/\ntest_*.json\n', 'utf-8');
      updater.readGitignore();

      expect(updater.validateSyntax()).toBe(true);
    });

    it('should reject patterns with null bytes', () => {
      const updater = new GitignoreUpdater(tempDir);
      fs.writeFileSync(gitignorePath, 'test\0file.log\n', 'utf-8');
      updater.readGitignore();

      expect(updater.validateSyntax()).toBe(false);
    });

    it('should accept patterns with unmatched opening bracket', () => {
      const updater = new GitignoreUpdater(tempDir);
      fs.writeFileSync(gitignorePath, '[abc\n', 'utf-8');
      updater.readGitignore();

      // Gitignore is permissive - Git itself handles pattern matching
      expect(updater.validateSyntax()).toBe(true);
    });

    it('should accept patterns with unmatched closing bracket', () => {
      const updater = new GitignoreUpdater(tempDir);
      fs.writeFileSync(gitignorePath, 'abc]\n', 'utf-8');
      updater.readGitignore();

      // Gitignore is permissive - Git itself handles pattern matching
      expect(updater.validateSyntax()).toBe(true);
    });

    it('should validate patterns with matched brackets', () => {
      const updater = new GitignoreUpdater(tempDir);
      fs.writeFileSync(gitignorePath, '[abc].log\ntest[0-9].txt\n', 'utf-8');
      updater.readGitignore();

      expect(updater.validateSyntax()).toBe(true);
    });
  });

  describe('writeGitignore', () => {
    it('should write patterns to .gitignore file', () => {
      const updater = new GitignoreUpdater(tempDir);
      updater.readGitignore();

      updater.addPatterns(['*.log', '*.tmp'], 'Temporary files');
      updater.writeGitignore();

      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toContain('# Temporary files');
      expect(content).toContain('*.log');
      expect(content).toContain('*.tmp');
    });

    it('should create backup before writing', () => {
      fs.writeFileSync(gitignorePath, 'original content\n', 'utf-8');

      const updater = new GitignoreUpdater(tempDir);
      updater.readGitignore();
      updater.addPatterns(['*.log'], 'Logs');
      updater.writeGitignore();

      const backupPath = `${gitignorePath}.backup`;
      expect(fs.existsSync(backupPath)).toBe(true);

      const backupContent = fs.readFileSync(backupPath, 'utf-8');
      expect(backupContent).toBe('original content\n');
    });

    it('should not throw error for bracket patterns', () => {
      const updater = new GitignoreUpdater(tempDir);
      updater.readGitignore();

      // Gitignore is permissive - these patterns are accepted
      expect(() => {
        updater.writeGitignore(['[invalid']);
      }).not.toThrow();
    });

    it('should write patterns even with brackets', () => {
      fs.writeFileSync(gitignorePath, 'valid content\n', 'utf-8');

      const updater = new GitignoreUpdater(tempDir);
      updater.readGitignore();

      // Gitignore is permissive - bracket patterns are accepted
      updater.writeGitignore(['[invalid']);

      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toContain('[invalid');
    });

    it('should write custom lines when provided', () => {
      const updater = new GitignoreUpdater(tempDir);
      updater.writeGitignore(['*.log', '*.tmp', '# Comment']);

      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toContain('*.log');
      expect(content).toContain('*.tmp');
      expect(content).toContain('# Comment');
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete workflow: read, add, validate, write', () => {
      // Setup: Create initial .gitignore
      fs.writeFileSync(gitignorePath, 'node_modules/\n.env\n', 'utf-8');

      // Read existing content
      const updater = new GitignoreUpdater(tempDir);
      updater.readGitignore();

      // Add temporary file patterns
      updater.addPatterns([
        'TASK_*_SUMMARY.md',
        'CHECKPOINT_*_REPORT.md',
        '*.log'
      ], 'Temporary task summaries and logs');

      // Add performance patterns
      updater.addPatterns([
        'DASHBOARD_*.md',
        'BUNDLE_*.md',
        'PERFORMANCE_*.md'
      ], 'Performance investigation files');

      // Validate
      expect(updater.validateSyntax()).toBe(true);

      // Write
      updater.writeGitignore();

      // Verify
      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toContain('node_modules/');
      expect(content).toContain('.env');
      expect(content).toContain('# Temporary task summaries and logs');
      expect(content).toContain('TASK_*_SUMMARY.md');
      expect(content).toContain('# Performance investigation files');
      expect(content).toContain('DASHBOARD_*.md');
    });

    it('should handle empty initial .gitignore', () => {
      const updater = new GitignoreUpdater(tempDir);
      updater.readGitignore();

      updater.addPatterns(['*.log', '*.tmp'], 'Temporary files');
      updater.writeGitignore();

      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toContain('# Temporary files');
      expect(content).toContain('*.log');
      expect(content).toContain('*.tmp');
    });

    it('should preserve complex existing patterns', () => {
      const existingContent = `# Dependencies
node_modules/
*.pyc

# Build
dist/
build/

# Environment
.env*
!.env.example
`;
      fs.writeFileSync(gitignorePath, existingContent, 'utf-8');

      const updater = new GitignoreUpdater(tempDir);
      updater.readGitignore();
      updater.addPatterns(['*.log'], 'Logs');
      updater.writeGitignore();

      const content = fs.readFileSync(gitignorePath, 'utf-8');
      expect(content).toContain('# Dependencies');
      expect(content).toContain('node_modules/');
      expect(content).toContain('# Build');
      expect(content).toContain('dist/');
      expect(content).toContain('!.env.example');
      expect(content).toContain('# Logs');
      expect(content).toContain('*.log');
    });
  });
});
