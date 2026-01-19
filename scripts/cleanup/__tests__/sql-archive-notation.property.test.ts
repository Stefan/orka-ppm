/**
 * Property-Based Test for SQL Archive Notation
 * 
 * Feature: project-cleanup, Property 15: SQL Archive Notation
 * Validates: Requirements 7.1, 7.5
 * 
 * Property: For any SQL file that is archived, the cleanup summary report should include
 * its archive location with a note about its manual review status.
 */

import fc from 'fast-check';
import { ReportGenerator } from '../ReportGenerator';
import { CleanupStats, FileInfo, FileCategory, ArchiveResult } from '../types';

describe('ReportGenerator - Property 15: SQL Archive Notation', () => {
  let reportGenerator: ReportGenerator;

  beforeEach(() => {
    reportGenerator = new ReportGenerator();
  });

  /**
   * Generator for SQL file ArchiveResult objects
   */
  const sqlArchiveResultArb = fc.record({
    originalPath: fc.string({ minLength: 5, maxLength: 30 }).map(s => `/test/${s}.sql`),
    archivePath: fc.string({ minLength: 5, maxLength: 30 }).map(s => `/archive/sql-files/${s}.sql`),
    success: fc.constant(true),
  });

  /**
   * Generator for non-SQL ArchiveResult objects
   */
  const nonSqlArchiveResultArb = fc.record({
    originalPath: fc.string({ minLength: 5, maxLength: 30 }).chain(name =>
      fc.constantFrom('.md', '.log', '.txt', '.json')
        .map(ext => `/test/${name}${ext}`)
    ),
    archivePath: fc.string({ minLength: 5, maxLength: 30 }).chain(name =>
      fc.constantFrom('.md', '.log', '.txt', '.json')
        .map(ext => `/archive/${name}${ext}`)
    ),
    success: fc.constant(true),
  });

  /**
   * Generator for CleanupStats
   */
  const cleanupStatsArb = fc.record({
    totalFiles: fc.integer({ min: 1, max: 100 }),
    filesDeleted: fc.integer({ min: 0, max: 50 }),
    filesArchived: fc.integer({ min: 1, max: 50 }),
    filesPreserved: fc.integer({ min: 0, max: 50 }),
    sizeReduced: fc.integer({ min: 0, max: 1000000 }),
    archiveLocation: fc.string({ minLength: 5, maxLength: 30 }).map(s => `.kiro/archive/${s}`),
  });

  it('should include manual review status for all archived SQL files', () => {
    fc.assert(
      fc.property(
        cleanupStatsArb,
        fc.array(sqlArchiveResultArb, { minLength: 1, maxLength: 10 }),
        (stats, sqlArchiveResults) => {
          // Create archive results map with SQL files
          const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
          for (const category of Object.values(FileCategory)) {
            archivedFiles.set(category as FileCategory, []);
          }
          archivedFiles.set(FileCategory.SQL_REVIEW, sqlArchiveResults);

          const deletedFiles = new Map<FileCategory, FileInfo[]>();
          for (const category of Object.values(FileCategory)) {
            deletedFiles.set(category as FileCategory, []);
          }

          const report = reportGenerator.generateSummary(
            stats,
            deletedFiles,
            archivedFiles,
            [],
            []
          );

          // Property: Report must include "Manual review required" for SQL files
          expect(report).toContain('Manual review required');

          // Property: Each SQL file should be listed with its archive location
          for (const result of sqlArchiveResults) {
            const fileName = result.originalPath.split('/').pop() || '';
            expect(report).toContain(fileName);
            expect(report).toContain('New Location');
          }

          // Property: Report must have SQL Files section
          expect(report).toContain('SQL Files');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include special note about SQL files not being referenced in documentation', () => {
    fc.assert(
      fc.property(
        cleanupStatsArb,
        fc.array(sqlArchiveResultArb, { minLength: 1, maxLength: 10 }),
        (stats, sqlArchiveResults) => {
          // Create archive results map with SQL files
          const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
          for (const category of Object.values(FileCategory)) {
            archivedFiles.set(category as FileCategory, []);
          }
          archivedFiles.set(FileCategory.SQL_REVIEW, sqlArchiveResults);

          const deletedFiles = new Map<FileCategory, FileInfo[]>();
          for (const category of Object.values(FileCategory)) {
            deletedFiles.set(category as FileCategory, []);
          }

          const report = reportGenerator.generateSummary(
            stats,
            deletedFiles,
            archivedFiles,
            [],
            []
          );

          // Property: Report must include note about SQL files not being referenced
          expect(report).toContain('not referenced in essential documentation');
          expect(report).toContain('DEPLOYMENT.md');
          expect(report).toContain('AUTH_SETUP_GUIDE.md');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should list archive location for each SQL file', () => {
    fc.assert(
      fc.property(
        cleanupStatsArb,
        fc.array(sqlArchiveResultArb, { minLength: 1, maxLength: 10 }),
        (stats, sqlArchiveResults) => {
          // Create archive results map with SQL files
          const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
          for (const category of Object.values(FileCategory)) {
            archivedFiles.set(category as FileCategory, []);
          }
          archivedFiles.set(FileCategory.SQL_REVIEW, sqlArchiveResults);

          const deletedFiles = new Map<FileCategory, FileInfo[]>();
          for (const category of Object.values(FileCategory)) {
            deletedFiles.set(category as FileCategory, []);
          }

          const report = reportGenerator.generateSummary(
            stats,
            deletedFiles,
            archivedFiles,
            [],
            []
          );

          // Property: Each SQL file must have its archive location listed
          for (const result of sqlArchiveResults) {
            const fileName = result.originalPath.split('/').pop() || '';
            expect(report).toContain(fileName);
            
            // Check that the report contains "New Location" for this file
            const fileIndex = report.indexOf(fileName);
            const nextFileIndex = report.indexOf('- `', fileIndex + 1);
            const sectionEnd = nextFileIndex === -1 ? report.length : nextFileIndex;
            const fileSection = report.substring(fileIndex, sectionEnd);
            
            expect(fileSection).toContain('New Location');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not include SQL-specific notes for non-SQL archived files', () => {
    fc.assert(
      fc.property(
        cleanupStatsArb,
        fc.array(nonSqlArchiveResultArb, { minLength: 1, maxLength: 10 }),
        (stats, nonSqlArchiveResults) => {
          // Create archive results map with non-SQL files
          const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
          for (const category of Object.values(FileCategory)) {
            archivedFiles.set(category as FileCategory, []);
          }
          archivedFiles.set(FileCategory.TEMPORARY_SUMMARY, nonSqlArchiveResults);

          const deletedFiles = new Map<FileCategory, FileInfo[]>();
          for (const category of Object.values(FileCategory)) {
            deletedFiles.set(category as FileCategory, []);
          }

          const report = reportGenerator.generateSummary(
            stats,
            deletedFiles,
            archivedFiles,
            [],
            []
          );

          // Property: Non-SQL files should not have "Manual review required" status
          // We need to check that the Temporary Summaries section doesn't have this text
          const tempSummaryIndex = report.indexOf('Temporary Summaries');
          if (tempSummaryIndex !== -1) {
            const nextSectionIndex = report.indexOf('##', tempSummaryIndex + 1);
            const sectionEnd = nextSectionIndex === -1 ? report.length : nextSectionIndex;
            const tempSummarySection = report.substring(tempSummaryIndex, sectionEnd);
            
            // This section should not contain "Manual review required"
            expect(tempSummarySection).not.toContain('Manual review required');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle mixed SQL and non-SQL archived files correctly', () => {
    fc.assert(
      fc.property(
        cleanupStatsArb,
        fc.array(sqlArchiveResultArb, { minLength: 1, maxLength: 5 }),
        fc.array(nonSqlArchiveResultArb, { minLength: 1, maxLength: 5 }),
        (stats, sqlArchiveResults, nonSqlArchiveResults) => {
          // Create archive results map with both SQL and non-SQL files
          const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
          for (const category of Object.values(FileCategory)) {
            archivedFiles.set(category as FileCategory, []);
          }
          archivedFiles.set(FileCategory.SQL_REVIEW, sqlArchiveResults);
          archivedFiles.set(FileCategory.TEMPORARY_SUMMARY, nonSqlArchiveResults);

          const deletedFiles = new Map<FileCategory, FileInfo[]>();
          for (const category of Object.values(FileCategory)) {
            deletedFiles.set(category as FileCategory, []);
          }

          const report = reportGenerator.generateSummary(
            stats,
            deletedFiles,
            archivedFiles,
            [],
            []
          );

          // Property: SQL files section must have manual review note
          expect(report).toContain('SQL Files');
          expect(report).toContain('Manual review required');
          expect(report).toContain('not referenced in essential documentation');

          // Property: All SQL files should be listed
          for (const result of sqlArchiveResults) {
            const fileName = result.originalPath.split('/').pop() || '';
            expect(report).toContain(fileName);
          }

          // Property: All non-SQL files should be listed
          for (const result of nonSqlArchiveResults) {
            const fileName = result.originalPath.split('/').pop() || '';
            expect(report).toContain(fileName);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not include SQL-specific sections when no SQL files are archived', () => {
    fc.assert(
      fc.property(
        cleanupStatsArb,
        fc.array(nonSqlArchiveResultArb, { minLength: 1, maxLength: 10 }),
        (stats, nonSqlArchiveResults) => {
          // Create archive results map with only non-SQL files
          const archivedFiles = new Map<FileCategory, ArchiveResult[]>();
          for (const category of Object.values(FileCategory)) {
            archivedFiles.set(category as FileCategory, []);
          }
          archivedFiles.set(FileCategory.TEMPORARY_SUMMARY, nonSqlArchiveResults);

          const deletedFiles = new Map<FileCategory, FileInfo[]>();
          for (const category of Object.values(FileCategory)) {
            deletedFiles.set(category as FileCategory, []);
          }

          const report = reportGenerator.generateSummary(
            stats,
            deletedFiles,
            archivedFiles,
            [],
            []
          );

          // Property: Report should not have SQL Files section when no SQL files archived
          expect(report).not.toContain('SQL Files');
        }
      ),
      { numRuns: 100 }
    );
  });
});
