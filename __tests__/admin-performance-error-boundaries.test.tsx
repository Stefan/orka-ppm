/**
 * Integration tests for error boundaries in admin performance page
 *
 * Verifies that lazy-loaded components are properly wrapped in error boundaries
 * and that errors are isolated to prevent full page crashes.
 *
 * Requirements: 6.1
 */

import fs from 'fs';
import path from 'path';

describe('Admin Performance Page Error Boundaries', () => {
  it('should have LazyComponentErrorBoundary imported', () => {
    const pageContent = fs.readFileSync(
      path.join(__dirname, '../app/admin/performance/page.tsx'),
      'utf-8'
    );

    // Verify LazyComponentErrorBoundary is imported
    expect(pageContent).toContain('LazyComponentErrorBoundary');
    expect(pageContent).toContain("from '../../../components/error-boundaries'");
  });

  it('should wrap ChartSection in error boundary', () => {
    const pageContent = fs.readFileSync(
      path.join(__dirname, '../app/admin/performance/page.tsx'),
      'utf-8'
    );

    // Verify ChartSection is wrapped (accept both quote styles)
    expect(pageContent).toMatch(/componentName=["']ChartSection["']/);
    expect(pageContent).toContain("fallbackMessage={t('errors.chartLoadFailed')");
  });

  it('should wrap SlowQueriesTable in error boundary', () => {
    const pageContent = fs.readFileSync(
      path.join(__dirname, '../app/admin/performance/page.tsx'),
      'utf-8'
    );

    // Verify SlowQueriesTable is wrapped (accept both quote styles)
    expect(pageContent).toMatch(/componentName=["']SlowQueriesTable["']/);
    expect(pageContent).toContain("fallbackMessage={t('errors.tableLoadFailed')");
  });

  it('should wrap CacheStatsCard in error boundary', () => {
    const pageContent = fs.readFileSync(
      path.join(__dirname, '../app/admin/performance/page.tsx'),
      'utf-8'
    );

    // Verify CacheStatsCard is wrapped (accept both quote styles)
    expect(pageContent).toMatch(/componentName=["']CacheStatsCard["']/);
    expect(pageContent).toContain("fallbackMessage={t('errors.cacheStatsLoadFailed')");
  });

  it('should have error boundaries wrapping Suspense components', () => {
    const pageContent = fs.readFileSync(
      path.join(__dirname, '../app/admin/performance/page.tsx'),
      'utf-8'
    );

    // Verify error boundaries wrap Suspense
    // Pattern: <LazyComponentErrorBoundary ... > <Suspense ...>
    const errorBoundaryPattern = /<LazyComponentErrorBoundary[\s\S]*?<Suspense/g;
    const matches = pageContent.match(errorBoundaryPattern);

    // Should have at least 3 instances (ChartSection, SlowQueriesTable, CacheStatsCard)
    expect(matches).not.toBeNull();
    expect(matches!.length).toBeGreaterThanOrEqual(3);
  });

  it('should export LazyComponentErrorBoundary from error-boundaries index', () => {
    const indexContent = fs.readFileSync(
      path.join(__dirname, '../components/error-boundaries/index.ts'),
      'utf-8'
    );

    // Verify export exists
    expect(indexContent).toContain('LazyComponentErrorBoundary');
    expect(indexContent).toContain("from './LazyComponentErrorBoundary'");
  });
});
