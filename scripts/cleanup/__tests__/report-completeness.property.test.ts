/**
 * Property-Based Test for Report Completeness
 * 
 * Feature: project-cleanup, Property 11: Report Completeness
 * Validates: Requirements 3.4, 6.1, 6.2, 6.4, 6.5
 * 
 * Property: For any cleanup operation, the generated summary report should include:
 * - Total files processed
 * - Files deleted (by category)
 * - Files archived (with locations)
 * - Files preserved
 * - Archive location
 * - Size reduction statistics
 */

import fc from 'fast-check';
import { ReportGenerator } from '../ReportGenerator';
import { CleanupStats, FileInfo, FileCategory, ArchiveResult } from '../types';

describe('ReportGenerator - Property 11: Report Completeness', () => {
  let reportGenerator: ReportGenerator;

  beforeEach(() => {
    reportGenerator = new ReportGenerator();
  });

  /**
   * Generator for FileInfo objects
   */
  const fileInfoArb = fc.record({
    path: fc.string({ minLength: 5, maxLength: 50 }).map(s => `/test/${s}`),
    name: fc.string({ minLength: 1, maxLength: 30 }).chain(name =>
      fc.constantFrom('.md', '.log', '.txt', '.json', '.sql', '')
        .map(ext => `${name}${ext}`)
    ),
    extension: fc.constantFrom('.md', '.log', '.txt', '.json', '.sql', ''),
    size: fc.integer({ min: 0, max: 1000000 }),
    modifiedTime: fc.date(),
  });

  /**
   * Generator for ArchiveResult objects
   */
  const archiveResultArb = fc.record({
    originalPath: fc.string({ minLength: 5, maxLength: 50 }).map(s => `/test/${s}`),
    archivePath: fc.string({ minLength: 5, maxLength: 50 }).map(s => `/archive/${s}`),
    success: fc.constant(true),
  });

  /**
   * Generator for CleanupStats
   */
  const cleanupStatsArb = fc.record({
    totalFiles: fc.integer({ min: 0, max: 200 }),
    filesDeleted: fc.integer({ min: 0, max: 100 }),
    filesArchived: fc.integer({ min: 0, max: 100 }),
    filesPreserved: fc.integer({ min: 0, max: 100 }),
    sizeReduced: fc.integer({ min: 0, max: 10000000 }),
    archiveLocation: fc.string({ minLength: 5, maxLength: 50 }).map(s => `.kiro/archive/${s}`),
  });

  /**
   * Generator for file maps by category
   */
  const filesByCategoryArb = fc.record({
    [FileCategory.TEMPORARY_SUMMARY]: fc.array(fileInfoArb, { maxLength: 20 }),
    [FileCategory.TRANSLATION_WORK]: fc.array(fileInfoArb, { maxLength: 20 }),
    [FileCategory.PERFORMANCE_REPORT]: fc.array(fileInfoArb, { maxLength: 20 }),
    [FileCategory.TEMPORARY_LOG]: fc.array(fileInfoArb, { maxLength: 20 }),
    [FileCategory.ESSENTIAL]: fc.array(fileInfoArb, { maxLength: 20 }),
    [FileCategory.SQL_REVIEW]: fc.array(fileInfoArb, { maxLength: 20 }),
    [FileCategory.UNKNOWN]: fc.array(fileInfoArb, { maxLength: 20 }),
  }).map(obj => {
    const map = new Map<FileCategory, FileInfo[]>();
    for (const [key, value] of Object.entries(obj)) {
      map.set(key as FileCategory, value);
    }
    return map;
  });

  /**
   * Generator for archive results by category
   */
  const archiveResultsByCategoryArb = fc.record({
    [FileCategory.TEMPORARY_SUMMARY]: fc.array(archiveResultArb, { maxLength: 20 }),
    [FileCategory.TRANSLATION_WORK]: fc.array(archiveResultArb, { maxLength: 20 }),
    [FileCategory.PERFORMANCE_REPORT]: fc.array(archiveResultArb, { maxLength: 20 }),
    [FileCategory.TEMPORARY_LOG]: fc.array(archiveResultArb, { maxLength: 20 }),
    [FileCategory.ESSENTIAL]: fc.array(archiveResultArb, { maxLength: 20 }),
    [FileCategory.SQL_REVIEW]: fc.array(archiveResultArb, { maxLength: 20 }),
    [FileCategory.UNKNOWN]: fc.array(archiveResultArb, { maxLength: 20 }),
  }).map(obj => {
    const map = new Map<FileCategory, ArchiveResult[]>();
    for (const [key, value] of Object.entries(obj)) {
      map.set(key as FileCategory, value);
    }
    return map;
  });

  it('should include all required statistics in the report', () => {
    fc.assert(
      fc.property(
        cleanupStatsArb,
        filesByCategoryArb,
        archiveResultsByCategoryArb,
        fc.array(fileInfoArb, { maxLength: 20 }),
        fc.array(fileInfoArb, { maxLength: 20 }),
        (stats, deletedFiles, archivedFiles, preservedFiles, unknownFiles) => {
          const report = reportGenerator.generateSummary(
            stats,
            deletedFiles,
            archivedFiles,
            preservedFiles,
            unknownFiles
          );

          // Property: Report must include total files processed
          expect(report).toContain('Total Files Processed');
          expect(report).toContain(stats.totalFiles.toString());

          // Property: Report must include files deleted count
          expect(report).toContain('Files Deleted');
          expect(report).toContain(stats.filesDeleted.toString());

          // Property: Report must include files archived count
          expect(report).toContain('Files Archived');
          expect(report).toContain(stats.filesArchived.toString());

          // Property: Report must include files preserved count
          expect(report).toContain('Files Preserved');
          expect(report).toContain(stats.filesPreserved.toString());

          // Property: Report must include size reduction
          expect(report).toContain('Size Reduced');

          // Property: Report must include archive location
          expect(report).toContain('Archive Location');
          expect(report).toContain(stats.archiveLocation);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include before/after comparison in the report', () => {
    fc.assert(
      fc.property(
        cleanupStatsArb,
        filesByCategoryArb,
        archiveResultsByCategoryArb,
        fc.array(fileInfoArb, { maxLength: 20 }),
        fc.array(fileInfoArb, { maxLength: 20 }),
        (stats, deletedFiles, archivedFiles, preservedFiles, unknownFiles) => {
          const report = reportGenerator.generateSummary(
            stats,
            deletedFiles,
            archivedFiles,
            preservedFiles,
            unknownFiles
          );

          // Property: Report must include before/after comparison section
          expect(report).toContain('Before/After Comparison');
          expect(report).toContain('Before Cleanup');
          expect(report).toContain('After Cleanup');
          expect(report).toContain('Files Removed');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should list all deleted files by category', () => {
    fc.assert(
      fc.property(
        cleanupStatsArb,
        filesByCategoryArb,
        archiveResultsByCategoryArb,
        fc.array(fileInfoArb, { maxLength: 20 }),
        fc.array(fileInfoArb, { maxLength: 20 }),
        (stats, deletedFiles, archivedFiles, preservedFiles, unknownFiles) => {
          const report = reportGenerator.generateSummary(
            stats,
            deletedFiles,
            archivedFiles,
            preservedFiles,
            unknownFiles
          );

          // Property: Report must have a "Deleted Files" section
          expect(report).toContain('## Deleted Files');

          // Property: Each deleted file should be listed in the report
          for (const [category, files] of deletedFiles.entries()) {
            if (files.length > 0) {
              for (const file of files) {
                expect(report).toContain(file.name);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should list all archived files with their new locations', () => {
    fc.assert(
      fc.property(
        cleanupStatsArb,
        filesByCategoryArb,
        archiveResultsByCategoryArb,
        fc.array(fileInfoArb, { maxLength: 20 }),
        fc.array(fileInfoArb, { maxLength: 20 }),
        (stats, deletedFiles, archivedFiles, preservedFiles, unknownFiles) => {
          const report = reportGenerator.generateSummary(
            stats,
            deletedFiles,
            archivedFiles,
            preservedFiles,
            unknownFiles
          );

          // Property: Report must have an "Archived Files" section
          expect(report).toContain('## Archived Files');

          // Property: Each archived file should be listed with its new location
          for (const [category, results] of archivedFiles.entries()) {
            if (results.length > 0) {
              for (const result of results) {
                // The report should contain the file name
                const fileName = result.originalPath.split('/').pop() || '';
                if (fileName) {
                  expect(report).toContain(fileName);
                }
                // The report should mention "New Location"
                expect(report).toContain('New Location');
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should list all preserved essential files', () => {
    fc.assert(
      fc.property(
        cleanupStatsArb,
        filesByCategoryArb,
        archiveResultsByCategoryArb,
        fc.array(fileInfoArb, { minLength: 1, maxLength: 20 }),
        fc.array(fileInfoArb, { maxLength: 20 }),
        (stats, deletedFiles, archivedFiles, preservedFiles, unknownFiles) => {
          const report = reportGenerator.generateSummary(
            stats,
            deletedFiles,
            archivedFiles,
            preservedFiles,
            unknownFiles
          );

          // Property: Report must have a "Preserved Essential Files" section
          expect(report).toContain('## Preserved Essential Files');

          // Property: Each preserved file should be listed
          for (const file of preservedFiles) {
            expect(report).toContain(file.name);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include unknown files section when unknown files exist', () => {
    fc.assert(
      fc.property(
        cleanupStatsArb,
        filesByCategoryArb,
        archiveResultsByCategoryArb,
        fc.array(fileInfoArb, { maxLength: 20 }),
        fc.array(fileInfoArb, { minLength: 1, maxLength: 20 }),
        (stats, deletedFiles, archivedFiles, preservedFiles, unknownFiles) => {
          const report = reportGenerator.generateSummary(
            stats,
            deletedFiles,
            archivedFiles,
            preservedFiles,
            unknownFiles
          );

          // Property: Report must have an "Unknown Files" section when unknown files exist
          expect(report).toContain('## Unknown Files');
          expect(report).toContain('Manual Review Required');

          // Property: Each unknown file should be listed
          for (const file of unknownFiles) {
            expect(report).toContain(file.name);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should not include unknown files manual review section when no unknown files exist', () => {
    fc.assert(
      fc.property(
        cleanupStatsArb,
        filesByCategoryArb,
        archiveResultsByCategoryArb.map(map => {
          // Ensure no UNKNOWN category archived files
          const newMap = new Map(map);
          newMap.set(FileCategory.UNKNOWN, []);
          return newMap;
        }),
        fc.array(fileInfoArb, { maxLength: 20 }),
        fc.constant([]),
        (stats, deletedFiles, archivedFiles, preservedFiles, unknownFiles) => {
          const report = reportGenerator.generateSummary(
            stats,
            deletedFiles,
            archivedFiles,
            preservedFiles,
            [...unknownFiles]
          );

          // Property: Report should not have "Unknown Files (Manual Review Required)" section
          // when no unknown files exist and no unknown files are archived
          const hasUnknownArchived = (archivedFiles.get(FileCategory.UNKNOWN) || []).length > 0;
          
          if (unknownFiles.length === 0 && !hasUnknownArchived) {
            expect(report).not.toContain('## Unknown Files (Manual Review Required)');
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate valid markdown format', () => {
    fc.assert(
      fc.property(
        cleanupStatsArb,
        filesByCategoryArb,
        archiveResultsByCategoryArb,
        fc.array(fileInfoArb, { maxLength: 20 }),
        fc.array(fileInfoArb, { maxLength: 20 }),
        (stats, deletedFiles, archivedFiles, preservedFiles, unknownFiles) => {
          const report = reportGenerator.generateSummary(
            stats,
            deletedFiles,
            archivedFiles,
            preservedFiles,
            unknownFiles
          );

          // Property: Report must be valid markdown with proper headers
          expect(report).toContain('# Project Cleanup Summary Report');
          expect(report).toContain('## Executive Summary');
          expect(report).toContain('## Before/After Comparison');
          expect(report).toContain('## Deleted Files');
          expect(report).toContain('## Archived Files');
          expect(report).toContain('## Preserved Essential Files');

          // Property: Report must use markdown list syntax
          expect(report).toMatch(/^- /m); // At least one list item

          // Property: Report must use markdown code blocks for file names
          expect(report).toMatch(/`[^`]+`/); // At least one code block
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should include timestamp in the report', () => {
    fc.assert(
      fc.property(
        cleanupStatsArb,
        filesByCategoryArb,
        archiveResultsByCategoryArb,
        fc.array(fileInfoArb, { maxLength: 20 }),
        fc.array(fileInfoArb, { maxLength: 20 }),
        (stats, deletedFiles, archivedFiles, preservedFiles, unknownFiles) => {
          const report = reportGenerator.generateSummary(
            stats,
            deletedFiles,
            archivedFiles,
            preservedFiles,
            unknownFiles
          );

          // Property: Report must include a timestamp
          expect(report).toContain('Generated:');
          // Check for ISO date format (YYYY-MM-DD)
          expect(report).toMatch(/\d{4}-\d{2}-\d{2}/);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle empty cleanup results gracefully', () => {
    const emptyStats: CleanupStats = {
      totalFiles: 0,
      filesDeleted: 0,
      filesArchived: 0,
      filesPreserved: 0,
      sizeReduced: 0,
      archiveLocation: '.kiro/archive/empty',
    };

    const emptyDeletedFiles = new Map<FileCategory, FileInfo[]>();
    const emptyArchivedFiles = new Map<FileCategory, ArchiveResult[]>();
    const emptyPreservedFiles: FileInfo[] = [];
    const emptyUnknownFiles: FileInfo[] = [];

    // Initialize empty maps
    for (const category of Object.values(FileCategory)) {
      emptyDeletedFiles.set(category as FileCategory, []);
      emptyArchivedFiles.set(category as FileCategory, []);
    }

    const report = reportGenerator.generateSummary(
      emptyStats,
      emptyDeletedFiles,
      emptyArchivedFiles,
      emptyPreservedFiles,
      emptyUnknownFiles
    );

    // Property: Report should handle empty results without errors
    expect(report).toBeDefined();
    expect(report.length).toBeGreaterThan(0);
    expect(report).toContain('Total Files Processed');
    expect(report).toContain('0');
  });
});
