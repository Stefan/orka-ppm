import * as fs from 'fs';
import * as path from 'path';
import { FileInfo } from './types';

/**
 * Essential files that must never be deleted or archived
 */
const ESSENTIAL_FILES = new Set([
  // Configuration files
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'tsconfig.prod.json',
  'next.config.ts',
  'tailwind.config.ts',
  'postcss.config.mjs',
  'eslint.config.mjs',
  'jest.config.js',
  'jest.setup.js',
  'jest.env.js',
  'playwright.config.ts',
  'lighthouserc.js',
  'vercel.json',
  'render.yaml',
  
  // Environment files
  '.env.local',
  '.env.production',
  '.gitignore',
  '.gitmodules',
  '.npmrc',
  '.vercelignore',
  
  // Docker files
  'Dockerfile',
  'deploy.sh',
  
  // Other essential files
  'README.md',
  'pytest.ini',
]);

/**
 * Scans the root directory and collects file information
 */
export class FileScanner {
  private rootDir: string;

  constructor(rootDir: string) {
    this.rootDir = rootDir;
  }

  /**
   * Scan the root directory and return information about all files
   */
  scanRootDirectory(): FileInfo[] {
    const files: FileInfo[] = [];

    try {
      const entries = fs.readdirSync(this.rootDir, { withFileTypes: true });

      for (const entry of entries) {
        // Skip directories
        if (entry.isDirectory()) {
          continue;
        }

        // Skip hidden files except .gitignore and .env files
        if (entry.name.startsWith('.') && 
            !entry.name.startsWith('.env') && 
            entry.name !== '.gitignore' &&
            entry.name !== '.gitmodules' &&
            entry.name !== '.npmrc' &&
            entry.name !== '.vercelignore') {
          continue;
        }

        const filePath = path.join(this.rootDir, entry.name);
        
        try {
          const stats = fs.statSync(filePath);
          const ext = path.extname(entry.name);

          files.push({
            path: filePath,
            name: entry.name,
            extension: ext,
            size: stats.size,
            modifiedTime: stats.mtime,
          });
        } catch (error) {
          console.warn(`Warning: Could not read file ${filePath}:`, error);
        }
      }
    } catch (error) {
      console.error(`Error scanning directory ${this.rootDir}:`, error);
      throw error;
    }

    return files;
  }

  /**
   * Check if a file is in the essential files whitelist
   */
  isEssentialFile(filename: string): boolean {
    return ESSENTIAL_FILES.has(filename);
  }

  /**
   * Get the list of essential files
   */
  getEssentialFiles(): Set<string> {
    return new Set(ESSENTIAL_FILES);
  }
}
