'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, Activity } from 'lucide-react'
import { useAuth } from '../app/providers/SupabaseAuthProvider'

export default function Sidebar() {
  const router = useRouter()
  const { clearSession } = useAuth()

  const handleLogout = async () => {
    try {
      console.log('🚪 Logging out...')
      await clearSession()
      console.log('✅ Logout successful')
      // Redirect to home page (login screen)
      router.push('/')
      // Force page refresh to ensure clean state
      window.location.href = '/'
    } catch (err) {
      console.error('🚨 Logout exception:', err)
      // Fallback: still redirect even if logout fails
      router.push('/')
    }
  }

  return (
    <nav className="w-64 h-screen p-4 bg-gray-800 text-white flex flex-col">
      <div className="mb-8">
        <h2 className="text-xl font-bold text-white">PPM Dashboard</h2>
      </div>
      
      <ul className="space-y-2 flex-1">
        <li><Link href="/dashboards" className="block py-2 px-4 rounded hover:bg-gray-700">Portfolio Dashboards</Link></li>
        <li><Link href="/resources" className="block py-2 px-4 rounded hover:bg-gray-700">Resource Management</Link></li>
        <li><Link href="/reports" className="block py-2 px-4 rounded hover:bg-gray-700">AI Reports & Analytics</Link></li>
        <li><Link href="/financials" className="block py-2 px-4 rounded hover:bg-gray-700">Financial Tracking</Link></li>
        <li><Link href="/risks" className="block py-2 px-4 rounded hover:bg-gray-700">Risk/Issue Registers</Link></li>
        <li>
          <Link href="/admin/performance" className="flex items-center py-2 px-4 rounded hover:bg-gray-700">
            <Activity className="mr-2 h-4 w-4" />
            Performance Monitor
          </Link>
        </li>
      </ul>
      
      <div className="mt-auto pt-4 border-t border-gray-700">
        <button 
          onClick={handleLogout} 
          className="flex items-center w-full py-2 px-4 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
        >
          <LogOut className="mr-2 h-4 w-4" /> 
          Logout
        </button>
      </div>
    </nav>
  )
}