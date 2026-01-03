'use client'

import { useAuth } from '../app/providers/SupabaseAuthProvider'
import Sidebar from './Sidebar'

interface AppLayoutProps {
  children: React.ReactNode
}

export default function AppLayout({ children }: AppLayoutProps) {
  const { session } = useAuth()

  if (!session) {
    return <div className="p-8 text-center">Please log in to access this page.</div>
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}