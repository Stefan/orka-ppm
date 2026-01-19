#!/usr/bin/env node

/**
 * Bundle Size Analysis Script
 * Analyzes Next.js build output and reports bundle sizes
 */

const fs = require('fs')
const path = require('path')

const BUILD_DIR = path.join(__dirname, '../.next')
const STATIC_DIR = path.join(BUILD_DIR, 'static')

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}

function analyzeDirectory(dir, results = {}) {
  if (!fs.existsSync(dir)) return results

  const files = fs.readdirSync(dir)

  files.forEach(file => {
    const filePath = path.join(dir, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      analyzeDirectory(filePath, results)
    } else if (file.endsWith('.js') || file.endsWith('.css')) {
      const relativePath = path.relative(BUILD_DIR, filePath)
      results[relativePath] = stat.size
    }
  })

  return results
}

function generateReport() {
  console.log('\n📦 Bundle Size Analysis\n')
  console.log('=' .repeat(80))

  const results = analyzeDirectory(STATIC_DIR)
  const entries = Object.entries(results).sort((a, b) => b[1] - a[1])

  let totalSize = 0
  const categories = {
    pages: [],
    chunks: [],
    vendor: [],
    css: []
  }

  entries.forEach(([file, size]) => {
    totalSize += size

    if (file.includes('/pages/')) {
      categories.pages.push({ file, size })
    } else if (file.includes('vendor') || file.includes('react') || file.includes('charts')) {
      categories.vendor.push({ file, size })
    } else if (file.endsWith('.css')) {
      categories.css.push({ file, size })
    } else {
      categories.chunks.push({ file, size })
    }
  })

  console.log(`\n📄 Total Bundle Size: ${formatBytes(totalSize)}\n`)

  // Report by category
  Object.entries(categories).forEach(([category, files]) => {
    if (files.length === 0) return

    const categorySize = files.reduce((sum, f) => sum + f.size, 0)
    console.log(`\n${category.toUpperCase()} (${formatBytes(categorySize)}):`)
    console.log('-'.repeat(80))

    files.slice(0, 10).forEach(({ file, size }) => {
      const fileName = path.basename(file)
      console.log(`  ${formatBytes(size).padEnd(12)} ${fileName}`)
    })

    if (files.length > 10) {
      console.log(`  ... and ${files.length - 10} more files`)
    }
  })

  // Warnings
  console.log('\n⚠️  Warnings:\n')
  const largeFiles = entries.filter(([, size]) => size > 500000) // > 500KB

  if (largeFiles.length > 0) {
    console.log('Large files detected (>500KB):')
    largeFiles.forEach(([file, size]) => {
      console.log(`  ❌ ${formatBytes(size).padEnd(12)} ${path.basename(file)}`)
    })
  } else {
    console.log('  ✅ No files larger than 500KB')
  }

  // Recommendations
  console.log('\n💡 Recommendations:\n')
  
  const jsSize = entries.filter(([f]) => f.endsWith('.js')).reduce((sum, [, s]) => sum + s, 0)
  const cssSize = entries.filter(([f]) => f.endsWith('.css')).reduce((sum, [, s]) => sum + s, 0)

  if (jsSize > 1000000) {
    console.log('  • Consider code splitting for JavaScript bundles')
  }
  if (cssSize > 200000) {
    console.log('  • Consider CSS optimization and purging unused styles')
  }
  if (largeFiles.length > 0) {
    console.log('  • Use dynamic imports for large components')
    console.log('  • Enable tree shaking for vendor libraries')
  }

  console.log('\n' + '='.repeat(80) + '\n')
}

try {
  generateReport()
} catch (error) {
  console.error('Error analyzing bundle:', error.message)
  process.exit(1)
}
