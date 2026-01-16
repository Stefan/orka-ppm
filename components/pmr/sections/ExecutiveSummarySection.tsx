"use client";

import React from 'react';

interface ExecutiveSummarySectionProps {
  data: {
    summary?: string;
    keyMetrics?: Record<string, any>;
    highlights?: string[];
  };
}

const ExecutiveSummarySection: React.FC<ExecutiveSummarySectionProps> = ({ data }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Executive Summary
      </h2>
      
      {data.summary && (
        <div className="prose dark:prose-invert max-w-none mb-6">
          <p className="text-gray-700 dark:text-gray-300">{data.summary}</p>
        </div>
      )}
      
      {data.keyMetrics && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {Object.entries(data.keyMetrics).map(([key, value]) => (
            <div key={key} className="bg-gray-50 dark:bg-gray-700 rounded p-4">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                {key.replace(/_/g, ' ').toUpperCase()}
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {typeof value === 'number' ? value.toFixed(2) : value}
              </div>
            </div>
          ))}
        </div>
      )}
      
      {data.highlights && data.highlights.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
            Key Highlights
          </h3>
          <ul className="list-disc list-inside space-y-2">
            {data.highlights.map((highlight, index) => (
              <li key={index} className="text-gray-700 dark:text-gray-300">
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default ExecutiveSummarySection;
