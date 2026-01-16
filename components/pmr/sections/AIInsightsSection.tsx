"use client";

import React from 'react';

interface AIInsight {
  id: string;
  title: string;
  content: string;
  confidence_score: number;
  category: string;
  priority: string;
}

interface AIInsightsSectionProps {
  data: {
    insights?: AIInsight[];
  };
}

const AIInsightsSection: React.FC<AIInsightsSectionProps> = ({ data }) => {
  const insights = data.insights || [];
  
  const getPriorityColor = (priority: string) => {
    switch (priority.toLowerCase()) {
      case 'high':
      case 'critical':
        return 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200';
      case 'medium':
        return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200';
      case 'low':
        return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200';
      default:
        return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200';
    }
  };
  
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        AI-Powered Insights
      </h2>
      
      {insights.length === 0 ? (
        <p className="text-gray-500 dark:text-gray-400">No insights available</p>
      ) : (
        <div className="space-y-4">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {insight.title}
                </h3>
                <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(insight.priority)}`}>
                  {insight.priority}
                </span>
              </div>
              
              <p className="text-gray-700 dark:text-gray-300 mb-3">
                {insight.content}
              </p>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500 dark:text-gray-400">
                  Category: {insight.category}
                </span>
                <span className="text-gray-500 dark:text-gray-400">
                  Confidence: {(insight.confidence_score * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AIInsightsSection;
