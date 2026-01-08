#!/usr/bin/env node

const fs = require('fs');

// Fix unused variables in ApprovalWorkflow
function fixApprovalWorkflow() {
  const filePath = 'app/changes/components/ApprovalWorkflow.tsx';
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Remove unused state variables
  const unusedStates = [
    'expandedSteps, setExpandedSteps',
    'showImpactDetails, setShowImpactDetails'
  ];
  
  for (const state of unusedStates) {
    const regex = new RegExp(`\\s*const \\[${state}\\][^\\n]*\\n`, 'g');
    content = content.replace(regex, '');
  }
  
  // Remove unused imports that are no longer needed
  const unusedImports = ['ChevronDown', 'ChevronRight', 'DollarSign', 'TrendingUp'];
  
  for (const imp of unusedImports) {
    // Check if it's actually used
    const usageRegex = new RegExp(`\\b${imp}\\b`, 'g');
    const matches = content.match(usageRegex) || [];
    
    if (matches.length <= 1) { // Only appears in import
      content = content.replace(new RegExp(`, ${imp}`, 'g'), '');
      content = content.replace(new RegExp(`${imp}, `, 'g'), '');
      content = content.replace(new RegExp(`{ ${imp} }`, 'g'), '{}');
    }
  }
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed ApprovalWorkflow.tsx');
}

fixApprovalWorkflow();