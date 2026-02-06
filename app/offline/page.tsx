'use client';

import { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';

export default function OfflinePage() {
  const [isOnline, setIsOnline] = useState(false);

  useEffect(() => {
    // Check initial online status
    setIsOnline(navigator.onLine);

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleRefresh = () => {
    if (isOnline) {
      window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-800/50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-lg p-8">
          {/* Offline Icon */}
          <div className="mx-auto w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mb-6">
            <WifiOff className="w-8 h-8 text-gray-600 dark:text-slate-400" />
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 dark:text-slate-100 mb-4">
            You're Offline
          </h1>

          {/* Description */}
          <p className="text-gray-600 dark:text-slate-400 mb-6">
            It looks like you've lost your internet connection. Don't worry, 
            you can still access some cached content and your work will be 
            saved when you're back online.
          </p>

          {/* Connection Status */}
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium mb-6 ${
            isOnline 
              ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' 
              : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              isOnline ? 'bg-green-500' : 'bg-red-500'
            }`} />
            {isOnline ? 'Back Online' : 'Offline'}
          </div>

          {/* Actions */}
          <div className="space-y-3">
            <button
              onClick={handleRefresh}
              disabled={!isOnline}
              className={`w-full flex items-center justify-center px-4 py-3 rounded-lg font-medium transition-colors ${
                isOnline
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-300 text-gray-500 dark:text-slate-400 cursor-not-allowed'
              }`}
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              {isOnline ? 'Refresh Page' : 'Waiting for Connection...'}
            </button>

            <Link
              href="/"
              className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 dark:border-slate-600 rounded-lg font-medium text-gray-700 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-slate-700 dark:bg-slate-800/50 transition-colors"
            >
              <Home className="w-4 h-4 mr-2" />
              Go to Homepage
            </Link>
          </div>

          {/* Cached Content Info */}
          <div className="mt-8 p-4 bg-blue-50 rounded-lg">
            <h3 className="text-sm font-medium text-blue-900 mb-2">
              Available Offline
            </h3>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• Dashboard (cached data)</li>
              <li>• Resources page</li>
              <li>• Reports (cached data)</li>
              <li>• Form submissions (will sync when online)</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-sm text-gray-500 dark:text-slate-400">
          Your work is automatically saved and will sync when you're back online.
        </p>
      </div>
    </div>
  );
}