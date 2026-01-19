"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitignoreUpdater = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
/**
 * GitignoreUpdater manages updates to the .gitignore file
 * to prevent future accumulation of temporary files
 */
class GitignoreUpdater {
    constructor(rootDir = process.cwd()) {
        this.gitignorePath = path.join(rootDir, '.gitignore');
        this.lines = [];
    }
    /**
     * Read and parse the existing .gitignore file
     * @returns Array of lines from .gitignore
     */
    readGitignore() {
        try {
            if (fs.existsSync(this.gitignorePath)) {
                const content = fs.readFileSync(this.gitignorePath, 'utf-8');
                this.lines = content.split('\n');
                return this.lines;
            }
            this.lines = [];
            return this.lines;
        }
        catch (error) {
            throw new Error(`Failed to read .gitignore: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Add new patterns to .gitignore with a comment
     * Preserves all existing entries
     * @param patterns Array of gitignore patterns to add
     * @param comment Explanatory comment for the pattern group
     */
    addPatterns(patterns, comment) {
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
    validateSyntax() {
        try {
            for (const line of this.lines) {
                // Check for null bytes anywhere in the line (most critical issue)
                if (line.includes('\0')) {
                    return false;
                }
            }
            return true;
        }
        catch (error) {
            return false;
        }
    }
    /**
     * Write the updated .gitignore file
     * @param lines Array of lines to write (optional, uses internal lines if not provided)
     */
    writeGitignore(lines) {
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
        }
        catch (error) {
            throw new Error(`Failed to write .gitignore: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    /**
     * Get the current lines (for testing purposes)
     */
    getLines() {
        return [...this.lines];
    }
}
exports.GitignoreUpdater = GitignoreUpdater;
