import * as fs from 'fs';
import * as path from 'path';

/**
 * Essential documentation files to check for SQL references
 */
const ESSENTIAL_DOCS = [
  'DEPLOYMENT.md',
  'AUTH_SETUP_GUIDE.md',
  'TESTING_GUIDE.md',
  'DESIGN_SYSTEM_GUIDE.md',
];

/**
 * Checks if SQL files are referenced in essential documentation
 */
export class SqlReferenceChecker {
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  /**
   * Check if a SQL file is referenced in any essential documentation
   * @param sqlFilename - Name of the SQL file to check (e.g., "COMPLETE_SETUP.sql")
   * @returns true if the SQL file is referenced in documentation, false otherwise
   */
  isReferencedInDocs(sqlFilename: string): boolean {
    for (const docFile of ESSENTIAL_DOCS) {
      const docPath = path.join(this.rootDir, docFile);
      
      // Skip if documentation file doesn't exist
      if (!fs.existsSync(docPath)) {
        continue;
      }

      try {
        const content = fs.readFileSync(docPath, 'utf-8');
        
        // Use a more sophisticated matching approach to avoid false positives
        // We escape special regex characters in the filename
        const escapedFilename = sqlFilename.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Match the filename with appropriate boundaries:
        // - Before: start of string, whitespace, or common delimiters
        // - After: end of string, whitespace, or common delimiters
        // Include backticks, slashes, and other common characters used in documentation
        const pattern = new RegExp(`(?:^|[\\s,;:'"<>()\\[\\]{}` + '`' + `/\\\\])${escapedFilename}(?:[\\s,;:'"<>()\\[\\]{}` + '`' + `/\\\\]|$)`, 'i');
        
        if (pattern.test(content)) {
          return true;
        }
      } catch (error) {
        console.warn(`Warning: Could not read ${docFile}:`, error);
        continue;
      }
    }

    return false;
  }

  /**
   * Get list of essential documentation files being checked
   */
  getEssentialDocs(): string[] {
    return [...ESSENTIAL_DOCS];
  }
}
