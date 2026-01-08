'use client'

import React, { useState, useEffect } from 'react'
import { HelpCircle, Users, Shield, Book, ExternalLink } from 'lucide-react'
import { getApiUrl } from '../../lib/api'

interface SetupHelpData {
  message: string
  user_management: {
    access: string
    create_users?: string
    roles?: string[]
    development_features?: string[]
    mock_users?: Array<{email: string, role: string}>
  }
  support?: {
    documentation: string
    api_docs: string
    health_check: string
  }
  development_info?: {
    note: string
    api_docs: string
    health_check: string
  }
  security?: {
    note: string
    contact: string
  }
  production_note?: string
}

interface SetupHelpProps {
  session: any
}

export default function SetupHelp({ session }: SetupHelpProps) {
  const [helpData, setHelpData] = useState<SetupHelpData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    fetchSetupHelp()
  }, [])

  const fetchSetupHelp = async () => {
    try {
      const response = await fetch(getApiUrl('/admin/help/setup'), {
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch setup help')
      }
      
      const data = await response.json()
      setHelpData(data)
    } catch (error: unknown) {
      console.error('Error fetching setup help:', error)
      setError(error instanceof Error ? error.message : 'Failed to fetch setup help')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="animate-pulse">
        <div className="h-8 w-8 bg-gray-200 rounded-full"></div>
      </div>
    )
  }

  if (error || !helpData) {
    return null // Don't show help if there's an error
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
        title="Setup Help"
      >
        <HelpCircle className="h-5 w-5" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <Users className="h-5 w-5 mr-2" />
                User Management Help
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">{helpData.message}</p>
              </div>

              <div>
                <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                  <Shield className="h-4 w-4 mr-1" />
                  User Management
                </h4>
                <p className="text-sm text-gray-600 mb-2">{helpData.user_management.access}</p>
                
                {helpData.user_management.create_users && (
                  <p className="text-sm text-gray-600 mb-2">{helpData.user_management.create_users}</p>
                )}

                {helpData.user_management.roles && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-gray-700 mb-1">Available Roles:</p>
                    <div className="flex flex-wrap gap-1">
                      {helpData.user_management.roles.map((role) => (
                        <span
                          key={role}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          {role}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {helpData.user_management.development_features && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-gray-700 mb-1">Development Features:</p>
                    <ul className="text-xs text-gray-600 space-y-1">
                      {helpData.user_management.development_features.map((feature, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-green-500 mr-1">•</span>
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {helpData.user_management.mock_users && (
                  <div className="mb-2">
                    <p className="text-xs font-medium text-gray-700 mb-1">Mock Users Available:</p>
                    <div className="space-y-1">
                      {helpData.user_management.mock_users.map((user, index) => (
                        <div key={index} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                          <span className="font-medium">{user.email}</span> - {user.role}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {helpData.support && (
                <div>
                  <h4 className="font-medium text-gray-900 mb-2 flex items-center">
                    <Book className="h-4 w-4 mr-1" />
                    Support & Documentation
                  </h4>
                  <div className="space-y-2 text-sm text-gray-600">
                    <p>{helpData.support.documentation}</p>
                    <div className="flex items-center space-x-4">
                      <a
                        href="/docs"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        API Docs <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                      <a
                        href="/health"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 flex items-center"
                      >
                        Health Check <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {helpData.development_info && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800 mb-2">{helpData.development_info.note}</p>
                  <div className="flex items-center space-x-4">
                    <a
                      href="/docs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-yellow-700 hover:text-yellow-900 flex items-center text-sm"
                    >
                      API Docs <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                    <a
                      href="/health"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-yellow-700 hover:text-yellow-900 flex items-center text-sm"
                    >
                      Health Check <ExternalLink className="h-3 w-3 ml-1" />
                    </a>
                  </div>
                </div>
              )}

              {helpData.security && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800 mb-1">{helpData.security.note}</p>
                  <p className="text-sm text-red-700">{helpData.security.contact}</p>
                </div>
              )}

              {helpData.production_note && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <p className="text-sm text-gray-700">{helpData.production_note}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}