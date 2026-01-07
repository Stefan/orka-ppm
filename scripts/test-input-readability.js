#!/usr/bin/env node

/**
 * Input Field Readability Test Script
 * Tests all forms in the application for readability improvements
 */

const fs = require('fs')
const path = require('path')

console.log('🔍 Testing Input Field Readability Improvements...\n')

// Test files that contain forms
const formFiles = [
  'app/feedback/page.tsx',
  'app/page.tsx',
  'app/forgot-password/page.tsx',
  'app/reset-password/page.tsx',
  'app/financials/page.tsx',
  'app/resources/page.tsx'
]

// Readability criteria to check
const readabilityCriteria = {
  // Input field improvements
  hasInputFieldClass: /className="[^"]*input-field[^"]*"/g,
  hasTextareaFieldClass: /className="[^"]*textarea-field[^"]*"/g,
  hasRequiredLabels: /className="[^"]*required[^"]*"/g,
  hasHelpText: /text-sm text-gray-500/g,
  hasPlaceholderText: /placeholder="[^"]+"/g,
  
  // Accessibility improvements
  hasProperLabels: /htmlFor="[^"]+"/g,
  hasAriaLabels: /aria-label="[^"]+"/g,
  hasRequiredFields: /required/g,
  
  // Visual improvements
  hasFocusStates: /focus:/g,
  hasHoverStates: /hover:/g,
  hasErrorStates: /error/g,
  
  // Typography improvements
  hasBetterFontSizes: /text-sm|text-base|text-lg/g,
  hasFontWeights: /font-medium|font-semibold|font-bold/g,
  
  // Spacing improvements
  hasProperSpacing: /space-y-|gap-|mb-|mt-|p-/g
}

let totalIssues = 0
let totalImprovements = 0

formFiles.forEach(filePath => {
  const fullPath = path.join(__dirname, '..', filePath)
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  File not found: ${filePath}`)
    return
  }
  
  const content = fs.readFileSync(fullPath, 'utf8')
  console.log(`📄 Analyzing: ${filePath}`)
  
  let fileIssues = 0
  let fileImprovements = 0
  
  // Check for input fields without proper classes
  const inputFields = content.match(/input[^>]*type="[^"]*"[^>]*>/g) || []
  const textareas = content.match(/<textarea[^>]*>/g) || []
  const selects = content.match(/<select[^>]*>/g) || []
  
  console.log(`   📊 Found ${inputFields.length} input fields, ${textareas.length} textareas, ${selects.length} selects`)
  
  // Test each criteria
  Object.entries(readabilityCriteria).forEach(([criterion, regex]) => {
    const matches = content.match(regex) || []
    const count = matches.length
    
    if (count > 0) {
      console.log(`   ✅ ${criterion}: ${count} instances`)
      fileImprovements += count
    } else if (criterion === 'hasInputFieldClass' && inputFields.length > 0) {
      console.log(`   ❌ ${criterion}: Missing (${inputFields.length} input fields need classes)`)
      fileIssues += inputFields.length
    } else if (criterion === 'hasTextareaFieldClass' && textareas.length > 0) {
      console.log(`   ❌ ${criterion}: Missing (${textareas.length} textareas need classes)`)
      fileIssues += textareas.length
    }
  })
  
  // Check for German text in placeholders (should be English)
  const germanPlaceholders = content.match(/placeholder="[^"]*[äöüÄÖÜß][^"]*"/g) || []
  if (germanPlaceholders.length > 0) {
    console.log(`   ⚠️  German placeholders found: ${germanPlaceholders.length}`)
    fileIssues += germanPlaceholders.length
  }
  
  // Check for small font sizes that might be hard to read
  const smallFonts = content.match(/text-xs/g) || []
  if (smallFonts.length > 0) {
    console.log(`   ⚠️  Very small fonts (text-xs): ${smallFonts.length}`)
    fileIssues += smallFonts.length
  }
  
  // Check for proper form structure
  const formGroups = content.match(/className="[^"]*space-y-[^"]*"/g) || []
  if (formGroups.length > 0) {
    console.log(`   ✅ Form spacing: ${formGroups.length} instances`)
    fileImprovements += formGroups.length
  }
  
  totalIssues += fileIssues
  totalImprovements += fileImprovements
  
  console.log(`   📈 File score: ${fileImprovements} improvements, ${fileIssues} issues\n`)
})

// Check if global CSS has the improvements
const globalCssPath = path.join(__dirname, '..', 'app', 'globals.css')
if (fs.existsSync(globalCssPath)) {
  const globalCss = fs.readFileSync(globalCssPath, 'utf8')
  console.log('📄 Analyzing: app/globals.css')
  
  const cssImprovements = [
    { name: 'Input field base styles', regex: /\.input-field[^{]*{[^}]*min-height[^}]*}/s },
    { name: 'Textarea field styles', regex: /\.textarea-field[^{]*{[^}]*}/s },
    { name: 'Focus states', regex: /:focus[^{]*{[^}]*}/s },
    { name: 'Hover states', regex: /:hover[^{]*{[^}]*}/s },
    { name: 'Label improvements', regex: /label[^{]*{[^}]*font-weight[^}]*}/s },
    { name: 'Placeholder improvements', regex: /::placeholder[^{]*{[^}]*}/s },
    { name: 'Responsive design', regex: /@media[^{]*max-width[^}]*{[^}]*}/s },
    { name: 'Required field indicators', regex: /\.required::after[^{]*{[^}]*}/s }
  ]
  
  cssImprovements.forEach(({ name, regex }) => {
    if (regex.test(globalCss)) {
      console.log(`   ✅ ${name}: Present`)
      totalImprovements++
    } else {
      console.log(`   ❌ ${name}: Missing`)
      totalIssues++
    }
  })
}

console.log('\n' + '='.repeat(60))
console.log('📊 READABILITY TEST SUMMARY')
console.log('='.repeat(60))
console.log(`✅ Total improvements implemented: ${totalImprovements}`)
console.log(`❌ Total issues remaining: ${totalIssues}`)

const score = totalImprovements / (totalImprovements + totalIssues) * 100
console.log(`📈 Readability score: ${score.toFixed(1)}%`)

if (score >= 90) {
  console.log('🎉 Excellent! Input fields have great readability.')
} else if (score >= 75) {
  console.log('👍 Good! Most readability improvements are in place.')
} else if (score >= 50) {
  console.log('⚠️  Fair. Several readability issues need attention.')
} else {
  console.log('❌ Poor. Significant readability improvements needed.')
}

console.log('\n💡 RECOMMENDATIONS:')
console.log('- Ensure all input fields use .input-field or .textarea-field classes')
console.log('- Add required indicators to mandatory fields')
console.log('- Include helpful placeholder text and help text')
console.log('- Use consistent English text throughout forms')
console.log('- Test forms on mobile devices for touch accessibility')
console.log('- Verify color contrast meets WCAG guidelines')

process.exit(totalIssues > 0 ? 1 : 0)