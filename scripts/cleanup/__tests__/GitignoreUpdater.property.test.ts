/**
 * Property-Based Tests for GitignoreUpdater
 * 
 * These tests verify universal properties that should hold true across all inputs
 * using property-based testing with fast-check.
 */

import fc from 'fast-check';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { GitignoreUpdater } from '../GitignoreUpdater';

describe('GitignoreUpdater - Property-Based Tests', () => {
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

  /**
   * Generator for valid gitignore patterns
   */
  const validPatternArb = fc.oneof(
    // Simple patterns
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `*.${s}`),
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}/`),
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}.*`),
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `*_${s}.md`),
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}_*.log`),
    // Negation patterns
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `!${s}.md`),
    // Directory patterns
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}/**`),
    fc.string({ minLength: 1, maxLength: 20 }).map(s => `**/${s}`),
    // Specific files
    fc.constantFrom(
      'TASK_*_SUMMARY.md',
      'CHECKPOINT_*_REPORT.md',
      '*.log',
      'test-results.json',
      'DASHBOARD_*.md',
      'BUNDLE_*.md'
    )
  );

  /**
   * Generator for pattern arrays
   */
  const patternArrayArb = fc.array(validPatternArb, { minLength: 1, maxLength: 20 });

  /**
   * Generator for comments
   */
  const commentArb = fc.string({ minLength: 1, maxLength: 100 }).map(s => 
    s.replace(/\n/g, ' ').trim() || 'Comment'
  );

  /**
   * Generator for existing gitignore content
   */
  const existingGitignoreArb = fc.array(
    fc.oneof(
      validPatternArb,
      commentArb.map(c => `# ${c}`),
      fc.constant('')
    ),
    { minLength: 0, maxLength: 50 }
  );

  // Feature: project-cleanup, Property 12: Gitignore Pattern Addition
  describe('Property 12: Gitignore Pattern Addition', () => {
    it('should preserve all existing entries when adding new patterns', () => {
      fc.assert(
        fc.property(
          existingGitignoreArb,
          patternArrayArb,
          commentArb,
          (existingLines, newPatterns, comment) => {
            // Setup: Create gitignore with existing content
            fs.writeFileSync(gitignorePath, existingLines.join('\n'), 'utf-8');
            
            const updater = new GitignoreUpdater(tempDir);
            updater.readGitignore();
            
            // Store original content
            const originalLines = [...existingLines];
            
            // Action: Add new patterns
            updater.addPatterns(newPatterns, comment);
            const resultLines = updater.getLines();
            
            // Property: All original lines should still be present
            for (const originalLine of originalLines) {
              expect(resultLines).toContain(originalLine);
            }
            
            // Property: Original lines should appear in the same order
            let originalIndex = 0;
            for (const line of resultLines) {
              if (originalIndex < originalLines.length && line === originalLines[originalIndex]) {
                originalIndex++;
              }
            }
            expect(originalIndex).toBe(originalLines.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add all new patterns that do not already exist', () => {
      fc.assert(
        fc.property(
          existingGitignoreArb,
          patternArrayArb,
          commentArb,
          (existingLines, newPatterns, comment) => {
            // Setup: Create gitignore with existing content
            fs.writeFileSync(gitignorePath, existingLines.join('\n'), 'utf-8');
            
            const updater = new GitignoreUpdater(tempDir);
            updater.readGitignore();
            
            // Determine which patterns are truly new (after trimming)
            const existingPatterns = new Set(existingLines.map(line => line.trim()));
            const trimmedNewPatterns = newPatterns.map(p => p.trim()).filter(p => p.length > 0);
            const expectedNewPatterns = trimmedNewPatterns.filter(p => !existingPatterns.has(p));
            
            // Action: Add new patterns
            updater.addPatterns(newPatterns, comment);
            const resultLines = updater.getLines();
            
            // Property: All new patterns should be present in the result (after trimming)
            for (const pattern of expectedNewPatterns) {
              expect(resultLines).toContain(pattern);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should add explanatory comments for each pattern group', () => {
      fc.assert(
        fc.property(
          existingGitignoreArb,
          patternArrayArb,
          commentArb,
          (existingLines, newPatterns, comment) => {
            // Setup: Create gitignore with existing content
            fs.writeFileSync(gitignorePath, existingLines.join('\n'), 'utf-8');
            
            const updater = new GitignoreUpdater(tempDir);
            updater.readGitignore();
            
            // Determine if there are truly new patterns
            const existingPatterns = new Set(existingLines.map(line => line.trim()));
            const hasNewPatterns = newPatterns.some(p => !existingPatterns.has(p.trim()) && p.trim().length > 0);
            
            // Action: Add new patterns
            updater.addPatterns(newPatterns, comment);
            const resultLines = updater.getLines();
            
            // Property: If new patterns were added, the comment should be present
            if (hasNewPatterns) {
              const commentLine = `# ${comment}`;
              expect(resultLines).toContain(commentLine);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should not duplicate patterns that already exist', () => {
      fc.assert(
        fc.property(
          patternArrayArb,
          commentArb,
          (patterns, comment) => {
            // Setup: Create gitignore with some patterns (trimmed and deduplicated)
            const trimmedPatterns = [...new Set(patterns.map(p => p.trim()).filter(p => p.length > 0))];
            fs.writeFileSync(gitignorePath, trimmedPatterns.join('\n'), 'utf-8');
            
            const updater = new GitignoreUpdater(tempDir);
            updater.readGitignore();
            
            // Action: Try to add the same patterns again
            updater.addPatterns(patterns, comment);
            const resultLines = updater.getLines();
            
            // Property: Each unique pattern should appear exactly once (after trimming)
            for (const pattern of trimmedPatterns) {
              const count = resultLines.filter(line => line.trim() === pattern).length;
              expect(count).toBe(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain proper formatting with blank lines and comments', () => {
      fc.assert(
        fc.property(
          existingGitignoreArb,
          patternArrayArb,
          commentArb,
          (existingLines, newPatterns, comment) => {
            // Setup: Create gitignore with existing content
            fs.writeFileSync(gitignorePath, existingLines.join('\n'), 'utf-8');
            
            const updater = new GitignoreUpdater(tempDir);
            updater.readGitignore();
            
            // Determine if there are truly new patterns
            const existingPatterns = new Set(existingLines.map(line => line.trim()));
            const hasNewPatterns = newPatterns.some(p => !existingPatterns.has(p.trim()) && p.trim().length > 0);
            
            // Action: Add new patterns
            updater.addPatterns(newPatterns, comment);
            const resultLines = updater.getLines();
            
            if (hasNewPatterns && existingLines.length > 0) {
              // Property: There should be a blank line before the new section
              const commentLine = `# ${comment}`;
              const commentIndex = resultLines.indexOf(commentLine);
              
              if (commentIndex > 0) {
                // Check if there's a blank line before the comment
                // (or if the previous line is already blank)
                const previousLine = resultLines[commentIndex - 1];
                expect(previousLine.trim()).toBe('');
              }
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle multiple addPatterns calls correctly', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.tuple(patternArrayArb, commentArb),
            { minLength: 1, maxLength: 5 }
          ),
          (patternGroups) => {
            // Setup: Create empty gitignore
            fs.writeFileSync(gitignorePath, '', 'utf-8');
            
            const updater = new GitignoreUpdater(tempDir);
            updater.readGitignore();
            
            // Action: Add multiple pattern groups
            const allPatterns: string[] = [];
            for (const [patterns, comment] of patternGroups) {
              updater.addPatterns(patterns, comment);
              // Store trimmed patterns
              allPatterns.push(...patterns.map(p => p.trim()).filter(p => p.length > 0));
            }
            
            const resultLines = updater.getLines();
            
            // Property: All unique patterns should be present (after trimming)
            const uniquePatterns = [...new Set(allPatterns)];
            for (const pattern of uniquePatterns) {
              expect(resultLines).toContain(pattern);
            }
            
            // Property: No pattern should be duplicated
            for (const pattern of uniquePatterns) {
              const count = resultLines.filter(line => line.trim() === pattern).length;
              expect(count).toBe(1);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  // Feature: project-cleanup, Property 13: Gitignore Syntax Validity
  describe('Property 13: Gitignore Syntax Validity', () => {
    it('should validate syntax before writing to file', () => {
      fc.assert(
        fc.property(
          fc.array(validPatternArb, { minLength: 1, maxLength: 20 }),
          (patterns) => {
            // Setup: Create empty gitignore
            fs.writeFileSync(gitignorePath, '', 'utf-8');
            
            const updater = new GitignoreUpdater(tempDir);
            updater.readGitignore();
            
            // Action: Try to write patterns
            try {
              updater.writeGitignore(patterns);
              
              // Property: If write succeeded, syntax must be valid
              const updater2 = new GitignoreUpdater(tempDir);
              updater2.readGitignore();
              expect(updater2.validateSyntax()).toBe(true);
            } catch (error) {
              // Property: If write failed, it should be due to invalid syntax
              expect(error).toBeDefined();
              expect((error as Error).message).toContain('Invalid .gitignore syntax');
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should reject patterns with null bytes', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}\0${s}`),
          (invalidPattern) => {
            // Setup: Create gitignore with invalid pattern
            const updater = new GitignoreUpdater(tempDir);
            fs.writeFileSync(gitignorePath, invalidPattern, 'utf-8');
            updater.readGitignore();
            
            // Action: Validate
            const isValid = updater.validateSyntax();
            
            // Property: Patterns with null bytes should be invalid
            expect(isValid).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept patterns with brackets', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `[${s}`),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `${s}]`),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `[${s}]`),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `[${s}][`)
          ),
          (pattern) => {
            // Setup: Create gitignore with pattern
            const updater = new GitignoreUpdater(tempDir);
            fs.writeFileSync(gitignorePath, pattern, 'utf-8');
            updater.readGitignore();
            
            // Action: Validate
            const isValid = updater.validateSyntax();
            
            // Property: Gitignore is permissive with bracket patterns
            // (Git itself handles the pattern matching, we just store them)
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept patterns with escape sequences', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `\\#${s}`),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `\\\\${s}`),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `\\ ${s}`),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `\\[${s}\\]`),
            fc.string({ minLength: 1, maxLength: 20 }).map(s => `\\x${s}`) // Even "invalid" escapes are accepted
          ),
          (pattern) => {
            // Setup: Create gitignore with pattern
            const updater = new GitignoreUpdater(tempDir);
            fs.writeFileSync(gitignorePath, pattern, 'utf-8');
            updater.readGitignore();
            
            // Action: Validate
            const isValid = updater.validateSyntax();
            
            // Property: Gitignore is permissive with escape sequences
            // (Git itself interprets them, we just store them)
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should accept comments and empty lines', () => {
      fc.assert(
        fc.property(
          fc.array(
            fc.oneof(
              commentArb.map(c => `# ${c}`),
              fc.constant(''),
              fc.constant('   '),
              fc.constant('\t')
            ),
            { minLength: 1, maxLength: 20 }
          ),
          (lines) => {
            // Setup: Create gitignore with comments and empty lines
            const updater = new GitignoreUpdater(tempDir);
            fs.writeFileSync(gitignorePath, lines.join('\n'), 'utf-8');
            updater.readGitignore();
            
            // Action: Validate
            const isValid = updater.validateSyntax();
            
            // Property: Comments and empty lines should always be valid
            expect(isValid).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should maintain validity after adding patterns', () => {
      fc.assert(
        fc.property(
          existingGitignoreArb,
          patternArrayArb,
          commentArb,
          (existingLines, newPatterns, comment) => {
            // Setup: Create gitignore with existing content
            fs.writeFileSync(gitignorePath, existingLines.join('\n'), 'utf-8');
            
            const updater = new GitignoreUpdater(tempDir);
            updater.readGitignore();
            
            // Verify initial validity
            const initiallyValid = updater.validateSyntax();
            
            // Action: Add new patterns (which are trimmed and filtered)
            updater.addPatterns(newPatterns, comment);
            
            // Property: If initially valid, should remain valid after adding patterns
            // (since we only add valid patterns without null bytes)
            if (initiallyValid) {
              expect(updater.validateSyntax()).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should create backup before writing', () => {
      fc.assert(
        fc.property(
          validPatternArb,
          (validPattern) => {
            // Setup: Create gitignore with valid content
            fs.writeFileSync(gitignorePath, validPattern, 'utf-8');
            
            const updater = new GitignoreUpdater(tempDir);
            updater.readGitignore();
            
            // Action: Write new content
            updater.writeGitignore(['*.log', '*.tmp']);
            
            // Property: Backup should exist
            const backupPath = `${gitignorePath}.backup`;
            expect(fs.existsSync(backupPath)).toBe(true);
            
            const backupContent = fs.readFileSync(backupPath, 'utf-8');
            expect(backupContent).toBe(validPattern);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
