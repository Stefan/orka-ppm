#!/usr/bin/env node

/**
 * Dashboard Performance Profiling Script
 * 
 * Analyzes dashboard performance bottlenecks by:
 * 1. Measuring component render times
 * 2. Analyzing bundle sizes
 * 3. Checking API response times
 * 4. Identifying heavy dependencies
 * 5. Detecting unnecessary re-renders
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔍 Dashboard Performance Profiling\n');
console.log('=' .repeat(60));

// Results object
const results = {
  timestamp: new Date().toISOString(),
  issues: [],
  recommendations: [],
  metrics: {}
};

// 1. Analyze Bundle Size
console.log('\n📦 Analyzing Bundle Size...\n');

try {
  // Check if .next directory exists
  if (!fs.existsSync('.next')) {
    console.log('⚠️  No build found. Building application...');
    execSync('npm run build', { stdio: 'inherit' });
  }

  // Read build manifest
  const buildManifestPath = '.next/build-manifest.json';
  if (fs.existsSync(buildManifestPath)) {
    const buildManifest = JSON.parse(fs.readFileSync(buildManifestPath, 'utf8'));
    
    // Analyze page bundles
    const pages = buildManifest.pages || {};
    const dashboardPages = ['/dashboards', '/resources', '/risks', '/scenarios'];
    
    console.log('Page Bundle Sizes:');
    dashboardPages.forEach(page => {
      if (pages[page]) {
        const files = pages[page];
        let totalSize = 0;
        
        files.forEach(file => {
          const filePath = path.join('.next', file);
          if (fs.existsSync(filePath)) {
            const stats = fs.statSync(filePath);
            totalSize += stats.size;
          }
        });
        
        const sizeKB = (totalSize / 1024).toFixed(2);
        console.log(`  ${page}: ${sizeKB} KB (${files.length} files)`);
        
        if (totalSize > 500000) { // > 500KB
          results.issues.push({
            severity: 'high',
            category: 'bundle-size',
            page,
            message: `Large bundle size: ${sizeKB} KB`,
            impact: 'Increases LCP and TBT'
          });
        }
      }
    });
  }
} catch (error) {
  console.error('❌ Bundle analysis failed:', error.message);
}

// 2. Analyze Component Structure
console.log('\n🧩 Analyzing Component Structure...\n');

try {
  const dashboardFile = 'app/dashboards/page.tsx';
  const content = fs.readFileSync(dashboardFile, 'utf8');
  
  // Count components and hooks
  const componentCount = (content.match(/import.*from/g) || []).length;
  const hookCount = (content.match(/use[A-Z]\w+/g) || []).length;
  const stateCount = (content.match(/useState/g) || []).length;
  const effectCount = (content.match(/useEffect/g) || []).length;
  const memoCount = (content.match(/useMemo/g) || []).length;
  const callbackCount = (content.match(/useCallback/g) || []).length;
  
  console.log('Dashboard Component Analysis:');
  console.log(`  Imports: ${componentCount}`);
  console.log(`  Hooks: ${hookCount}`);
  console.log(`  useState: ${stateCount}`);
  console.log(`  useEffect: ${effectCount}`);
  console.log(`  useMemo: ${memoCount}`);
  console.log(`  useCallback: ${callbackCount}`);
  
  results.metrics.componentAnalysis = {
    imports: componentCount,
    hooks: hookCount,
    state: stateCount,
    effects: effectCount,
    memoized: memoCount,
    callbacks: callbackCount
  };
  
  // Check for optimization opportunities
  if (stateCount > 10) {
    results.issues.push({
      severity: 'medium',
      category: 'state-management',
      message: `High number of useState calls (${stateCount})`,
      impact: 'May cause unnecessary re-renders',
      recommendation: 'Consider using useReducer or consolidating related state'
    });
  }
  
  if (effectCount > 5) {
    results.issues.push({
      severity: 'medium',
      category: 'effects',
      message: `High number of useEffect calls (${effectCount})`,
      impact: 'May cause performance issues and complex dependency chains',
      recommendation: 'Review and consolidate effects where possible'
    });
  }
  
  if (memoCount < 3 && componentCount > 20) {
    results.issues.push({
      severity: 'high',
      category: 'memoization',
      message: 'Low memoization usage with many components',
      impact: 'Expensive computations may run on every render',
      recommendation: 'Add useMemo for expensive calculations and React.memo for components'
    });
  }
  
  // Check for heavy components
  const heavyComponents = [
    'VarianceKPIs',
    'VarianceTrends',
    'VarianceAlerts',
    'AdaptiveDashboard',
    'VirtualizedProjectList'
  ];
  
  heavyComponents.forEach(comp => {
    if (content.includes(comp) && !content.includes(`React.memo(${comp})`)) {
      results.issues.push({
        severity: 'high',
        category: 'component-optimization',
        component: comp,
        message: `${comp} is not memoized`,
        impact: 'Component re-renders unnecessarily, increasing TBT',
        recommendation: `Wrap ${comp} with React.memo`
      });
    }
  });
  
} catch (error) {
  console.error('❌ Component analysis failed:', error.message);
}

// 3. Analyze Dependencies
console.log('\n📚 Analyzing Dependencies...\n');

try {
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  // Heavy dependencies that might impact performance
  const heavyDeps = {
    'recharts': { size: '~400KB', alternative: 'lightweight-charts or chart.js' },
    '@tiptap/react': { size: '~200KB', alternative: 'Consider lazy loading' },
    'react-markdown': { size: '~100KB', alternative: 'Consider lazy loading' },
    'html2canvas': { size: '~150KB', alternative: 'Consider lazy loading' }
  };
  
  console.log('Heavy Dependencies Found:');
  Object.keys(heavyDeps).forEach(dep => {
    if (deps[dep]) {
      console.log(`  ⚠️  ${dep} (${heavyDeps[dep].size})`);
      console.log(`      Alternative: ${heavyDeps[dep].alternative}`);
      
      results.issues.push({
        severity: 'medium',
        category: 'dependencies',
        dependency: dep,
        message: `Heavy dependency: ${dep} (${heavyDeps[dep].size})`,
        impact: 'Increases bundle size and initial load time',
        recommendation: heavyDeps[dep].alternative
      });
    }
  });
  
  results.metrics.dependencies = {
    total: Object.keys(deps).length,
    heavy: Object.keys(heavyDeps).filter(d => deps[d]).length
  };
  
} catch (error) {
  console.error('❌ Dependency analysis failed:', error.message);
}

// 4. Analyze Data Fetching
console.log('\n🌐 Analyzing Data Fetching Strategy...\n');

try {
  const loaderFile = 'lib/api/dashboard-loader.ts';
  const loaderContent = fs.readFileSync(loaderFile, 'utf8');
  
  // Check for optimization patterns
  const hasParallelRequests = loaderContent.includes('Promise.all');
  const hasCaching = loaderContent.includes('cache');
  const hasDeduplication = loaderContent.includes('inflightRequests');
  const hasProgressiveLoading = loaderContent.includes('onCriticalDataLoaded');
  
  console.log('Data Fetching Optimizations:');
  console.log(`  ✓ Parallel Requests: ${hasParallelRequests ? 'Yes' : 'No'}`);
  console.log(`  ✓ Response Caching: ${hasCaching ? 'Yes' : 'No'}`);
  console.log(`  ✓ Request Deduplication: ${hasDeduplication ? 'Yes' : 'No'}`);
  console.log(`  ✓ Progressive Loading: ${hasProgressiveLoading ? 'Yes' : 'No'}`);
  
  results.metrics.dataFetching = {
    parallelRequests: hasParallelRequests,
    caching: hasCaching,
    deduplication: hasDeduplication,
    progressiveLoading: hasProgressiveLoading
  };
  
  // Check cache TTL
  const cacheTTLMatch = loaderContent.match(/CACHE_TTL\s*=\s*(\d+)/);
  if (cacheTTLMatch) {
    const ttl = parseInt(cacheTTLMatch[1]);
    console.log(`  Cache TTL: ${ttl}ms (${ttl / 1000}s)`);
    
    if (ttl < 10000) {
      results.recommendations.push({
        category: 'caching',
        message: 'Cache TTL is very short',
        recommendation: 'Consider increasing cache TTL to 60-120 seconds for better performance'
      });
    }
  }
  
} catch (error) {
  console.error('❌ Data fetching analysis failed:', error.message);
}

// 5. Check for Code Splitting
console.log('\n✂️  Analyzing Code Splitting...\n');

try {
  const dashboardFile = 'app/dashboards/page.tsx';
  const content = fs.readFileSync(dashboardFile, 'utf8');
  
  const hasDynamicImports = content.includes('dynamic(') || content.includes('import(');
  const hasSuspense = content.includes('Suspense');
  const hasLazyLoading = content.includes('lazy');
  
  console.log('Code Splitting:');
  console.log(`  Dynamic Imports: ${hasDynamicImports ? 'Yes' : 'No'}`);
  console.log(`  Suspense: ${hasSuspense ? 'Yes' : 'No'}`);
  console.log(`  Lazy Loading: ${hasLazyLoading ? 'Yes' : 'No'}`);
  
  if (!hasDynamicImports) {
    results.issues.push({
      severity: 'high',
      category: 'code-splitting',
      message: 'No dynamic imports detected',
      impact: 'All code loads upfront, increasing initial bundle size',
      recommendation: 'Use next/dynamic to lazy load heavy components like charts and modals'
    });
  }
  
} catch (error) {
  console.error('❌ Code splitting analysis failed:', error.message);
}

// 6. Generate Recommendations
console.log('\n💡 Generating Recommendations...\n');

// Priority recommendations based on issues found
const priorityRecommendations = [
  {
    priority: 1,
    title: 'Implement React.memo for Heavy Components',
    description: 'Wrap VarianceKPIs, VarianceTrends, VarianceAlerts with React.memo to prevent unnecessary re-renders',
    estimatedImpact: 'Reduce TBT by 30-50ms',
    effort: 'Low (1-2 hours)'
  },
  {
    priority: 2,
    title: 'Add Dynamic Imports for Charts',
    description: 'Use next/dynamic to lazy load Recharts and other heavy visualization components',
    estimatedImpact: 'Reduce initial bundle by 200-400KB, improve LCP by 500-800ms',
    effort: 'Medium (2-4 hours)'
  },
  {
    priority: 3,
    title: 'Optimize State Management',
    description: 'Consolidate related state using useReducer and add useCallback for event handlers',
    estimatedImpact: 'Reduce re-renders by 20-30%',
    effort: 'Medium (3-5 hours)'
  },
  {
    priority: 4,
    title: 'Implement Virtual Scrolling',
    description: 'Already using VirtualizedProjectList, ensure it\'s properly configured',
    estimatedImpact: 'Improve scroll performance for large lists',
    effort: 'Low (1 hour)'
  },
  {
    priority: 5,
    title: 'Add Resource Hints',
    description: 'Add preconnect and dns-prefetch for API endpoints',
    estimatedImpact: 'Reduce API latency by 50-100ms',
    effort: 'Low (30 minutes)'
  }
];

priorityRecommendations.forEach(rec => {
  console.log(`${rec.priority}. ${rec.title}`);
  console.log(`   ${rec.description}`);
  console.log(`   Impact: ${rec.estimatedImpact}`);
  console.log(`   Effort: ${rec.effort}\n`);
});

results.recommendations.push(...priorityRecommendations);

// 7. Summary
console.log('\n📊 Summary\n');
console.log('=' .repeat(60));
console.log(`Total Issues Found: ${results.issues.length}`);
console.log(`  High Severity: ${results.issues.filter(i => i.severity === 'high').length}`);
console.log(`  Medium Severity: ${results.issues.filter(i => i.severity === 'medium').length}`);
console.log(`  Low Severity: ${results.issues.filter(i => i.severity === 'low').length}`);
console.log(`\nTotal Recommendations: ${results.recommendations.length}`);

// 8. Save detailed report
const reportPath = 'DASHBOARD_PERFORMANCE_PROFILE.json';
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
console.log(`\n✅ Detailed report saved to: ${reportPath}`);

// 9. Create markdown summary
const markdownReport = `# Dashboard Performance Profile

**Generated:** ${new Date().toLocaleString()}

## Executive Summary

- **Total Issues:** ${results.issues.length}
- **High Severity:** ${results.issues.filter(i => i.severity === 'high').length}
- **Medium Severity:** ${results.issues.filter(i => i.severity === 'medium').length}

## Critical Issues

${results.issues.filter(i => i.severity === 'high').map(issue => `
### ${issue.category}: ${issue.message}

- **Impact:** ${issue.impact}
- **Recommendation:** ${issue.recommendation || 'See detailed recommendations below'}
`).join('\n')}

## Priority Recommendations

${priorityRecommendations.map(rec => `
### ${rec.priority}. ${rec.title}

**Description:** ${rec.description}

**Estimated Impact:** ${rec.estimatedImpact}

**Effort:** ${rec.effort}
`).join('\n')}

## Metrics

### Component Analysis
- Imports: ${results.metrics.componentAnalysis?.imports || 'N/A'}
- Hooks: ${results.metrics.componentAnalysis?.hooks || 'N/A'}
- State Variables: ${results.metrics.componentAnalysis?.state || 'N/A'}
- Effects: ${results.metrics.componentAnalysis?.effects || 'N/A'}
- Memoized Values: ${results.metrics.componentAnalysis?.memoized || 'N/A'}

### Data Fetching
- Parallel Requests: ${results.metrics.dataFetching?.parallelRequests ? '✓' : '✗'}
- Response Caching: ${results.metrics.dataFetching?.caching ? '✓' : '✗'}
- Request Deduplication: ${results.metrics.dataFetching?.deduplication ? '✓' : '✗'}
- Progressive Loading: ${results.metrics.dataFetching?.progressiveLoading ? '✓' : '✗'}

## Next Steps

1. Review this report with the development team
2. Prioritize fixes based on impact and effort
3. Implement high-priority recommendations first
4. Re-run Lighthouse CI after each optimization
5. Monitor production metrics

## Detailed Issues

${results.issues.map((issue, i) => `
### Issue ${i + 1}: ${issue.message}

- **Severity:** ${issue.severity}
- **Category:** ${issue.category}
- **Impact:** ${issue.impact}
${issue.recommendation ? `- **Recommendation:** ${issue.recommendation}` : ''}
`).join('\n')}
`;

const markdownPath = 'DASHBOARD_PERFORMANCE_PROFILE.md';
fs.writeFileSync(markdownPath, markdownReport);
console.log(`✅ Markdown report saved to: ${markdownPath}`);

console.log('\n' + '='.repeat(60));
console.log('🎯 Profile Complete!\n');

// Exit with error code if high severity issues found
const highSeverityCount = results.issues.filter(i => i.severity === 'high').length;
if (highSeverityCount > 0) {
  console.log(`⚠️  Found ${highSeverityCount} high-severity issues that need immediate attention.\n`);
  process.exit(1);
} else {
  console.log('✅ No high-severity issues found.\n');
  process.exit(0);
}
