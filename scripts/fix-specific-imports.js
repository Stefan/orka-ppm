#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Fix specific file
function fixSpecificFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Check each import individually
    const lines = content.split('\n');
    let modified = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Handle lucide-react multi-line imports
      if (line.includes('from \'lucide-react\'') || line.includes('from "lucide-react"')) {
        // Find all imports on this line or previous lines
        let importLine = line;
        let startIndex = i;
        
        // Check if import spans multiple lines
        while (startIndex > 0 && !lines[startIndex].includes('import')) {
          startIndex--;
        }
        
        // Collect full import statement
        let fullImport = '';
        for (let j = startIndex; j <= i; j++) {
          fullImport += lines[j] + ' ';
        }
        
        // Extract imports between { }
        const match = fullImport.match(/\{\s*([^}]+)\s*\}/);
        if (match) {
          const imports = match[1].split(',').map(imp => imp.trim());
          const usedImports = [];
          
          for (const imp of imports) {
            // Count occurrences in the entire file
            const regex = new RegExp(`\\b${imp}\\b`, 'g');
            const matches = content.match(regex) || [];
            
            // If it appears more than once (import + usage)
            if (matches.length > 1) {
              usedImports.push(imp);
            }
          }
          
          if (usedImports.length !== imports.length) {
            console.log(`Fixing ${filePath}:`);
            console.log(`  Original: ${imports.join(', ')}`);
            console.log(`  Used: ${usedImports.join(', ')}`);
            console.log(`  Removing: ${imports.filter(imp => !usedImports.includes(imp)).join(', ')}`);
            
            if (usedImports.length > 0) {
              const newImport = `import { ${usedImports.join(', ')} } from 'lucide-react'`;
              
              // Replace the import lines
              for (let j = startIndex; j <= i; j++) {
                if (j === startIndex) {
                  lines[j] = newImport;
                } else {
                  lines[j] = '';
                }
              }
            } else {
              // Remove all import lines
              for (let j = startIndex; j <= i; j++) {
                lines[j] = '';
              }
            }
            
            modified = true;
          }
        }
        break; // Only process first lucide-react import
      }
    }
    
    if (modified) {
      // Clean up empty lines
      const cleanedLines = lines.filter(line => line.trim() !== '');
      content = cleanedLines.join('\n');
      fs.writeFileSync(filePath, content, 'utf8');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Fix the specific problematic file
const problemFile = 'app/changes/components/ApprovalWorkflow.tsx';
console.log('🔧 Fixing specific import issues...');

if (fixSpecificFile(problemFile)) {
  console.log('✅ Fixed imports in ApprovalWorkflow.tsx');
} else {
  console.log('❌ No changes needed or error occurred');
}