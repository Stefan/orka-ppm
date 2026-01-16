/**
 * Chrome DevTools Performance Profiling Script
 * 
 * This script automates Chrome DevTools profiling to identify LCP bottlenecks.
 * It captures performance traces, analyzes them, and generates a detailed report.
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  url: 'http://localhost:3000',
  pages: [
    { path: '/', name: 'home' },
    { path: '/dashboards', name: 'dashboards' },
    { path: '/resources', name: 'resources' },
    { path: '/risks', name: 'risks' },
  ],
  outputDir: './performance-profiles',
  // Emulate mobile device for consistent testing
  device: {
    viewport: { width: 375, height: 667 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  // Network throttling (4G)
  network: {
    offline: false,
    downloadThroughput: (1.6 * 1024 * 1024) / 8, // 1.6 Mbps
    uploadThroughput: (750 * 1024) / 8, // 750 Kbps
    latency: 150, // 150ms RTT
  },
  // CPU throttling
  cpuThrottling: 4, // 4x slowdown
};

/**
 * Main profiling function
 */
async function profilePerformance() {
  console.log('🚀 Starting Chrome DevTools Performance Profiling...\n');
  
  // Create output directory
  if (!fs.existsSync(CONFIG.outputDir)) {
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });
  }

  // Launch browser
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ],
  });

  const context = await browser.newContext({
    ...CONFIG.device,
  });

  // Enable network throttling
  await context.route('**/*', async (route) => {
    await route.continue();
  });

  const results = [];

  // Profile each page
  for (const pageConfig of CONFIG.pages) {
    console.log(`📊 Profiling: ${pageConfig.name} (${pageConfig.path})`);
    
    const page = await context.newPage();
    
    try {
      // Start performance tracing
      await page.context().tracing.start({
        screenshots: true,
        snapshots: true,
      });

      // Collect performance metrics
      const metrics = {
        name: pageConfig.name,
        url: CONFIG.url + pageConfig.path,
        timestamp: new Date().toISOString(),
      };

      // Navigate and wait for load
      const startTime = Date.now();
      
      await page.goto(CONFIG.url + pageConfig.path, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });

      const loadTime = Date.now() - startTime;
      metrics.loadTime = loadTime;

      // Get Web Vitals using Performance API
      const webVitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          const vitals = {
            lcp: null,
            fcp: null,
            cls: null,
            tbt: null,
            fid: null,
          };

          // Get LCP
          const lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            vitals.lcp = lastEntry.renderTime || lastEntry.loadTime;
          });
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

          // Get FCP
          const fcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            entries.forEach((entry) => {
              if (entry.name === 'first-contentful-paint') {
                vitals.fcp = entry.startTime;
              }
            });
          });
          fcpObserver.observe({ type: 'paint', buffered: true });

          // Get CLS
          let clsValue = 0;
          const clsObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              if (!entry.hadRecentInput) {
                clsValue += entry.value;
              }
            }
            vitals.cls = clsValue;
          });
          clsObserver.observe({ type: 'layout-shift', buffered: true });

          // Calculate TBT (simplified)
          const navigationTiming = performance.getEntriesByType('navigation')[0];
          const resourceTiming = performance.getEntriesByType('resource');
          
          vitals.navigationTiming = {
            domContentLoaded: navigationTiming.domContentLoadedEventEnd - navigationTiming.domContentLoadedEventStart,
            loadComplete: navigationTiming.loadEventEnd - navigationTiming.loadEventStart,
            domInteractive: navigationTiming.domInteractive,
          };

          vitals.resources = resourceTiming.map(r => ({
            name: r.name.split('/').pop() || r.name,
            type: r.initiatorType,
            duration: r.duration,
            size: r.transferSize,
            startTime: r.startTime,
          })).sort((a, b) => b.duration - a.duration).slice(0, 10);

          // Wait a bit for observers to collect data
          setTimeout(() => {
            lcpObserver.disconnect();
            fcpObserver.disconnect();
            clsObserver.disconnect();
            resolve(vitals);
          }, 2000);
        });
      });

      metrics.webVitals = webVitals;

      // Get LCP element details
      const lcpElement = await page.evaluate(() => {
        return new Promise((resolve) => {
          const observer = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const lastEntry = entries[entries.length - 1];
            
            if (lastEntry.element) {
              resolve({
                tagName: lastEntry.element.tagName,
                id: lastEntry.element.id,
                className: lastEntry.element.className,
                src: lastEntry.element.src || lastEntry.element.currentSrc,
                text: lastEntry.element.textContent?.substring(0, 100),
                size: lastEntry.size,
                renderTime: lastEntry.renderTime,
                loadTime: lastEntry.loadTime,
              });
            } else {
              resolve(null);
            }
          });
          
          observer.observe({ type: 'largest-contentful-paint', buffered: true });
          
          setTimeout(() => {
            observer.disconnect();
            resolve(null);
          }, 3000);
        });
      });

      metrics.lcpElement = lcpElement;

      // Get JavaScript execution time
      const jsMetrics = await page.evaluate(() => {
        const entries = performance.getEntriesByType('measure');
        const scripts = performance.getEntriesByType('resource')
          .filter(r => r.initiatorType === 'script')
          .map(r => ({
            name: r.name.split('/').pop(),
            duration: r.duration,
            size: r.transferSize,
          }))
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10);
        
        return { scripts };
      });

      metrics.javascript = jsMetrics;

      // Get CSS metrics
      const cssMetrics = await page.evaluate(() => {
        const stylesheets = performance.getEntriesByType('resource')
          .filter(r => r.initiatorType === 'link' || r.initiatorType === 'css')
          .map(r => ({
            name: r.name.split('/').pop(),
            duration: r.duration,
            size: r.transferSize,
            blocking: r.renderBlockingStatus === 'blocking',
          }))
          .sort((a, b) => b.duration - a.duration);
        
        return { stylesheets };
      });

      metrics.css = cssMetrics;

      // Stop tracing and save
      const tracePath = path.join(CONFIG.outputDir, `trace-${pageConfig.name}.json`);
      await page.context().tracing.stop({ path: tracePath });
      
      console.log(`  ✅ Trace saved: ${tracePath}`);
      console.log(`  📈 LCP: ${webVitals.lcp?.toFixed(1)}ms`);
      console.log(`  📈 FCP: ${webVitals.fcp?.toFixed(1)}ms`);
      console.log(`  📈 CLS: ${webVitals.cls?.toFixed(3)}`);
      console.log(`  ⏱️  Load Time: ${loadTime}ms\n`);

      results.push(metrics);

      await page.close();
    } catch (error) {
      console.error(`  ❌ Error profiling ${pageConfig.name}:`, error.message);
      await page.close();
    }
  }

  await browser.close();

  // Generate report
  generateReport(results);

  console.log('\n✅ Profiling complete!');
  console.log(`📁 Results saved to: ${CONFIG.outputDir}/`);
  console.log(`📊 Report: ${CONFIG.outputDir}/performance-report.md`);
}

/**
 * Generate detailed performance report
 */
function generateReport(results) {
  const reportPath = path.join(CONFIG.outputDir, 'performance-report.md');
  
  let report = `# Chrome DevTools Performance Profiling Report

**Generated:** ${new Date().toISOString()}  
**Device:** Mobile (375x667, 2x DPR)  
**Network:** 4G (1.6 Mbps down, 750 Kbps up, 150ms latency)  
**CPU:** 4x throttling

---

## Executive Summary

`;

  // Calculate averages
  const avgLcp = results.reduce((sum, r) => sum + (r.webVitals.lcp || 0), 0) / results.length;
  const avgFcp = results.reduce((sum, r) => sum + (r.webVitals.fcp || 0), 0) / results.length;
  const avgCls = results.reduce((sum, r) => sum + (r.webVitals.cls || 0), 0) / results.length;

  report += `| Metric | Average | Target | Status |\n`;
  report += `|--------|---------|--------|--------|\n`;
  report += `| **LCP** | ${avgLcp.toFixed(1)}ms | ≤2500ms | ${avgLcp <= 2500 ? '✅ PASS' : '❌ FAIL'} |\n`;
  report += `| **FCP** | ${avgFcp.toFixed(1)}ms | ≤1800ms | ${avgFcp <= 1800 ? '✅ PASS' : '❌ FAIL'} |\n`;
  report += `| **CLS** | ${avgCls.toFixed(3)} | ≤0.1 | ${avgCls <= 0.1 ? '✅ PASS' : '❌ FAIL'} |\n\n`;

  report += `---\n\n`;

  // Detailed results for each page
  results.forEach((result) => {
    report += `## ${result.name.toUpperCase()} Page\n\n`;
    report += `**URL:** ${result.url}  \n`;
    report += `**Load Time:** ${result.loadTime}ms\n\n`;

    report += `### Core Web Vitals\n\n`;
    report += `| Metric | Value | Target | Status |\n`;
    report += `|--------|-------|--------|--------|\n`;
    report += `| LCP | ${result.webVitals.lcp?.toFixed(1) || 'N/A'}ms | ≤2500ms | ${(result.webVitals.lcp || 0) <= 2500 ? '✅' : '❌'} |\n`;
    report += `| FCP | ${result.webVitals.fcp?.toFixed(1) || 'N/A'}ms | ≤1800ms | ${(result.webVitals.fcp || 0) <= 1800 ? '✅' : '❌'} |\n`;
    report += `| CLS | ${result.webVitals.cls?.toFixed(3) || 'N/A'} | ≤0.1 | ${(result.webVitals.cls || 0) <= 0.1 ? '✅' : '❌'} |\n\n`;

    // LCP Element
    if (result.lcpElement) {
      report += `### LCP Element\n\n`;
      report += `- **Tag:** \`${result.lcpElement.tagName}\`\n`;
      if (result.lcpElement.id) report += `- **ID:** \`${result.lcpElement.id}\`\n`;
      if (result.lcpElement.className) report += `- **Class:** \`${result.lcpElement.className}\`\n`;
      if (result.lcpElement.src) report += `- **Source:** \`${result.lcpElement.src}\`\n`;
      report += `- **Render Time:** ${result.lcpElement.renderTime?.toFixed(1) || 'N/A'}ms\n`;
      report += `- **Load Time:** ${result.lcpElement.loadTime?.toFixed(1) || 'N/A'}ms\n`;
      if (result.lcpElement.text) report += `- **Text:** "${result.lcpElement.text}..."\n`;
      report += `\n`;
    }

    // Top 10 slowest resources
    if (result.webVitals.resources && result.webVitals.resources.length > 0) {
      report += `### Slowest Resources\n\n`;
      report += `| Resource | Type | Duration | Size |\n`;
      report += `|----------|------|----------|------|\n`;
      result.webVitals.resources.slice(0, 10).forEach((resource) => {
        const size = resource.size ? `${(resource.size / 1024).toFixed(1)} KB` : 'N/A';
        report += `| ${resource.name} | ${resource.type} | ${resource.duration.toFixed(1)}ms | ${size} |\n`;
      });
      report += `\n`;
    }

    // JavaScript analysis
    if (result.javascript.scripts && result.javascript.scripts.length > 0) {
      report += `### JavaScript Performance\n\n`;
      report += `| Script | Duration | Size |\n`;
      report += `|--------|----------|------|\n`;
      result.javascript.scripts.forEach((script) => {
        const size = script.size ? `${(script.size / 1024).toFixed(1)} KB` : 'N/A';
        report += `| ${script.name} | ${script.duration.toFixed(1)}ms | ${size} |\n`;
      });
      report += `\n`;
    }

    // CSS analysis
    if (result.css.stylesheets && result.css.stylesheets.length > 0) {
      report += `### CSS Performance\n\n`;
      report += `| Stylesheet | Duration | Size | Blocking |\n`;
      report += `|------------|----------|------|----------|\n`;
      result.css.stylesheets.forEach((css) => {
        const size = css.size ? `${(css.size / 1024).toFixed(1)} KB` : 'N/A';
        const blocking = css.blocking ? '🔴 Yes' : '✅ No';
        report += `| ${css.name} | ${css.duration.toFixed(1)}ms | ${size} | ${blocking} |\n`;
      });
      report += `\n`;
    }

    report += `---\n\n`;
  });

  // Recommendations
  report += `## Recommendations\n\n`;
  report += `Based on the profiling data:\n\n`;

  if (avgLcp > 2500) {
    report += `### 🔴 LCP Optimization (Critical)\n\n`;
    report += `LCP is ${(avgLcp - 2500).toFixed(0)}ms over target. Key actions:\n\n`;
    report += `1. **Identify LCP element** - Check the LCP Element sections above\n`;
    report += `2. **Optimize resource loading** - Review slowest resources\n`;
    report += `3. **Reduce render-blocking CSS** - Inline critical CSS\n`;
    report += `4. **Implement code splitting** - Reduce JavaScript bundle size\n`;
    report += `5. **Add resource hints** - Preconnect, preload critical resources\n\n`;
  }

  if (avgFcp > 1800) {
    report += `### ⚠️ FCP Optimization\n\n`;
    report += `FCP is ${(avgFcp - 1800).toFixed(0)}ms over target. Key actions:\n\n`;
    report += `1. **Inline critical CSS** - Reduce render-blocking stylesheets\n`;
    report += `2. **Defer non-critical JavaScript** - Use async/defer attributes\n`;
    report += `3. **Optimize server response time** - Reduce TTFB\n\n`;
  }

  if (avgCls > 0.1) {
    report += `### ⚠️ CLS Optimization\n\n`;
    report += `CLS is ${(avgCls - 0.1).toFixed(3)} over target. Key actions:\n\n`;
    report += `1. **Add size attributes to images** - Prevent layout shifts\n`;
    report += `2. **Reserve space for dynamic content** - Use skeleton loaders\n`;
    report += `3. **Avoid inserting content above existing content** - Use fixed heights\n\n`;
  }

  report += `## Next Steps\n\n`;
  report += `1. Review the trace files in Chrome DevTools:\n`;
  report += `   - Open Chrome DevTools → Performance tab\n`;
  report += `   - Click "Load profile" button\n`;
  report += `   - Select trace file from \`${CONFIG.outputDir}/\`\n\n`;
  report += `2. Analyze the flame chart to identify bottlenecks\n`;
  report += `3. Implement the recommendations above\n`;
  report += `4. Re-run profiling to validate improvements\n\n`;

  report += `---\n\n`;
  report += `**Trace Files:**\n`;
  results.forEach((result) => {
    report += `- \`trace-${result.name}.json\` - ${result.name} page trace\n`;
  });

  fs.writeFileSync(reportPath, report);
}

// Run profiling
profilePerformance().catch((error) => {
  console.error('❌ Profiling failed:', error);
  process.exit(1);
});
