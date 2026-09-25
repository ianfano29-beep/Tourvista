import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { DEFAULT_LOCATION } from './lib/locations'
import type { Category, Location } from './types'
import AuthPage from './components/AuthPage'
import Dashboard from './components/Dashboard'
import MapView from './components/MapView'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [guestUser, setGuestUser] = useState<string | null>(() => localStorage.getItem('wander_guest_email'))
  const [ready, setReady] = useState(false)
  const [location, setLocation] = useState<Location>(DEFAULT_LOCATION)
  const [category, setCategory] = useState<Category | null>(null)

  useEffect(() => {
    let active = true
    if (!isSupabaseConfigured) {
      setReady(true)
      return
    }

    supabase.auth.getSession()
      .then(({ data }) => {
        if (active) {
          setSession(data.session)
          setReady(true)
        }
      })
      .catch((err) => {
        console.warn('Session retrieval error:', err)
        if (active) setReady(true)
      })

    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (active) setSession(s)
    })

    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [])

  const handleGuestLogin = (email = 'traveler@wander.app') => {
    localStorage.setItem('wander_guest_email', email)
    setGuestUser(email)
  }

  const handleLogout = async () => {
    if (isSupabaseConfigured && session) {
      await supabase.auth.signOut()
    }
    localStorage.removeItem('wander_guest_email')
    setGuestUser(null)
    setSession(null)
    setCategory(null)
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100 text-stone-600">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-800 border-t-transparent"></div>
          <p className="text-sm font-medium">Loading Wander…</p>
        </div>
      </div>
    )
  }

  const userEmail = session?.user.email ?? guestUser

  if (!userEmail) {
    return <AuthPage onGuestLogin={handleGuestLogin} />
  }

  if (category) {
    return (
      <MapView
        location={location}
        initialCategory={category}
        onBack={() => setCategory(null)}
      />
    )
  }

  return (
    <Dashboard
      email={userEmail}
      location={location}
      onSelect={(l: Location, c: Category) => {
        setLocation(l)
        setCategory(c)
      }}
      onLogout={handleLogout}
    />
  )
}
