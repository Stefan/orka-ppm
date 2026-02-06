'use client';

import React, { useState } from 'react';
import { Copy, Check, Share2, X, Calendar, Shield } from 'lucide-react';
import { useTranslations } from '@/lib/i18n/context';

interface ShareablePermissions {
  can_view_basic_info: boolean;
  can_view_financial: boolean;
  can_view_risks: boolean;
  can_view_resources: boolean;
  can_view_timeline: boolean;
  allowed_sections: string[];
}

interface ShareableURLWidgetProps {
  projectId: string;
  projectName: string;
  onClose?: () => void;
}

export default function ShareableURLWidget({ 
  projectId, 
  projectName,
  onClose 
}: ShareableURLWidgetProps) {
  const t = useTranslations();
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedURL, setGeneratedURL] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Permission state
  const [permissions, setPermissions] = useState<ShareablePermissions>({
    can_view_basic_info: true,
    can_view_financial: false,
    can_view_risks: false,
    can_view_resources: false,
    can_view_timeline: true,
    allowed_sections: []
  });
  
  // Expiration state (default 7 days)
  const [expirationDays, setExpirationDays] = useState(7);

  const handleGenerateURL = async () => {
    setIsGenerating(true);
    setError(null);
    
    try {
      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expirationDays);
      
      const response = await fetch(`/api/projects/${projectId}/share`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: projectId,
          permissions,
          expires_at: expiresAt.toISOString(),
          description: `Shareable link for ${projectName}`
        }),
      });
      
      if (!response.ok) {
        throw new Error(t('shared.shareableUrl.errors.failedToGenerate'));
      }
      
      const data = await response.json();
      
      // Construct the full URL
      const baseURL = window.location.origin;
      const shareableURL = `${baseURL}/shared/${data.token}`;
      
      setGeneratedURL(shareableURL);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyURL = async () => {
    if (!generatedURL) return;
    
    try {
      await navigator.clipboard.writeText(generatedURL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      setError(t('shared.shareableUrl.errors.failedToCopy'));
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setGeneratedURL(null);
    setError(null);
    setCopied(false);
    if (onClose) onClose();
  };

  const togglePermission = (key: keyof ShareablePermissions) => {
    if (typeof permissions[key] === 'boolean') {
      setPermissions(prev => ({
        ...prev,
        [key]: !prev[key]
      }));
    }
  };

  return (
    <>
      {/* Share Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        title={t('shared.shareableUrl.title')}
      >
        <Share2 className="w-4 h-4" />
        <span>{t('shared.shareableUrl.shareButton')}</span>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b">
              <div className="flex items-center gap-3">
                <Share2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">
                    {t('shared.shareableUrl.title')}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-slate-400 mt-1">
                    {projectName}
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-gray-400 hover:text-gray-600 dark:text-slate-400 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Permissions Configuration */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Shield className="w-5 h-5 text-gray-700 dark:text-slate-300" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">
                    {t('shared.shareableUrl.accessPermissions')}
                  </h3>
                </div>
                <div className="space-y-2 bg-gray-50 dark:bg-slate-800/50 p-4 rounded-lg">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.can_view_basic_info}
                      onChange={() => togglePermission('can_view_basic_info')}
                      className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-slate-300">
                      {t('shared.shareableUrl.permissions.viewBasicInfo')}
                    </span>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.can_view_timeline}
                      onChange={() => togglePermission('can_view_timeline')}
                      className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-slate-300">
                      {t('shared.shareableUrl.permissions.viewTimeline')}
                    </span>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.can_view_financial}
                      onChange={() => togglePermission('can_view_financial')}
                      className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-slate-300">
                      {t('shared.shareableUrl.permissions.viewFinancial')}
                    </span>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.can_view_risks}
                      onChange={() => togglePermission('can_view_risks')}
                      className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-slate-300">
                      {t('shared.shareableUrl.permissions.viewRisks')}
                    </span>
                  </label>
                  
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={permissions.can_view_resources}
                      onChange={() => togglePermission('can_view_resources')}
                      className="w-4 h-4 text-blue-600 dark:text-blue-400 rounded focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-slate-300">
                      {t('shared.shareableUrl.permissions.viewResources')}
                    </span>
                  </label>
                </div>
              </div>

              {/* Expiration Configuration */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="w-5 h-5 text-gray-700 dark:text-slate-300" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">
                    {t('shared.shareableUrl.linkExpiration')}
                  </h3>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="number"
                    min="1"
                    max="365"
                    value={expirationDays}
                    onChange={(e) => setExpirationDays(parseInt(e.target.value) || 7)}
                    className="w-24 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-sm text-gray-600 dark:text-slate-400">
                    {t('shared.shareableUrl.daysFromNow')}
                  </span>
                </div>
                <p className="text-xs text-gray-500 dark:text-slate-400 mt-2">
                  {t('shared.shareableUrl.linkExpiresOn', {
                    date: new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000).toLocaleDateString()
                  })}
                </p>
              </div>

              {/* Error Message */}
              {error && (
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-300">{error}</p>
                </div>
              )}

              {/* Generated URL Display */}
              {generatedURL && (
                <div className="space-y-3">
                  <h3 className="text-lg font-medium text-gray-900 dark:text-slate-100">
                    {t('shared.shareableUrl.shareableLink')}
                  </h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={generatedURL}
                      readOnly
                      className="flex-1 px-3 py-2 bg-gray-50 dark:bg-slate-800/50 border border-gray-300 dark:border-slate-600 rounded-lg text-sm font-mono"
                    />
                    <button
                      onClick={handleCopyURL}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {copied ? (
                        <>
                          <Check className="w-4 h-4" />
                          <span>{t('shared.shareableUrl.copied')}</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>{t('shared.shareableUrl.copy')}</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-slate-400">
                    {t('shared.shareableUrl.shareDescription')}
                  </p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t bg-gray-50 dark:bg-slate-800/50">
              <button
                onClick={handleClose}
                className="px-4 py-2 text-gray-700 hover:text-gray-900 dark:hover:text-slate-100 dark:text-slate-100 transition-colors"
              >
                {t('common.close')}
              </button>
              {!generatedURL && (
                <button
                  onClick={handleGenerateURL}
                  disabled={isGenerating}
                  className="inline-flex items-center gap-2 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isGenerating ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>{t('shared.shareableUrl.generating')}</span>
                    </>
                  ) : (
                    <>
                      <Share2 className="w-4 h-4" />
                      <span>{t('shared.shareableUrl.generateButton')}</span>
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
