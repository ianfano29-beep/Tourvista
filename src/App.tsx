import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import { DEFAULT_LOCATION } from './lib/locations'
import type { Category, Location } from './types'
import AuthPage from './components/AuthPage'
import Dashboard from './components/Dashboard'
import MapView from './components/MapView'
import AdminDashboard from './components/AdminDashboard'
import SplashScreen from './components/SplashScreen'

// ─── Admin credentials (front-end gate; real security is via Supabase RLS) ───
const ADMIN_EMAIL = 'admin@gmail.com'
const ADMIN_PASS  = '!Admin123!'

export default function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [guestUser, setGuestUser] = useState<string | null>(() => localStorage.getItem('wander_guest_email'))
  const [isAdmin, setIsAdmin] = useState(() => localStorage.getItem('tv_admin') === '1')
  const [ready, setReady] = useState(false)
  const [showSplash, setShowSplash] = useState(true)
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

  /**
   * Called by AuthPage when the user submits the login form.
   * If the credentials match the admin account we short-circuit
   * and open the admin dashboard instead of going through Supabase auth.
   * Signs in via Supabase so the JWT is present and RLS write policies work.
   * Returns true if we handled it as admin (so AuthPage can skip the
   * normal Supabase flow).
   */
  const handleAdminLogin = async (email: string, pass: string): Promise<boolean> => {
    if (email.toLowerCase() !== ADMIN_EMAIL || pass !== ADMIN_PASS) return false

    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
      if (error) {
        // Surface the error so the admin knows sign-in failed
        alert(`⚠️ Supabase sign-in failed: ${error.message}\n\nThe admin dashboard will open but DB writes will be rejected until this is fixed.`)
        console.error('[Admin] Supabase sign-in failed:', error.message)
      } else {
        console.log('[Admin] Supabase sign-in successful ✓')
      }
    }

    localStorage.setItem('tv_admin', '1')
    setIsAdmin(true)
    return true
  }

  const handleLogout = async () => {
    if (isSupabaseConfigured && session) {
      await supabase.auth.signOut()
    }
    localStorage.removeItem('wander_guest_email')
    localStorage.removeItem('tv_admin')
    setGuestUser(null)
    setSession(null)
    setIsAdmin(false)
    setCategory(null)
  }

  if (showSplash) {
    return <SplashScreen onFinish={() => setShowSplash(false)} />
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-700">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#00A896] border-t-transparent"></div>
          <p className="text-sm font-semibold text-slate-800 tracking-wide">Loading TourVista…</p>
        </div>
      </div>
    )
  }

  // ── Admin route ──────────────────────────────────────────────────────────────
  if (isAdmin) {
    return <AdminDashboard onLogout={handleLogout} />
  }

  const userEmail = session?.user.email ?? guestUser

  if (!userEmail) {
    return <AuthPage onGuestLogin={handleGuestLogin} onAdminLogin={handleAdminLogin} />
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

  const isGuest =
    !session &&
    (!guestUser ||
      guestUser === 'traveler@wander.app' ||
      guestUser === 'guest.traveler@tourvista.app')

  return (
    <Dashboard
      email={userEmail}
      isGuest={isGuest}
      location={location}
      onSelect={(l: Location, c: Category) => {
        setLocation(l)
        setCategory(c)
      }}
      onLogout={handleLogout}
    />
  )
}
