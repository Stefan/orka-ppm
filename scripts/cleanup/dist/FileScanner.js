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
exports.FileScanner = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
class FileScanner {
    constructor(rootDir) {
        this.rootDir = rootDir;
    }
    /**
     * Scan the root directory and return information about all files
     */
    scanRootDirectory() {
        const files = [];
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
                }
                catch (error) {
                    console.warn(`Warning: Could not read file ${filePath}:`, error);
                }
            }
        }
        catch (error) {
            console.error(`Error scanning directory ${this.rootDir}:`, error);
            throw error;
        }
        return files;
    }
    /**
     * Check if a file is in the essential files whitelist
     */
    isEssentialFile(filename) {
        return ESSENTIAL_FILES.has(filename);
    }
    /**
     * Get the list of essential files
     */
    getEssentialFiles() {
        return new Set(ESSENTIAL_FILES);
    }
}
exports.FileScanner = FileScanner;
