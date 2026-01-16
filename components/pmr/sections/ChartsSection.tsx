"use client";

import React from 'react';

interface ChartsSectionProps {
  data: {
    charts?: Array<{
      id: string;
      title: string;
      type: string;
      data: any;
    }>;
  };
}

const ChartsSection: React.FC<ChartsSectionProps> = ({ data }) => {
  const charts = data.charts || [];
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        Charts & Visualizations
      </h2>
      
      {charts.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No charts available</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {charts.map((chart) => (
            <div
              key={chart.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <h3 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">
                {chart.title}
              </h3>
              <div className="h-64 flex items-center justify-center bg-gray-50 dark:bg-gray-700 rounded">
                <span className="text-gray-400 dark:text-gray-500">
                  {chart.type} Chart Placeholder
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChartsSection;
