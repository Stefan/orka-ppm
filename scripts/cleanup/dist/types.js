"use strict";
/**
 * Core types for the Project Cleanup System
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileCategory = void 0;
/**
 * Categories for file classification
 */
var FileCategory;
(function (FileCategory) {
    FileCategory["TEMPORARY_SUMMARY"] = "temporary_summary";
    FileCategory["TRANSLATION_WORK"] = "translation_work";
    FileCategory["PERFORMANCE_REPORT"] = "performance_report";
    FileCategory["TEMPORARY_LOG"] = "temporary_log";
    FileCategory["ESSENTIAL"] = "essential";
    FileCategory["SQL_REVIEW"] = "sql_review";
    FileCategory["UNKNOWN"] = "unknown";
})(FileCategory || (exports.FileCategory = FileCategory = {}));
