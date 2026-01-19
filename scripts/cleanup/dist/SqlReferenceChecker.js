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
exports.SqlReferenceChecker = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
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
class SqlReferenceChecker {
    constructor(rootDir) {
        this.rootDir = rootDir;
    }
    /**
     * Check if a SQL file is referenced in any essential documentation
     * @param sqlFilename - Name of the SQL file to check (e.g., "COMPLETE_SETUP.sql")
     * @returns true if the SQL file is referenced in documentation, false otherwise
     */
    isReferencedInDocs(sqlFilename) {
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
            }
            catch (error) {
                console.warn(`Warning: Could not read ${docFile}:`, error);
                continue;
            }
        }
        return false;
    }
    /**
     * Get list of essential documentation files being checked
     */
    getEssentialDocs() {
        return [...ESSENTIAL_DOCS];
    }
}
exports.SqlReferenceChecker = SqlReferenceChecker;
