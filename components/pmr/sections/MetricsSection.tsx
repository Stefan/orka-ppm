"use client";

import React from 'react';

interface MetricsSectionProps {
  data: {
    metrics?: Record<string, any>;
    last_updated?: string;
  };
}

const MetricsSection: React.FC<MetricsSectionProps> = ({ data }) => {
  const metrics = data.metrics || {};
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
          Real-Time Metrics
        </h2>
        {data.last_updated && (
          <span className="text-sm text-gray-500 dark:text-gray-400">
            Updated: {new Date(data.last_updated).toLocaleString()}
          </span>
        )}
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Object.entries(metrics).map(([key, value]) => (
          <div key={key} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {typeof value === 'number' ? value.toFixed(2) : value || 'N/A'}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default MetricsSection;
