"use client";

import React from 'react';

interface CustomSectionProps {
  data: {
    title?: string;
    content?: string;
    [key: string]: any;
  };
}

const CustomSection: React.FC<CustomSectionProps> = ({ data }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">
        {data.title || 'Custom Section'}
      </h2>
      
      {data.content && (
        <div className="prose dark:prose-invert max-w-none">
          <p className="text-gray-700 dark:text-gray-300">{data.content}</p>
        </div>
      )}
      
      {Object.entries(data).map(([key, value]) => {
        if (key === 'title' || key === 'content') return null;
        
        return (
          <div key={key} className="mt-4">
            <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">
              {key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
            </h3>
            <div className="text-gray-700 dark:text-gray-300">
              {typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value)}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default CustomSection;
