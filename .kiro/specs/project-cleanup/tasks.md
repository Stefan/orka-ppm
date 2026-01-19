# Implementation Plan: Project Cleanup System

## Overview

This implementation plan breaks down the project cleanup system into discrete coding tasks. The system will be built as a TypeScript CLI tool that scans, categorizes, archives, and deletes files in the project root directory. Each task builds incrementally, with testing integrated throughout to validate functionality early.

## Tasks

- [x] 1. Set up project structure and core types
  - Create `scripts/cleanup/` directory for cleanup tool
  - Define TypeScript interfaces for FileInfo, CategoryRule, FileCategory enum
  - Define interfaces for ArchiveConfig, ArchiveResult, DeletionResult, CleanupStats
  - Set up TypeScript compilation configuration for the cleanup tool
  - _Requirements: 1.1, 2.1, 3.1_

- [ ] 2. Implement FileScanner component
  - [x] 2.1 Create FileScanner class with scanRootDirectory method
    - Implement directory reading using Node.js fs module
    - Collect file metadata (path, name, extension, size, modifiedTime)
    - Filter out directories and hidden files (except .gitignore)
    - _Requirements: 1.1_
  
  - [x] 2.2 Implement essential files whitelist checking
    - Create isEssentialFile method with hardcoded whitelist
    - Include: TESTING_GUIDE.md, DESIGN_SYSTEM_GUIDE.md, DEPLOYMENT.md, AUTH_SETUP_GUIDE.md, I18N_DEVELOPER_GUIDE.md
    - Include all config files: package.json, tsconfig.json, .env files, etc.
    - _Requirements: 4.1, 4.3, 4.4_
  
  - [x] 2.3 Write unit tests for FileScanner
    - Test scanning with various file types
    - Test essential file detection
    - Test error handling for permission issues
    - _Requirements: 1.1, 4.1_

- [x] 3. Implement Categorizer component
  - [x] 3.1 Create Categorizer class with category rules
    - Define regex patterns for each category (TEMPORARY_SUMMARY, TRANSLATION_WORK, PERFORMANCE_REPORT, TEMPORARY_LOG, SQL_REVIEW)
    - Implement priority ordering (ESSENTIAL highest, then specific patterns, then general patterns)
    - _Requirements: 1.1, 1.2_
  
  - [x] 3.2 Implement categorizeFile method
    - Check essential files first (highest priority)
    - Match file against patterns in priority order
    - Return UNKNOWN if no pattern matches
    - _Requirements: 1.1, 1.2, 4.2_
  
  - [x] 3.3 Write property test for categorization completeness
    - **Property 1: Categorization Completeness**
    - **Validates: Requirements 1.1**
  
  - [x] 3.4 Write property test for priority-based categorization
    - **Property 2: Priority-Based Categorization**
    - **Validates: Requirements 1.2, 4.2**
  
  - [x] 3.5 Write unit tests for specific category patterns
    - Test each category with example filenames
    - Test UNKNOWN category for unmatched files
    - _Requirements: 1.1, 1.2_

- [x] 4. Checkpoint - Ensure categorization works correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 5. Implement ArchiveManager component
  - [x] 5.1 Create ArchiveManager class with archive structure creation
    - Implement createArchiveStructure to create timestamped directory
    - Create subdirectories for each category
    - Handle conflicts if archive directory already exists
    - _Requirements: 2.1, 2.4_
  
  - [x] 5.2 Implement archiveFile method
    - Move file to appropriate category subdirectory
    - Preserve file timestamps using fs.utimes
    - Handle name conflicts by appending timestamp
    - Return ArchiveResult with success status
    - _Requirements: 2.2, 2.5_
  
  - [x] 5.3 Implement generateArchiveIndex method
    - Create ARCHIVE_INDEX.md with list of all archived files
    - Include original path and new archive location for each file
    - Format as markdown table
    - _Requirements: 2.3_
  
  - [x] 5.4 Write property test for archive structure consistency
    - **Property 4: Archive Structure Consistency**
    - **Validates: Requirements 2.1**
  
  - [x] 5.5 Write property test for timestamp preservation
    - **Property 5: Timestamp Preservation During Archiving**
    - **Validates: Requirements 2.2**
  
  - [x] 5.6 Write property test for archive index completeness
    - **Property 6: Archive Index Completeness**
    - **Validates: Requirements 2.3, 6.3**
  
  - [x] 5.7 Write property test for conflict resolution
    - **Property 7: Archive Conflict Resolution**
    - **Validates: Requirements 2.5**
  
  - [x] 5.8 Write unit tests for ArchiveManager
    - Test archive directory creation
    - Test file moving with various scenarios
    - Test error handling
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

- [x] 6. Implement Deleter component
  - [x] 6.1 Create Deleter class with backup creation
    - Implement createDeletionBackup to write list of files to be deleted
    - Save backup list to .kiro/cleanup-backup.json
    - _Requirements: 3.1_
  
  - [x] 6.2 Implement deleteFile method with safety checks
    - Verify file matches temporary pattern
    - Verify file extension is in allowed list (.md, .log, .txt, .json, .html, .csv)
    - Delete file using fs.unlink
    - Return DeletionResult with success status
    - _Requirements: 3.2, 3.5_
  
  - [x] 6.3 Implement unknown file flagging
    - Track files that don't match any pattern
    - Add to UNKNOWN category list
    - Do not delete unknown files
    - _Requirements: 3.3_
  
  - [x] 6.4 Write property test for deletion safety - backup before delete
    - **Property 8: Deletion Safety - Backup Before Delete**
    - **Validates: Requirements 3.1**
  
  - [x] 6.5 Write property test for deletion safety - pattern verification
    - **Property 9: Deletion Safety - Pattern Verification**
    - **Validates: Requirements 3.2, 3.5**
  
  - [x] 6.6 Write property test for unknown file flagging
    - **Property 10: Unknown File Flagging**
    - **Validates: Requirements 3.3**
  
  - [x] 6.7 Write unit tests for Deleter
    - Test backup creation
    - Test deletion with allowed/disallowed extensions
    - Test error handling
    - _Requirements: 3.1, 3.2, 3.3, 3.5_

- [x] 7. Checkpoint - Ensure archive and deletion work correctly
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implement SQL file reference checking
  - [x] 8.1 Create SQL reference checker utility
    - Implement function to search for SQL filename references in essential docs
    - Check DEPLOYMENT.md, AUTH_SETUP_GUIDE.md for SQL file mentions
    - Return boolean indicating if SQL file is referenced
    - _Requirements: 7.2_
  
  - [x] 8.2 Integrate SQL checking into categorization
    - For SQL files, check if referenced in documentation
    - If referenced, categorize as ESSENTIAL
    - If not referenced, categorize as SQL_REVIEW with archive recommendation
    - _Requirements: 7.3, 7.4_
  
  - [x] 8.3 Write property test for SQL file reference checking
    - **Property 14: SQL File Reference Checking**
    - **Validates: Requirements 7.2, 7.3, 7.4**
  
  - [x] 8.4 Write unit tests for SQL reference checking
    - Test with referenced and unreferenced SQL files
    - Test with various documentation files
    - _Requirements: 7.2, 7.3, 7.4_

- [x] 9. Implement ReportGenerator component
  - [x] 9.1 Create ReportGenerator class with summary generation
    - Implement generateSummary method to create markdown report
    - Include executive summary with statistics
    - List deleted files by category
    - List archived files with new locations
    - List preserved essential files
    - Include before/after comparison
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [x] 9.2 Add SQL archive notation to report
    - Include special section for SQL files with manual review status
    - Note archive location for each SQL file
    - _Requirements: 7.1, 7.5_
  
  - [x] 9.3 Implement writeReport method
    - Write report to CLEANUP_SUMMARY.md in root directory
    - Handle write errors gracefully
    - _Requirements: 6.1_
  
  - [x] 9.4 Write property test for report completeness
    - **Property 11: Report Completeness**
    - **Validates: Requirements 3.4, 6.1, 6.2, 6.4, 6.5**
  
  - [x] 9.5 Write property test for SQL archive notation
    - **Property 15: SQL Archive Notation**
    - **Validates: Requirements 7.1, 7.5**
  
  - [x] 9.6 Write unit tests for ReportGenerator
    - Test report generation with various statistics
    - Test markdown formatting
    - Test handling of empty results
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [x] 10. Implement GitignoreUpdater component
  - [x] 10.1 Create GitignoreUpdater class with pattern addition
    - Implement readGitignore to parse existing .gitignore
    - Implement addPatterns to append new patterns with comments
    - Preserve all existing entries
    - _Requirements: 5.1, 5.3_
  
  - [x] 10.2 Add temporary file patterns to .gitignore
    - Add patterns for TASK_*_SUMMARY.md, CHECKPOINT_*_REPORT.md, etc.
    - Add patterns for *.log, test-results.json, etc.
    - Add patterns for DASHBOARD_*.md, BUNDLE_*.md, etc.
    - Include explanatory comments for each pattern group
    - _Requirements: 5.1, 5.2, 5.4_
  
  - [x] 10.3 Implement syntax validation
    - Implement validateSyntax to check .gitignore format
    - Verify no invalid patterns or syntax errors
    - _Requirements: 5.5_
  
  - [x] 10.4 Write property test for gitignore pattern addition
    - **Property 12: Gitignore Pattern Addition**
    - **Validates: Requirements 5.1, 5.3, 5.4**
  
  - [x] 10.5 Write property test for gitignore syntax validity
    - **Property 13: Gitignore Syntax Validity**
    - **Validates: Requirements 5.5**
  
  - [x] 10.6 Write unit tests for GitignoreUpdater
    - Test pattern addition
    - Test preservation of existing entries
    - Test syntax validation
    - _Requirements: 5.1, 5.3, 5.4, 5.5_

- [x] 11. Implement main CLI orchestrator
  - [x] 11.1 Create main cleanup script
    - Implement command-line interface using Node.js
    - Add --dry-run flag to preview actions without executing
    - Add --verbose flag for detailed logging
    - _Requirements: All_
  
  - [x] 11.2 Wire all components together
    - Instantiate FileScanner and scan root directory
    - Categorize all files using Categorizer
    - Create archive structure using ArchiveManager
    - Archive appropriate files
    - Delete temporary files using Deleter
    - Generate cleanup report using ReportGenerator
    - Update .gitignore using GitignoreUpdater
    - _Requirements: All_
  
  - [x] 11.3 Implement error handling and logging
    - Catch and log file system errors
    - Continue processing on individual file failures
    - Report all errors in summary
    - Return appropriate exit codes
    - _Requirements: All_
  
  - [x] 11.4 Write property test for essential file preservation
    - **Property 3: Essential File Preservation**
    - **Validates: Requirements 1.5, 4.5**

- [x] 12. Add CLI documentation and usage instructions
  - [x] 12.1 Create README for cleanup tool
    - Document usage: `npm run cleanup` or `node scripts/cleanup/index.js`
    - Document flags: --dry-run, --verbose
    - Document what files will be affected
    - Include safety notes about backup creation
    - _Requirements: All_
  
  - [x] 12.2 Add npm script to package.json
    - Add "cleanup" script to run the cleanup tool
    - Add "cleanup:dry-run" script for preview mode
    - _Requirements: All_

- [x] 13. Final checkpoint - Run full cleanup on actual project
  - Run cleanup tool in dry-run mode to preview actions
  - Review the preview output with user
  - Execute actual cleanup if approved
  - Verify all essential files are preserved
  - Verify archive was created correctly
  - Verify .gitignore was updated
  - Review CLEANUP_SUMMARY.md report
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- All tasks are required for comprehensive implementation with full test coverage
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at key milestones
- Property tests validate universal correctness properties across many inputs
- Unit tests validate specific examples and edge cases
- The cleanup tool will be a standalone TypeScript script in `scripts/cleanup/`
- Archive will be created in `.kiro/archive/` to keep it outside the root directory
