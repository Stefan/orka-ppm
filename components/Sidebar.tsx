'use client'

import Link from 'next/link'
import { LogOut } from 'lucide-react'
import { supabase } from '../lib/supabase'

export default function Sidebar() {
  const handleLogout = async () => {
    await supabase.auth.signOut()
  }

  return (
    <nav className="w-64 h-screen p-4 bg-gray-800 text-white">
      <h2>PPM Dashboard</h2>
      <ul className="space-y-2">
        <li><Link href="/dashboards" className="block py-2 px-4 rounded hover:bg-gray-700">Portfolio Dashboards</Link></li>
        <li><Link href="/resources" className="block py-2 px-4 rounded hover:bg-gray-700">Resource Management</Link></li>
        <li><Link href="/reports" className="block py-2 px-4 rounded hover:bg-gray-700">AI Reports & Analytics</Link></li>
        <li><Link href="/financials" className="block py-2 px-4 rounded hover:bg-gray-700">Financial Tracking</Link></li>
        <li><Link href="/risks" className="block py-2 px-4 rounded hover:bg-gray-700">Risk/Issue Registers</Link></li>
      </ul>
      <button onClick={handleLogout} className="flex items-center"><LogOut className="mr-2" /> Logout</button>
    </nav>
  )
}