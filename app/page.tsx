'use client'

import { useAuth } from './providers/SupabaseAuthProvider'
import Sidebar from '../components/Sidebar'
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const { session } = useAuth()

  if (!session) {
    return <LoginForm />
  }

  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 p-8">
        <h1>Willkommen zu PPM SaaS</h1>
        {/* Füge Links zu Dashboards etc. hinzu */}
      </main>
    </div>
  )
}

function LoginForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)

  const handleAuth = async () => {
    const { data, error } = isSignup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    if (error) alert(error.message)
  }

  const handleResetPassword = async () => {
    const email = prompt('Gib deine Email ein:')
    if (email) {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email)
      if (error) alert(error.message)
      else alert('Reset-Link gesendet! Check deine Email.')
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-screen">
      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="mb-2 p-2 border" />
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="mb-2 p-2 border" />
      <button onClick={handleAuth} className="mb-2 p-2 bg-blue-500 text-white">{isSignup ? 'Sign Up' : 'Login'}</button>
      <button onClick={() => setIsSignup(!isSignup)} className="p-2 text-blue-500">{isSignup ? 'Switch to Login' : 'Switch to Sign Up'}</button>
      <div className="mt-4">
        <button onClick={handleResetPassword} className="text-blue-500">Passwort vergessen?</button>
      </div>
    </div>
  )
}