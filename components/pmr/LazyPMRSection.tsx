"use client";

/**
 * Lazy PMR Section Component
 * Implements lazy loading for PMR report sections to improve initial load performance
 */

import React, { Suspense, lazy, useState, useEffect } from 'react';
import { useIntersectionObserver } from '@/hooks/useIntersectionObserver';

interface LazyPMRSectionProps {
  sectionId: string;
  sectionType: 'executive_summary' | 'ai_insights' | 'monte_carlo' | 'metrics' | 'charts' | 'custom';
  title: string;
  data: any;
  priority?: 'high' | 'medium' | 'low';
  loadingPlaceholder?: React.ReactNode;
  errorFallback?: React.ReactNode;
  onLoad?: () => void;
  onError?: (error: Error) => void;
}

// Lazy load section components
const ExecutiveSummarySection = lazy(() => 
  import('./sections/ExecutiveSummarySection').catch(() => ({
    default: () => <div>Failed to load Executive Summary</div>
  }))
);

const AIInsightsSection = lazy(() => 
  import('./sections/AIInsightsSection').catch(() => ({
    default: () => <div>Failed to load AI Insights</div>
  }))
);

const MonteCarloSection = lazy(() => 
  import('./sections/MonteCarloSection').catch(() => ({
    default: () => <div>Failed to load Monte Carlo Analysis</div>
  }))
);

const MetricsSection = lazy(() => 
  import('./sections/MetricsSection').catch(() => ({
    default: () => <div>Failed to load Metrics</div>
  }))
);

const ChartsSection = lazy(() => 
  import('./sections/ChartsSection').catch(() => ({
    default: () => <div>Failed to load Charts</div>
  }))
);

const CustomSection = lazy(() => 
  import('./sections/CustomSection').catch(() => ({
    default: () => <div>Failed to load Custom Section</div>
  }))
);

// Default loading placeholder
const DefaultLoadingPlaceholder: React.FC<{ title: string }> = ({ title }) => (
  <div className="animate-pulse bg-gray-100 dark:bg-gray-800 rounded-lg p-6 mb-4">
    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
    <div className="space-y-3">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
    </div>
  </div>
);

// Error boundary for section loading
class SectionErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('PMR Section Error:', error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
          <h3 className="text-red-800 dark:text-red-200 font-semibold mb-2">
            Failed to load section
          </h3>
          <p className="text-red-600 dark:text-red-300 text-sm">
            {this.state.error?.message || 'An error occurred while loading this section'}
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * LazyPMRSection Component
 * Implements intersection observer-based lazy loading for PMR sections
 */
export const LazyPMRSection: React.FC<LazyPMRSectionProps> = ({
  sectionId,
  sectionType,
  title,
  data,
  priority = 'medium',
  loadingPlaceholder,
  errorFallback,
  onLoad,
  onError
}) => {
  const [shouldLoad, setShouldLoad] = useState(priority === 'high');
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Use intersection observer for lazy loading
  const [ref, isIntersecting] = useIntersectionObserver({
    threshold: 0.1,
    rootMargin: '200px' // Start loading 200px before section enters viewport
  });

  // Trigger loading when section is near viewport
  useEffect(() => {
    if (isIntersecting && !shouldLoad) {
      setShouldLoad(true);
    }
  }, [isIntersecting, shouldLoad]);

  // Track when section is loaded
  useEffect(() => {
    if (shouldLoad && !isLoaded) {
      setIsLoaded(true);
      onLoad?.();
    }
  }, [shouldLoad, isLoaded, onLoad]);

  // Get appropriate section component
  const getSectionComponent = () => {
    switch (sectionType) {
      case 'executive_summary':
        return <ExecutiveSummarySection data={data} />;
      case 'ai_insights':
        return <AIInsightsSection data={data} />;
      case 'monte_carlo':
        return <MonteCarloSection data={data} />;
      case 'metrics':
        return <MetricsSection data={data} />;
      case 'charts':
        return <ChartsSection data={data} />;
      case 'custom':
        return <CustomSection data={data} />;
      default:
        return <div>Unknown section type: {sectionType}</div>;
    }
  };

  return (
    <div ref={ref as React.Ref<HTMLDivElement>} id={sectionId} className="pmr-section mb-6">
      {shouldLoad ? (
        <SectionErrorBoundary fallback={errorFallback} onError={onError}>
          <Suspense fallback={loadingPlaceholder || <DefaultLoadingPlaceholder title={title} />}>
            {getSectionComponent()}
          </Suspense>
        </SectionErrorBoundary>
      ) : (
        <div className="min-h-[200px] flex items-center justify-center bg-gray-50 dark:bg-gray-900 rounded-lg">
          <div className="text-gray-400 dark:text-gray-600">
            Loading {title}...
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * LazyPMRSectionList Component
 * Renders a list of lazy-loaded PMR sections with optimized loading strategy
 */
interface LazyPMRSectionListProps {
  sections: Array<{
    id: string;
    type: LazyPMRSectionProps['sectionType'];
    title: string;
    data: any;
    priority?: LazyPMRSectionProps['priority'];
  }>;
  onSectionLoad?: (sectionId: string) => void;
  onSectionError?: (sectionId: string, error: Error) => void;
}

export const LazyPMRSectionList: React.FC<LazyPMRSectionListProps> = ({
  sections,
  onSectionLoad,
  onSectionError
}) => {
  const [loadedSections, setLoadedSections] = useState<Set<string>>(new Set());

  const handleSectionLoad = (sectionId: string) => {
    setLoadedSections(prev => new Set(prev).add(sectionId));
    onSectionLoad?.(sectionId);
  };

  const handleSectionError = (sectionId: string, error: Error) => {
    console.error(`Section ${sectionId} failed to load:`, error);
    onSectionError?.(sectionId, error);
  };

  return (
    <div className="pmr-section-list space-y-6">
      {sections.map((section) => (
        <LazyPMRSection
          key={section.id}
          sectionId={section.id}
          sectionType={section.type}
          title={section.title}
          data={section.data}
          priority={section.priority}
          onLoad={() => handleSectionLoad(section.id)}
          onError={(error) => handleSectionError(section.id, error)}
        />
      ))}
      
      {/* Loading progress indicator */}
      {loadedSections.size < sections.length && (
        <div className="text-center text-sm text-gray-500 dark:text-gray-400 py-4">
          Loaded {loadedSections.size} of {sections.length} sections
        </div>
      )}
    </div>
  );
};

export default LazyPMRSection;
