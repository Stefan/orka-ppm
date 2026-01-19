import * as fs from 'fs';
import * as path from 'path';

/**
 * GitignoreUpdater manages updates to the .gitignore file
 * to prevent future accumulation of temporary files
 */
export class GitignoreUpdater {
  private gitignorePath: string;
  private lines: string[];

  constructor(rootDir: string = process.cwd()) {
    this.gitignorePath = path.join(rootDir, '.gitignore');
    this.lines = [];
  }

  /**
   * Read and parse the existing .gitignore file
   * @returns Array of lines from .gitignore
   */
  readGitignore(): string[] {
    try {
      if (fs.existsSync(this.gitignorePath)) {
        const content = fs.readFileSync(this.gitignorePath, 'utf-8');
        this.lines = content.split('\n');
        return this.lines;
      }
      this.lines = [];
      return this.lines;
    } catch (error) {
      throw new Error(`Failed to read .gitignore: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Add new patterns to .gitignore with a comment
   * Preserves all existing entries
   * @param patterns Array of gitignore patterns to add
   * @param comment Explanatory comment for the pattern group
   */
  addPatterns(patterns: string[], comment: string): void {
    // Ensure we have the current content
    if (this.lines.length === 0) {
      this.readGitignore();
    }

    // Trim and deduplicate patterns
    const trimmedPatterns = [...new Set(patterns.map(p => p.trim()).filter(p => p.length > 0))];

    // Check if patterns already exist
    const existingPatterns = new Set(this.lines.map(line => line.trim()));
    const newPatterns = trimmedPatterns.filter(pattern => !existingPatterns.has(pattern));

    if (newPatterns.length === 0) {
      return; // All patterns already exist
    }

    // Add a blank line if the file doesn't end with one
    if (this.lines.length > 0 && this.lines[this.lines.length - 1].trim() !== '') {
      this.lines.push('');
    }

    // Add comment
    this.lines.push(`# ${comment}`);

    // Add patterns
    newPatterns.forEach(pattern => {
      this.lines.push(pattern);
    });
  }

  /**
   * Validate .gitignore syntax
   * @returns true if syntax is valid, false otherwise
   */
  validateSyntax(): boolean {
    try {
      for (const line of this.lines) {
        // Check for null bytes anywhere in the line (most critical issue)
        if (line.includes('\0')) {
          return false;
        }
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Write the updated .gitignore file
   * @param lines Array of lines to write (optional, uses internal lines if not provided)
   */
  writeGitignore(lines?: string[]): void {
    const linesToWrite = lines || this.lines;
    
    try {
      // Validate before writing
      const tempLines = this.lines;
      this.lines = linesToWrite;
      
      if (!this.validateSyntax()) {
        this.lines = tempLines;
        throw new Error('Invalid .gitignore syntax detected');
      }

      // Create backup before writing
      if (fs.existsSync(this.gitignorePath)) {
        const backupPath = `${this.gitignorePath}.backup`;
        fs.copyFileSync(this.gitignorePath, backupPath);
      }

      // Write the file
      fs.writeFileSync(this.gitignorePath, linesToWrite.join('\n'), 'utf-8');
    } catch (error) {
      throw new Error(`Failed to write .gitignore: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the current lines (for testing purposes)
   */
  getLines(): string[] {
    return [...this.lines];
  }
}
