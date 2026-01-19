/**
 * Unit Tests for SqlReferenceChecker
 * 
 * Tests SQL file reference checking functionality with specific examples
 * and edge cases.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { SqlReferenceChecker } from '../SqlReferenceChecker';

describe('SqlReferenceChecker', () => {
  let tempDir: string;
  let checker: SqlReferenceChecker;

  beforeEach(() => {
    // Create a temporary directory for testing
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sql-checker-test-'));
    checker = new SqlReferenceChecker(tempDir);
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  /**
   * Helper to create a documentation file
   */
  const createDocFile = (filename: string, content: string): void => {
    fs.writeFileSync(path.join(tempDir, filename), content, 'utf-8');
  };

  describe('isReferencedInDocs', () => {
    it('should return true when SQL file is referenced in DEPLOYMENT.md', () => {
      const sqlFile = 'COMPLETE_SETUP.sql';
      const content = `
# Deployment Guide

## Database Setup

Run the following SQL script to set up the database:

\`\`\`bash
psql -f ${sqlFile}
\`\`\`

This will create all necessary tables and initial data.
      `;
      createDocFile('DEPLOYMENT.md', content);

      expect(checker.isReferencedInDocs(sqlFile)).toBe(true);
    });

    it('should return true when SQL file is referenced in AUTH_SETUP_GUIDE.md', () => {
      const sqlFile = 'QUICK_FIX_ADMIN.sql';
      const content = `
# Authentication Setup

## Admin User Setup

Execute ${sqlFile} to add admin permissions:

\`\`\`sql
-- Run this script
${sqlFile}
\`\`\`
      `;
      createDocFile('AUTH_SETUP_GUIDE.md', content);

      expect(checker.isReferencedInDocs(sqlFile)).toBe(true);
    });

    it('should return false when SQL file is not referenced in any documentation', () => {
      const sqlFile = 'OLD_MIGRATION.sql';
      const content = `
# Deployment Guide

This guide covers deployment without any SQL scripts.
      `;
      createDocFile('DEPLOYMENT.md', content);
      createDocFile('AUTH_SETUP_GUIDE.md', 'No SQL references here.');

      expect(checker.isReferencedInDocs(sqlFile)).toBe(false);
    });

    it('should return false when no documentation files exist', () => {
      const sqlFile = 'SETUP.sql';
      
      expect(checker.isReferencedInDocs(sqlFile)).toBe(false);
    });

    it('should be case-insensitive when checking references', () => {
      const sqlFile = 'Setup_Database.sql';
      const content = `
Run the setup script: SETUP_DATABASE.SQL
      `;
      createDocFile('DEPLOYMENT.md', content);

      expect(checker.isReferencedInDocs(sqlFile)).toBe(true);
    });

    it('should check multiple documentation files', () => {
      const sqlFile = 'INIT_DB.sql';
      
      createDocFile('DEPLOYMENT.md', 'No SQL here.');
      createDocFile('AUTH_SETUP_GUIDE.md', 'No SQL here either.');
      createDocFile('TESTING_GUIDE.md', `Run ${sqlFile} for test setup.`);

      expect(checker.isReferencedInDocs(sqlFile)).toBe(true);
    });

    it('should handle SQL files with special characters', () => {
      const sqlFile = 'setup-v2.1_final.sql';
      const content = `
Execute the script: ${sqlFile}
      `;
      createDocFile('DEPLOYMENT.md', content);

      expect(checker.isReferencedInDocs(sqlFile)).toBe(true);
    });

    it('should handle documentation files with read errors gracefully', () => {
      const sqlFile = 'TEST.sql';
      const docPath = path.join(tempDir, 'DEPLOYMENT.md');
      
      // Create a file and make it unreadable (on Unix systems)
      createDocFile('DEPLOYMENT.md', 'content');
      try {
        fs.chmodSync(docPath, 0o000);
        
        // Should not throw, should return false
        expect(checker.isReferencedInDocs(sqlFile)).toBe(false);
        
        // Restore permissions for cleanup
        fs.chmodSync(docPath, 0o644);
      } catch (error) {
        // Skip this test on Windows where chmod doesn't work the same way
        fs.chmodSync(docPath, 0o644);
      }
    });

    it('should find SQL file referenced in code blocks', () => {
      const sqlFile = 'schema.sql';
      const content = `
# Database Schema

\`\`\`sql
-- Load schema
\\i ${sqlFile}
\`\`\`
      `;
      createDocFile('DEPLOYMENT.md', content);

      expect(checker.isReferencedInDocs(sqlFile)).toBe(true);
    });

    it('should find SQL file referenced in inline code', () => {
      const sqlFile = 'migrate.sql';
      const content = `
Run \`${sqlFile}\` to migrate the database.
      `;
      createDocFile('DEPLOYMENT.md', content);

      expect(checker.isReferencedInDocs(sqlFile)).toBe(true);
    });

    it('should handle empty documentation files', () => {
      const sqlFile = 'EMPTY_TEST.sql';
      createDocFile('DEPLOYMENT.md', '');
      createDocFile('AUTH_SETUP_GUIDE.md', '');

      expect(checker.isReferencedInDocs(sqlFile)).toBe(false);
    });

    it('should handle SQL files with uppercase extensions', () => {
      const sqlFile = 'SETUP.SQL';
      const content = `
Execute ${sqlFile} for setup.
      `;
      createDocFile('DEPLOYMENT.md', content);

      expect(checker.isReferencedInDocs(sqlFile)).toBe(true);
    });

    it('should not match partial SQL file names', () => {
      const sqlFile = 'COMPLETE_SETUP.sql';
      const content = `
Run COMPLETE_SETUP without the .sql extension.
      `;
      createDocFile('DEPLOYMENT.md', content);

      // This should return false because only "COMPLETE_SETUP" is mentioned, not "COMPLETE_SETUP.sql"
      expect(checker.isReferencedInDocs(sqlFile)).toBe(false);
    });

    it('should handle SQL files referenced with paths', () => {
      const sqlFile = 'init.sql';
      const content = `
Execute the script at ./scripts/${sqlFile}
      `;
      createDocFile('DEPLOYMENT.md', content);

      expect(checker.isReferencedInDocs(sqlFile)).toBe(true);
    });

    it('should handle multiple references to the same SQL file', () => {
      const sqlFile = 'setup.sql';
      const content = `
First run ${sqlFile}, then verify ${sqlFile} completed successfully.
If ${sqlFile} fails, check the logs.
      `;
      createDocFile('DEPLOYMENT.md', content);

      expect(checker.isReferencedInDocs(sqlFile)).toBe(true);
    });
  });

  describe('getEssentialDocs', () => {
    it('should return list of essential documentation files', () => {
      const docs = checker.getEssentialDocs();
      
      expect(docs).toContain('DEPLOYMENT.md');
      expect(docs).toContain('AUTH_SETUP_GUIDE.md');
      expect(docs).toContain('TESTING_GUIDE.md');
      expect(docs).toContain('DESIGN_SYSTEM_GUIDE.md');
    });

    it('should return an array', () => {
      const docs = checker.getEssentialDocs();
      
      expect(Array.isArray(docs)).toBe(true);
      expect(docs.length).toBeGreaterThan(0);
    });
  });

  describe('Integration with real SQL files', () => {
    it('should correctly identify COMPLETE_SETUP.sql as referenced', () => {
      const content = `
# Database Setup

Run COMPLETE_SETUP.sql to initialize the database with all tables and data.
      `;
      createDocFile('DEPLOYMENT.md', content);

      expect(checker.isReferencedInDocs('COMPLETE_SETUP.sql')).toBe(true);
    });

    it('should correctly identify QUICK_FIX_ADMIN.sql as referenced', () => {
      const content = `
# Quick Fix

Execute QUICK_FIX_ADMIN.sql to add admin permissions.
      `;
      createDocFile('AUTH_SETUP_GUIDE.md', content);

      expect(checker.isReferencedInDocs('QUICK_FIX_ADMIN.sql')).toBe(true);
    });

    it('should correctly identify unreferenced SQL files', () => {
      const content = `
# Setup Guide

No SQL scripts are needed for this setup.
      `;
      createDocFile('DEPLOYMENT.md', content);

      expect(checker.isReferencedInDocs('OLD_UNUSED_SCRIPT.sql')).toBe(false);
    });
  });
});
