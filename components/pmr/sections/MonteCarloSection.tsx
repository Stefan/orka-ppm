"use client";

import React from 'react';

interface MonteCarloSectionProps {
  data: {
    analysis_type?: string;
    iterations?: number;
    budget_completion?: Record<string, number>;
    schedule_completion?: Record<string, any>;
    confidence_intervals?: Record<string, any>;
    recommendations?: string[];
  };
}

const MonteCarloSection: React.FC<MonteCarloSectionProps> = ({ data }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Monte Carlo Analysis
      </h2>
      
      {data.iterations && (
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Based on {data.iterations.toLocaleString()} simulations
        </p>
      )}
      
      {data.budget_completion && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
            Budget Completion Forecast
          </h3>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(data.budget_completion).map(([percentile, value]) => (
              <div key={percentile} className="bg-gray-50 dark:bg-gray-700 rounded p-3">
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  {percentile.toUpperCase()}
                </div>
                <div className="text-xl font-bold text-gray-900 dark:text-white">
                  {typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : value}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {data.recommendations && data.recommendations.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
            Recommendations
          </h3>
          <ul className="list-disc list-inside space-y-2">
            {data.recommendations.map((rec, index) => (
              <li key={index} className="text-gray-700 dark:text-gray-300">
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default MonteCarloSection;
