# Project Cleanup Tool

A TypeScript CLI utility that automatically scans, categorizes, archives, and deletes temporary files in the project root directory. This tool helps maintain a clean workspace by organizing historical documentation and removing temporary development artifacts.

## Quick Start

```bash
# Preview what will be cleaned up (recommended first run)
npm run cleanup:dry-run

# Execute the cleanup
npm run cleanup

# Run with detailed logging
npm run cleanup -- --verbose
```

## Usage

### Using npm scripts (recommended)

```bash
# Dry run - preview actions without making changes
npm run cleanup:dry-run

# Execute cleanup
npm run cleanup

# Execute with verbose output
npm run cleanup -- --verbose
```

### Direct execution

```bash
# From project root
node scripts/cleanup/index.js [options]

# With options
node scripts/cleanup/index.js --dry-run
node scripts/cleanup/index.js --verbose
node scripts/cleanup/index.js --dry-run --verbose
```

## Command-Line Options

| Option | Description |
|--------|-------------|
| `--dry-run` | Preview all actions without modifying any files. Shows what would be deleted, archived, and preserved. |
| `--verbose` | Enable detailed logging showing each file operation and categorization decision. |
| `--help` | Display help message with usage instructions. |

## What Files Are Affected?

The cleanup tool categorizes files into the following groups:

### Files That Will Be Deleted

**Temporary Summaries:**
- `TASK_*_SUMMARY.md`
- `CHECKPOINT_*_REPORT.md`
- `FINAL_*_SUMMARY.md`
- `*_COMPLETION_SUMMARY.md`
- `*_FIX_SUMMARY.md`
- `*_IMPLEMENTATION_SUMMARY.md`

**Temporary Logs:**
- `*.log` files
- `test-results.json`
- `test-output.log`
- `bundle-analysis-report.txt`
- `chrome-scroll-test.html`

### Files That Will Be Archived

**Translation Work:**
- `BATCH2_*.md`
- `WEEK4_*.md`
- `I18N_*.md` (except `I18N_DEVELOPER_GUIDE.md`)
- `*_TRANSLATION_*.md`

**Performance Reports:**
- `DASHBOARD_*.md`
- `BUNDLE_*.md`
- `PERFORMANCE_*.md`
- `OPTIMIZATION_*.md`
- `LCP_*.md`, `CLS_*.md`, `TBT_*.md`
- `LIGHTHOUSE_*.md`

**SQL Files:**
- `*.sql` files (archived for manual review)

### Files That Will Be Preserved

**Essential Documentation:**
- `TESTING_GUIDE.md`
- `DESIGN_SYSTEM_GUIDE.md`
- `DEPLOYMENT.md`
- `AUTH_SETUP_GUIDE.md`
- `I18N_DEVELOPER_GUIDE.md`

**Configuration Files:**
- `package.json`
- `tsconfig.json`
- `.env*` files
- All other config files

## Safety Features

### 1. Backup Before Deletion
Before any files are deleted, a complete backup list is created at `.kiro/cleanup-backup.json`. This file contains:
- Full paths of all files to be deleted
- File metadata (size, timestamps)
- Category assignments

### 2. Archive Preservation
Files that are archived (not deleted) are moved to `.kiro/archive/YYYY-MM-DD_cleanup/` with:
- Original timestamps preserved
- Organized by category in subdirectories
- Complete index file (`ARCHIVE_INDEX.md`) listing original locations

### 3. Essential File Protection
The tool has a hardcoded whitelist of essential files that are **never** deleted or archived:
- All configuration files
- Active documentation guides
- Project setup files

### 4. Unknown File Flagging
Files that don't match any known pattern are:
- Flagged in the `UNKNOWN` category
- **Not** deleted or archived
- Listed in the cleanup summary for manual review

### 5. Dry Run Mode
Always run with `--dry-run` first to preview actions:
```bash
npm run cleanup:dry-run
```

## Output and Reports

### Cleanup Summary Report

After execution, a comprehensive report is generated at `CLEANUP_SUMMARY.md` containing:

- **Executive Summary**: Total files processed, deleted, archived, and preserved
- **Deleted Files**: Complete list organized by category
- **Archived Files**: List with new archive locations
- **Preserved Files**: Essential files that were kept
- **Unknown Files**: Files requiring manual review
- **Statistics**: File count reduction and disk space saved

### Archive Index

An index file is created at `.kiro/archive/YYYY-MM-DD_cleanup/ARCHIVE_INDEX.md` with:
- Original file paths
- New archive locations
- Organized by category

### .gitignore Updates

The tool automatically updates `.gitignore` to prevent future accumulation of temporary files. All existing entries are preserved, and new patterns are added with explanatory comments.

## Examples

### Example 1: First-time cleanup (recommended)

```bash
# Step 1: Preview what will happen
npm run cleanup:dry-run

# Step 2: Review the output carefully

# Step 3: Execute if satisfied
npm run cleanup

# Step 4: Review CLEANUP_SUMMARY.md
cat CLEANUP_SUMMARY.md
```

### Example 2: Verbose cleanup for debugging

```bash
# See detailed logging of every operation
npm run cleanup -- --verbose
```

### Example 3: Check what would be cleaned without making changes

```bash
# Safe to run anytime - makes no modifications
npm run cleanup:dry-run --verbose
```

## Archive Structure

Archives are organized by date and category:

```
.kiro/archive/
└── 2024-01-15_cleanup/
    ├── translation-work/
    │   ├── BATCH2_TRANSLATION_PLAN.md
    │   └── I18N_TRANSLATION_PROGRESS.md
    ├── performance-reports/
    │   ├── DASHBOARD_OPTIMIZATION_SUMMARY.md
    │   └── BUNDLE_SIZE_OPTIMIZATION_REPORT.md
    ├── temporary-summaries/
    │   └── TASK_12_COMPLETION_SUMMARY.md
    ├── sql-files/
    │   └── COMPLETE_SETUP.sql
    └── ARCHIVE_INDEX.md
```

## Troubleshooting

### Permission Errors

If you encounter permission errors:
```bash
# Ensure you have write permissions
chmod +w .

# Or run with appropriate permissions
sudo npm run cleanup
```

### Archive Already Exists

If an archive directory already exists for today, the tool will append a counter:
- `.kiro/archive/2024-01-15_cleanup`
- `.kiro/archive/2024-01-15_cleanup_2`
- `.kiro/archive/2024-01-15_cleanup_3`

### Unknown Files

If many files are categorized as `UNKNOWN`:
1. Review the list in `CLEANUP_SUMMARY.md`
2. Determine if they should be kept, archived, or deleted
3. Manually handle these files
4. Consider updating the categorization patterns in `Categorizer.ts`

### Restore Deleted Files

If you need to restore deleted files:
1. Check `.kiro/cleanup-backup.json` for the list of deleted files
2. Restore from version control: `git checkout HEAD -- <filename>`
3. Or restore from your backup system

## Technical Details

### Components

- **FileScanner**: Scans root directory and collects file metadata
- **Categorizer**: Applies pattern matching to assign categories
- **ArchiveManager**: Creates archive structure and moves files
- **Deleter**: Safely removes temporary files with verification
- **ReportGenerator**: Creates comprehensive markdown summary
- **GitignoreUpdater**: Adds patterns to prevent future accumulation
- **SqlReferenceChecker**: Evaluates SQL file relevance

### File Extensions Allowed for Deletion

Only files with these extensions can be deleted:
- `.md` (markdown)
- `.log` (logs)
- `.txt` (text)
- `.json` (JSON data)
- `.html` (HTML)
- `.csv` (CSV data)

All other file types are automatically preserved.

## Best Practices

1. **Always run dry-run first**: Preview actions before executing
2. **Review the summary**: Check `CLEANUP_SUMMARY.md` after cleanup
3. **Commit before cleanup**: Ensure your work is committed to git
4. **Check unknown files**: Review any files flagged as `UNKNOWN`
5. **Periodic cleanup**: Run monthly to prevent accumulation
6. **Archive review**: Periodically review archived files and delete if no longer needed

## Integration with Development Workflow

The cleanup tool is designed to be run periodically (e.g., monthly) to maintain a clean workspace. Consider:

- Running before major releases
- Running after completing large features
- Running when the root directory becomes cluttered
- Integrating into CI/CD for automated cleanup of build artifacts

## Support

For issues or questions:
1. Check the `CLEANUP_SUMMARY.md` report for details
2. Run with `--verbose` flag for detailed logging
3. Review `.kiro/cleanup-backup.json` for deleted file list
4. Check `.kiro/archive/` for archived files
