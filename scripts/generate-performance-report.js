#!/usr/bin/env node

/**
 * Performance Report Generator
 * Generates comprehensive performance reports from Lighthouse CI results
 */

const fs = require('fs')
const path = require('path')

const LIGHTHOUSE_DIR = '.lighthouseci'
const REPORTS_DIR = 'performance-reports'

function ensureDirectoryExists(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

function readLighthouseResults() {
  // Try multiple possible locations for Lighthouse results
  const possiblePaths = [
    path.join(LIGHTHOUSE_DIR, 'lhr'),           // Standard lhr directory
    path.join(LIGHTHOUSE_DIR),                   // Root .lighthouseci directory
    path.join('.lighthouseci'),                  // Alternative path
  ]
  
  for (const resultsPath of possiblePaths) {
    if (!fs.existsSync(resultsPath)) {
      continue
    }
    
    const files = fs.readdirSync(resultsPath)
      .filter(file => file.endsWith('.json') && !file.includes('assertion') && !file.includes('links') && !file.includes('manifest'))
    
    if (files.length > 0) {
      console.log(`Found ${files.length} Lighthouse result files in ${resultsPath}`)
      return files.map(file => {
        const filePath = path.join(resultsPath, file)
        const content = fs.readFileSync(filePath, 'utf8')
        return JSON.parse(content)
      })
    }
  }
  
  // Check if we have links.json with uploaded results (cloud storage mode)
  const linksPath = path.join(LIGHTHOUSE_DIR, 'links.json')
  if (fs.existsSync(linksPath)) {
    console.log('Lighthouse results were uploaded to cloud storage (links.json found)')
    console.log('Skipping local report generation - results available via Lighthouse CI dashboard')
    return null // Signal that results are in cloud, not local
  }
  
  console.log('No Lighthouse results found in any expected location')
  return []
}

function calculateAverageScore(results, category) {
  if (results.length === 0) return 0
  
  const scores = results
    .map(result => result.categories[category]?.score || 0)
    .filter(score => score > 0)
  
  if (scores.length === 0) return 0
  
  return Math.round((scores.reduce((sum, score) => sum + score, 0) / scores.length) * 100)
}

function calculateAverageMetric(results, metricName) {
  if (results.length === 0) return 0
  
  const values = results
    .map(result => result.audits[metricName]?.numericValue || 0)
    .filter(value => value > 0)
  
  if (values.length === 0) return 0
  
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)
}

function generateSummaryReport(results) {
  const summary = {
    timestamp: new Date().toISOString(),
    totalPages: results.length,
    performance: calculateAverageScore(results, 'performance'),
    bestPractices: calculateAverageScore(results, 'best-practices'),
    seo: calculateAverageScore(results, 'seo'),
    
    // Core Web Vitals
    lcp: calculateAverageMetric(results, 'largest-contentful-paint'),
    fid: calculateAverageMetric(results, 'max-potential-fid'),
    cls: Math.round(calculateAverageMetric(results, 'cumulative-layout-shift') * 100) / 100,
    fcp: calculateAverageMetric(results, 'first-contentful-paint'),
    ttfb: calculateAverageMetric(results, 'server-response-time'),
    
    // Resource metrics
    totalBlockingTime: calculateAverageMetric(results, 'total-blocking-time'),
    speedIndex: calculateAverageMetric(results, 'speed-index'),
    
    // Page-specific results
    pages: results.map(result => ({
      url: result.finalUrl,
      performance: Math.round((result.categories.performance?.score || 0) * 100),
      bestPractices: Math.round((result.categories['best-practices']?.score || 0) * 100),
      seo: Math.round((result.categories.seo?.score || 0) * 100),
      lcp: result.audits['largest-contentful-paint']?.numericValue || 0,
      fid: result.audits['max-potential-fid']?.numericValue || 0,
      cls: result.audits['cumulative-layout-shift']?.numericValue || 0
    }))
  }
  
  return summary
}

function generateDetailedReport(results) {
  const detailed = {
    timestamp: new Date().toISOString(),
    summary: generateSummaryReport(results),
    
    // Performance trends
    trends: {
      performance: results.map(r => Math.round((r.categories.performance?.score || 0) * 100)),
      lcp: results.map(r => r.audits['largest-contentful-paint']?.numericValue || 0),
      cls: results.map(r => r.audits['cumulative-layout-shift']?.numericValue || 0)
    },
    
    // Failed audits
    failedAudits: results.reduce((acc, result) => {
      Object.entries(result.audits).forEach(([auditId, audit]) => {
        if (audit.score !== null && audit.score < 1) {
          if (!acc[auditId]) {
            acc[auditId] = {
              title: audit.title,
              description: audit.description,
              failureCount: 0,
              pages: []
            }
          }
          acc[auditId].failureCount++
          acc[auditId].pages.push(result.finalUrl)
        }
      })
      return acc
    }, {}),
    
    // Opportunities
    opportunities: results.reduce((acc, result) => {
      Object.entries(result.audits).forEach(([auditId, audit]) => {
        if (audit.details && audit.details.overallSavingsMs > 0) {
          if (!acc[auditId]) {
            acc[auditId] = {
              title: audit.title,
              description: audit.description,
              totalSavings: 0,
              pages: []
            }
          }
          acc[auditId].totalSavings += audit.details.overallSavingsMs
          acc[auditId].pages.push({
            url: result.finalUrl,
            savings: audit.details.overallSavingsMs
          })
        }
      })
      return acc
    }, {})
  }
  
  return detailed
}

function generateMarkdownReport(summary) {
  const getStatusEmoji = (score, threshold = 80) => score >= threshold ? '✅' : '❌'
  const getCoreVitalStatus = (metric, threshold) => metric <= threshold ? '✅' : '❌'
  
  return `# Performance Report

Generated: ${new Date(summary.timestamp).toLocaleString()}

## Overall Scores

| Category | Score | Status |
|----------|-------|--------|
| Performance | ${summary.performance}% | ${getStatusEmoji(summary.performance)} |
| Best Practices | ${summary.bestPractices}% | ${getStatusEmoji(summary.bestPractices)} |
| SEO | ${summary.seo}% | ${getStatusEmoji(summary.seo)} |

## Core Web Vitals

| Metric | Value | Status | Threshold |
|--------|-------|--------|-----------|
| Largest Contentful Paint (LCP) | ${summary.lcp}ms | ${getCoreVitalStatus(summary.lcp, 2500)} | ≤ 2500ms |
| First Input Delay (FID) | ${summary.fid}ms | ${getCoreVitalStatus(summary.fid, 100)} | ≤ 100ms |
| Cumulative Layout Shift (CLS) | ${summary.cls} | ${getCoreVitalStatus(summary.cls, 0.1)} | ≤ 0.1 |
| First Contentful Paint (FCP) | ${summary.fcp}ms | ${getCoreVitalStatus(summary.fcp, 1800)} | ≤ 1800ms |
| Time to First Byte (TTFB) | ${summary.ttfb}ms | ${getCoreVitalStatus(summary.ttfb, 800)} | ≤ 800ms |

## Page-Specific Results

${summary.pages.map(page => `
### ${page.url}

- **Performance**: ${page.performance}% ${getStatusEmoji(page.performance)}
- **Best Practices**: ${page.bestPractices}% ${getStatusEmoji(page.bestPractices)}
- **SEO**: ${page.seo}% ${getStatusEmoji(page.seo)}
- **LCP**: ${page.lcp}ms ${getCoreVitalStatus(page.lcp, 2500)}
- **CLS**: ${page.cls} ${getCoreVitalStatus(page.cls, 0.1)}
`).join('\n')}

## Recommendations

${summary.performance < 80 ? '- 🚨 **Performance score is below 80%** - Consider optimizing images, reducing JavaScript, and improving server response times.' : ''}
${summary.lcp > 2500 ? '- 🚨 **LCP is above 2.5s** - Optimize images, improve server response time, and consider preloading critical resources.' : ''}
${summary.cls > 0.1 ? '- 🚨 **CLS is above 0.1** - Ensure proper sizing for images and ads, avoid inserting content above existing content.' : ''}

---
*Report generated by Lighthouse CI*
`
}

function main() {
  console.log('📊 Generating performance report...')
  
  // Ensure reports directory exists
  ensureDirectoryExists(REPORTS_DIR)
  
  // Read Lighthouse results
  const results = readLighthouseResults()
  
  // Handle cloud storage mode (results uploaded, not stored locally)
  if (results === null) {
    console.log('✅ Lighthouse results uploaded to cloud - check CI logs for report URLs')
    
    // Create a minimal report indicating cloud storage mode
    const cloudReport = {
      timestamp: new Date().toISOString(),
      mode: 'cloud',
      message: 'Results uploaded to Lighthouse CI cloud storage. Check CI logs for report URLs.'
    }
    
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'summary.json'),
      JSON.stringify(cloudReport, null, 2)
    )
    
    process.exit(0)
  }
  
  if (results.length === 0) {
    console.log('⚠️ No Lighthouse results found - skipping report generation')
    
    // Create empty report to prevent downstream failures
    const emptyReport = {
      timestamp: new Date().toISOString(),
      mode: 'empty',
      message: 'No Lighthouse results available for report generation.'
    }
    
    fs.writeFileSync(
      path.join(REPORTS_DIR, 'summary.json'),
      JSON.stringify(emptyReport, null, 2)
    )
    
    // Exit successfully - missing results shouldn't fail the build
    process.exit(0)
  }
  
  console.log(`📈 Processing ${results.length} Lighthouse results...`)
  
  // Generate reports
  const summary = generateSummaryReport(results)
  const detailed = generateDetailedReport(results)
  const markdown = generateMarkdownReport(summary)
  
  // Write reports
  fs.writeFileSync(
    path.join(REPORTS_DIR, 'summary.json'),
    JSON.stringify(summary, null, 2)
  )
  
  fs.writeFileSync(
    path.join(REPORTS_DIR, 'detailed.json'),
    JSON.stringify(detailed, null, 2)
  )
  
  fs.writeFileSync(
    path.join(REPORTS_DIR, 'report.md'),
    markdown
  )
  
  // Output summary to console
  console.log('\n📊 Performance Summary:')
  console.log(`Performance: ${summary.performance}% ${summary.performance >= 80 ? '✅' : '❌'}`)
  console.log(`LCP: ${summary.lcp}ms ${summary.lcp <= 2500 ? '✅' : '❌'}`)
  console.log(`CLS: ${summary.cls} ${summary.cls <= 0.1 ? '✅' : '❌'}`)
  
  console.log(`\n✅ Reports generated in ${REPORTS_DIR}/`)
  
  // Exit with error code if performance is poor
  if (summary.performance < 70) {
    console.log('❌ Performance thresholds not met')
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = {
  generateSummaryReport,
  generateDetailedReport,
  generateMarkdownReport
}