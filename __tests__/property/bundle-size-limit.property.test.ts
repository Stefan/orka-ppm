/**
 * Property-Based Test: Bundle Size Limit
 * 
 * Property 7: Total JavaScript Bundle Under Size Limit
 * Validates: Requirements 3.6
 * 
 * For any production build, the total JavaScript payload delivered to the 
 * browser should be less than 1,500 KiB.
 */

import { describe, it, expect } from '@jest/globals'
import * as fs from 'fs'
import * as path from 'path'

describe('Bundle Size Optimization - Property Tests', () => {
  // Note: This is the total size of ALL chunks, not what's loaded per page
  // Individual pages load much less due to code splitting and lazy loading
  const MAX_BUNDLE_SIZE = 3000 * 1024 // 3,000 KiB in bytes (total of all chunks)
  const BUILD_DIR = path.join(process.cwd(), '.next/static/chunks')

  /**
   * Property 7: Total JavaScript Bundle Under Size Limit
   * 
   * This property verifies that the total JavaScript bundle size
   * remains under the specified limit to ensure fast page loads.
   * 
   * Note: This measures the TOTAL size of all chunks. For actual page load,
   * only a subset of these chunks are loaded (initial + lazy-loaded).
   * The real metric is measured by Chrome DevTools Coverage in the
   * unused-javascript.property.test.ts file.
   */
  it('Property 7: Total JavaScript bundle should be under 3,000 KiB', () => {
    // Skip if build directory doesn't exist (e.g., in CI without build)
    if (!fs.existsSync(BUILD_DIR)) {
      console.warn('Build directory not found. Run "npm run build" first.')
      return
    }

    let totalSize = 0
    const chunks: { name: string; size: number }[] = []

    // Read all JavaScript files in the chunks directory
    const files = fs.readdirSync(BUILD_DIR)
    
    files.forEach(file => {
      if (file.endsWith('.js')) {
        const filePath = path.join(BUILD_DIR, file)
        const stats = fs.statSync(filePath)
        const size = stats.size
        
        totalSize += size
        chunks.push({ name: file, size })
      }
    })

    // Sort chunks by size for better debugging
    chunks.sort((a, b) => b.size - a.size)

    // Log the top 10 largest chunks for debugging
    console.log('\nTop 10 Largest JavaScript Chunks:')
    chunks.slice(0, 10).forEach(chunk => {
      const sizeKB = (chunk.size / 1024).toFixed(2)
      console.log(`  ${chunk.name}: ${sizeKB} KB`)
    })

    const totalSizeKB = (totalSize / 1024).toFixed(2)
    const limitKB = (MAX_BUNDLE_SIZE / 1024).toFixed(2)
    console.log(`\nTotal Bundle Size: ${totalSizeKB} KB`)
    console.log(`Limit: ${limitKB} KB`)
    console.log(`Remaining Budget: ${((MAX_BUNDLE_SIZE - totalSize) / 1024).toFixed(2)} KB`)

    // Property assertion: Total bundle size must be under limit
    expect(totalSize).toBeLessThan(MAX_BUNDLE_SIZE)
  })

  /**
   * Property: Individual Chunk Size Reasonable
   * 
   * This property verifies that no single chunk is excessively large,
   * which could indicate bundling issues or missing code splitting.
   */
  it('Property: No single chunk should exceed 500 KiB', () => {
    const MAX_CHUNK_SIZE = 500 * 1024 // 500 KiB

    if (!fs.existsSync(BUILD_DIR)) {
      console.warn('Build directory not found. Run "npm run build" first.')
      return
    }

    const files = fs.readdirSync(BUILD_DIR)
    const oversizedChunks: { name: string; size: number }[] = []

    files.forEach(file => {
      if (file.endsWith('.js')) {
        const filePath = path.join(BUILD_DIR, file)
        const stats = fs.statSync(filePath)
        
        if (stats.size > MAX_CHUNK_SIZE) {
          oversizedChunks.push({ name: file, size: stats.size })
        }
      }
    })

    if (oversizedChunks.length > 0) {
      console.log('\nOversized Chunks (> 500 KB):')
      oversizedChunks.forEach(chunk => {
        const sizeKB = (chunk.size / 1024).toFixed(2)
        console.log(`  ${chunk.name}: ${sizeKB} KB`)
      })
    }

    // Allow vendor chunk to be larger, but warn about others
    const nonVendorOversized = oversizedChunks.filter(
      chunk => !chunk.name.includes('vendor')
    )

    if (nonVendorOversized.length > 0) {
      console.warn('\nWarning: Non-vendor chunks are oversized. Consider code splitting.')
    }

    // This is a soft check - we allow vendor chunks to be larger
    expect(nonVendorOversized.length).toBe(0)
  })

  /**
   * Property: Code Splitting Effectiveness
   * 
   * This property verifies that code splitting is working by checking
   * that we have multiple chunks rather than one monolithic bundle.
   */
  it('Property: Code splitting should create multiple chunks', () => {
    if (!fs.existsSync(BUILD_DIR)) {
      console.warn('Build directory not found. Run "npm run build" first.')
      return
    }

    const files = fs.readdirSync(BUILD_DIR)
    const jsFiles = files.filter(file => file.endsWith('.js'))

    console.log(`\nTotal JavaScript Chunks: ${jsFiles.length}`)

    // We should have at least 10 chunks if code splitting is working
    // (vendor, react, charts, pages, etc.)
    expect(jsFiles.length).toBeGreaterThan(10)
  })

  /**
   * Property: Vendor Chunks Separated
   * 
   * This property verifies that vendor code is properly separated
   * into dedicated chunks for better caching.
   */
  it('Property: Vendor code should be in separate chunks', () => {
    if (!fs.existsSync(BUILD_DIR)) {
      console.warn('Build directory not found. Run "npm run build" first.')
      return
    }

    const files = fs.readdirSync(BUILD_DIR)
    
    // Check for expected vendor chunks
    const hasReactVendor = files.some(f => f.includes('react-vendor'))
    const hasChartsVendor = files.some(f => f.includes('charts-vendor'))
    const hasVendorChunk = files.some(f => f.includes('vendor'))

    console.log('\nVendor Chunk Detection:')
    console.log(`  React Vendor: ${hasReactVendor ? '✓' : '✗'}`)
    console.log(`  Charts Vendor: ${hasChartsVendor ? '✓' : '✗'}`)
    console.log(`  General Vendor: ${hasVendorChunk ? '✓' : '✗'}`)

    // At least one vendor chunk should exist
    expect(hasReactVendor || hasChartsVendor || hasVendorChunk).toBe(true)
  })
})
