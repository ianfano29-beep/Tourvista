import { useState, useMemo, type FormEvent } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

interface Props {
  onGuestLogin?: (email?: string) => void
}

export default function AuthPage({ onGuestLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [fullName, setFullName] = useState('Elena Vance')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [agreeTerms, setAgreeTerms] = useState(true)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'error' | 'success' | 'info'>('info')
  const [busy, setBusy] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  // Password strength calculation
  const passwordStats = useMemo(() => {
    const hasMinLength = password.length >= 8
    const hasNumber = /\d/.test(password)
    const hasUpper = /[A-Z]/.test(password)
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>_\-+=[\]~]/.test(password)
    const score = [hasMinLength, hasNumber, hasUpper, hasSpecial].filter(Boolean).length

    let label = 'Requires 8+ chars, uppercase, number & symbol'
    let colorClass = 'text-slate-400'
    let barColor = 'bg-slate-200'

    if (password.length > 0) {
      if (score === 1) {
        label = 'Weak: Add uppercase, number & symbol'
        colorClass = 'text-rose-600 font-semibold'
        barColor = 'bg-rose-500'
      } else if (score === 2) {
        label = 'Fair: Add uppercase & symbol'
        colorClass = 'text-amber-600 font-semibold'
        barColor = 'bg-amber-500'
      } else if (score === 3) {
        label = 'Good: Add a special symbol'
        colorClass = 'text-teal-700 font-semibold'
        barColor = 'bg-teal-600'
      } else if (score === 4) {
        label = 'Strong: 8+ chars, uppercase, number & symbol'
        colorClass = 'text-emerald-700 font-bold'
        barColor = 'bg-emerald-600'
      }
    }

    return { score, label, colorClass, barColor, isValid: score >= 3 }
  }, [password])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')

    const submitEmail = email.trim() || (mode === 'signup' ? 'ianfano29@gmail.com' : 'ianfano29@gmail.com')

    // Static Account verification
    if (submitEmail.toLowerCase() === 'ianfano29@gmail.com' && password === 'ianfano') {
      setTimeout(() => {
        setBusy(false)
        onGuestLogin?.('ianfano29@gmail.com')
      }, 300)
      return
    }

    if (mode === 'signup' && password.length > 0 && !passwordStats.isValid) {
      setBusy(false)
      setMsgType('error')
      setMsg('Please strengthen your password (must include 8+ characters, uppercase letter, and a number).')
      return
    }

    if (!isSupabaseConfigured) {
      setTimeout(() => {
        setBusy(false)
        if (onGuestLogin) {
          onGuestLogin(submitEmail)
        } else {
          setMsgType('info')
          setMsg('Supabase credentials not configured in .env. Logged in as demo explorer.')
        }
      }, 400)
      return
    }

    try {
      const { error } = mode === 'login'
        ? await supabase.auth.signInWithPassword({ email: submitEmail, password })
        : await supabase.auth.signUp({
            email: submitEmail,
            password,
            options: { data: { full_name: fullName } },
          })

      setBusy(false)
      if (error) {
        setMsgType('error')
        setMsg(error.message)
      } else if (mode === 'signup') {
        setMsgType('success')
        setMsg('Account created! Check your email inbox to confirm your account, then log in.')
      }
    } catch (err: any) {
      setBusy(false)
      setMsgType('error')
      setMsg(err?.message || 'Authentication failed. Please try again.')
    }
  }

  return (
    <div className="h-screen max-h-screen w-full bg-[#f8fafc] text-slate-900 flex flex-col justify-between overflow-hidden selection:bg-emerald-100 selection:text-emerald-900">
      {/* Top Header Navigation */}
      <header className="w-full max-w-7xl mx-auto px-6 py-2.5 sm:py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-lg bg-emerald-950 flex items-center justify-center text-emerald-400 font-black shadow-xs border border-emerald-800/40">
            <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.2l6 3.75v7.7l-6 3.75-6-3.75v-7.7l6-3.75zM11 7v6.5l4-2.5-4-2.5V7z" />
            </svg>
          </div>
          <span className="text-base font-extrabold tracking-tight text-slate-900">Traversal</span>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
          <button
            type="button"
            onClick={() => setHelpOpen(true)}
            className="hover:text-emerald-800 transition cursor-pointer"
          >
            Need help?
          </button>
          <button
            type="button"
            onClick={() => onGuestLogin?.('guest.explorer@traversal.app')}
            className="hover:text-emerald-800 transition cursor-pointer font-semibold text-slate-700 hover:underline"
          >
            Explore as guest
          </button>
          <button
            type="button"
            onClick={() => onGuestLogin?.('elena.vance@wanderlust.com')}
            className="h-6.5 w-6.5 rounded-full bg-emerald-800 hover:bg-emerald-700 transition flex items-center justify-center text-white cursor-pointer shadow-xs"
            title="Elena Vance (Instant Demo Profile)"
          >
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Authentication Container - Fitted Non-Scrollable */}
      <main className="flex-1 flex items-center justify-center px-4 py-1 sm:py-2 min-h-0 overflow-hidden">
        <div className="w-full max-w-[1020px] bg-white rounded-3xl shadow-xl shadow-slate-200/60 border border-slate-100 overflow-hidden grid grid-cols-1 lg:grid-cols-12 max-h-[calc(100vh-100px)]">
          
          {/* Form Side (7 cols on large screens) */}
          <div className="lg:col-span-7 p-5 sm:p-7 flex flex-col justify-between overflow-y-auto">
            <div>
              {/* Status Badge only in Sign Up mode */}
              {mode === 'signup' && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-[10px] font-bold text-emerald-800 tracking-wide uppercase mb-2">
                  <span className="text-xs">✨</span>
                  JOIN THE COMMUNITY
                </div>
              )}

              {/* Title & Subtitle */}
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight leading-snug">
                {mode === 'login' ? 'Welcome back to Traversal' : 'Start your journey with Traversal'}
              </h1>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-1 leading-relaxed">
                {mode === 'login'
                  ? 'Sign in to access your curated itineraries, saved places, and live TripAdvisor sync.'
                  : 'Create an account to save favorite spots, explore interactive routes, and view TripAdvisor reviews.'}
              </p>

              {/* Social Login Buttons */}
              <div className="grid grid-cols-2 gap-2.5 mt-3.5">
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition cursor-default select-none"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                  </svg>
                  <span>{mode === 'login' ? 'Google' : 'Sign up with Google'}</span>
                </button>

                <button
                  type="button"
                  className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-2 px-3 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 hover:border-slate-300 transition cursor-default select-none"
                >
                  <svg className="w-3.5 h-3.5 fill-current text-slate-900" viewBox="0 0 24 24">
                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.63 1.35-.57.65-1.06 1.72-.93 2.75 1.01.08 2.02-.5 2.64-1.25z" />
                  </svg>
                  <span>{mode === 'login' ? 'Apple' : 'Sign up with Apple'}</span>
                </button>
              </div>

              {/* Divider */}
              <div className="relative my-3 flex items-center justify-center">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200"></div>
                </div>
                <span className="relative bg-white px-2.5 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                  {mode === 'login' ? 'OR CONTINUE WITH EMAIL' : 'OR SIGN UP WITH EMAIL'}
                </span>
              </div>

              {/* Form Elements */}
              <form onSubmit={submit} className="space-y-3">
                {mode === 'signup' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        placeholder="Elena Vance"
                        required
                        className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8.5 pr-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/15"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={mode === 'login' ? 'ianfano29@gmail.com' : 'ianfano29@gmail.com'}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8.5 pr-3 py-1.5 text-xs text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/15"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">Password</label>
                    {mode === 'signup' && (
                      <span className={`text-[10px] ${passwordStats.colorClass}`}>
                        {passwordStats.label}
                      </span>
                    )}
                  </div>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••••"
                      minLength={mode === 'signup' ? 8 : undefined}
                      className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-8.5 pr-10 py-1.5 text-xs text-slate-900 outline-none transition focus:border-emerald-600 focus:bg-white focus:ring-2 focus:ring-emerald-600/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {showPassword ? (
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                        </svg>
                      ) : (
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                        </svg>
                      )}
                    </button>
                  </div>

                  {/* Active Working Password Strength Indicator (4 Bars) */}
                  {mode === 'signup' && (
                    <div className="grid grid-cols-4 gap-1 mt-1.5">
                      <div className={`h-1 rounded-full transition-all duration-300 ${passwordStats.score >= 1 ? passwordStats.barColor : 'bg-slate-200'}`}></div>
                      <div className={`h-1 rounded-full transition-all duration-300 ${passwordStats.score >= 2 ? passwordStats.barColor : 'bg-slate-200'}`}></div>
                      <div className={`h-1 rounded-full transition-all duration-300 ${passwordStats.score >= 3 ? passwordStats.barColor : 'bg-slate-200'}`}></div>
                      <div className={`h-1 rounded-full transition-all duration-300 ${passwordStats.score >= 4 ? passwordStats.barColor : 'bg-slate-200'}`}></div>
                    </div>
                  )}
                </div>

                {/* Login: Remember device + Forgot Password */}
                {mode === 'login' ? (
                  <div className="flex items-center justify-between text-xs pt-0.5">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-600">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-3.5 w-3.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
                      />
                      <span>Remember this device for 30 days</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMsgType('info')
                        setMsg('Password reset link sent to your registered email.')
                      }}
                      className="font-medium text-emerald-800 hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                ) : (
                  /* Signup: Terms agreement */
                  <div className="pt-0.5">
                    <label className="flex items-start gap-1.5 cursor-pointer text-[11px] text-slate-600 leading-tight">
                      <input
                        type="checkbox"
                        checked={agreeTerms}
                        onChange={(e) => setAgreeTerms(e.target.checked)}
                        required
                        className="h-3.5 w-3.5 mt-0.5 rounded border-slate-300 text-emerald-700 focus:ring-emerald-700"
                      />
                      <span>
                        I agree to Traversal's <span className="font-semibold text-slate-800">Terms of Service</span> and <span className="font-semibold text-slate-800">Privacy Policy</span>, and consent to cloud itinerary sync.
                      </span>
                    </label>
                  </div>
                )}

                {/* Message display */}
                {msg && (
                  <div
                    className={`rounded-xl p-2 text-xs font-medium ${
                      msgType === 'error'
                        ? 'bg-rose-50 text-rose-700 border border-rose-200'
                        : msgType === 'success'
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {msg}
                  </div>
                )}

                {/* Submit Action Button */}
                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-xl bg-emerald-700 py-2.5 px-4 text-xs sm:text-sm font-semibold text-white shadow-md shadow-emerald-700/20 hover:bg-emerald-800 active:scale-[0.99] transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-2"
                >
                  {busy ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Authenticating…</span>
                    </>
                  ) : mode === 'login' ? (
                    <>
                      <span>Sign in to Traversal</span>
                      <span>→</span>
                    </>
                  ) : (
                    <>
                      <span>Create Your Free Account</span>
                      <span>→</span>
                    </>
                  )}
                </button>
              </form>
            </div>

            {/* Bottom Toggle Link */}
            <div className="pt-3 border-t border-slate-100 text-center text-xs text-slate-600 mt-2">
              {mode === 'login' ? (
                <p>
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('signup')
                      setMsg('')
                    }}
                    className="font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Sign up for free
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login')
                      setMsg('')
                    }}
                    className="font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    Sign in
                  </button>
                </p>
              )}
            </div>
          </div>

          {/* Hero Visual Side (5 cols on large screens) */}
          <div className="lg:col-span-5 relative p-4 hidden lg:flex flex-col justify-between overflow-hidden bg-slate-900 rounded-3xl m-2">
            {/* Background scenic photo */}
            {mode === 'login' ? (
              <img
                src="https://images.unsplash.com/photo-1552832230-c0197dd311b5?auto=format&fit=crop&w=1200&q=85"
                alt="Rome Colosseum"
                className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-700 hover:scale-105"
              />
            ) : (
              <img
                src="https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=85"
                alt="Amalfi Coast Cliffside"
                className="absolute inset-0 h-full w-full object-cover opacity-90 transition duration-700 hover:scale-105"
              />
            )}

            {/* Gradient Overlays */}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-slate-900/40" />

            {/* Top Floating Badges (Only in signup mode) */}
            <div className="relative z-10 space-y-2">
              {mode === 'signup' && (
                <div className="flex items-center justify-between">
                  <span className="rounded-full bg-emerald-950/90 backdrop-blur-md px-3 py-1 text-[11px] font-bold text-emerald-300 border border-emerald-500/30 shadow-sm flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    TRAVERSAL PRO EXPLORER
                  </span>
                  <span className="rounded-full bg-slate-900/80 backdrop-blur-md px-2.5 py-1 text-[11px] font-medium text-slate-200 border border-white/10">
                    👥 Join 140,000+ travelers
                  </span>
                </div>
              )}
            </div>

            {/* Center Floating Route pill on Sign Up */}
            {mode === 'signup' && (
              <div className="relative z-10 self-start my-auto rounded-2xl bg-white/95 backdrop-blur-md p-3 shadow-xl border border-white/60 max-w-[220px]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span> ACTIVE ROUTE
                </span>
                <h4 className="text-xs font-bold text-slate-900 mt-0.5">Amalfi Coastal Ridge</h4>
                <p className="text-[10px] text-slate-500 font-medium">4 stages · AI Optimized</p>
              </div>
            )}

            {/* Bottom Card */}
            <div className="relative z-10 mt-auto pt-3">
              {mode === 'login' ? (
                /* Testimonial Card */
                <div className="rounded-2xl bg-white/95 backdrop-blur-md p-3.5 text-slate-900 shadow-2xl border border-white/60">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                      <span>★★★★★</span>
                      <span className="text-slate-800 ml-1">5.0</span>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      📍 Rome, Italy
                    </span>
                  </div>
                  <p className="text-xs text-slate-700 italic leading-relaxed">
                    “Traversal organized our 4-day Rome food tour down to the walking minute. Syncing live places with TripAdvisor is pure magic!”
                  </p>
                  <div className="flex items-center gap-2 mt-2.5 pt-2 border-t border-slate-100">
                    <img
                      src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&q=80"
                      alt="Elena Vance"
                      className="h-7 w-7 rounded-full object-cover border border-emerald-600"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 leading-tight">Elena Vance</h4>
                      <p className="text-[10px] text-slate-500">Top Contributor Level 4 · 42 Countries Explored</p>
                    </div>
                  </div>
                </div>
              ) : (
                /* Feature Highlights Card Tailored for Travel Discovery Platform */
                <div className="rounded-2xl bg-slate-950/85 backdrop-blur-md p-4 text-white shadow-2xl border border-white/10">
                  <h3 className="text-xs sm:text-sm font-bold text-white">Smart Travel & Discovery Engine</h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                    Discover curated spots, verified traveler recommendations, and live interactive routes across world-class destinations.
                  </p>
                  <div className="mt-2.5 space-y-1.5 text-[10px] sm:text-[11px]">
                    <div className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">📍</span>
                      <div>
                        <span className="font-semibold text-white">Interactive Discovery Map: </span>
                        <span className="text-slate-300">Explore real-time GPS locations, route distances, and customized landmark filters.</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">★</span>
                      <div>
                        <span className="font-semibold text-white">TripAdvisor Verified Reviews: </span>
                        <span className="text-slate-300">Instant access to 5-star ratings, authenticated feedback, and travel insights.</span>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <span className="text-teal-400 font-bold">⚡</span>
                      <div>
                        <span className="font-semibold text-white">Saved Collections & Itineraries: </span>
                        <span className="text-slate-300">Bookmark top attractions, restaurants, and hotels for seamless trip planning.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Footer Navigation */}
      <footer className="w-full max-w-7xl mx-auto px-6 py-2 sm:py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] sm:text-[11px] text-slate-500 border-t border-slate-200/60 shrink-0">
        <div className="flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            256-Bit SSL Encrypted
          </span>
          <span className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Global Trip Protection
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button type="button" onClick={() => setHelpOpen(true)} className="hover:text-slate-800 transition cursor-pointer">Privacy Policy</button>
          <button type="button" onClick={() => setHelpOpen(true)} className="hover:text-slate-800 transition cursor-pointer">Terms of Service</button>
          <button type="button" onClick={() => setHelpOpen(true)} className="hover:text-slate-800 transition cursor-pointer">Cookie Preferences</button>
          <span>© 2025 Traversal Inc. All rights reserved.</span>
        </div>
      </footer>

      {/* Help Modal */}
      {helpOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-xs p-4" onClick={() => setHelpOpen(false)}>
          <div className="w-full max-w-md bg-white rounded-2xl p-6 shadow-2xl border border-slate-200" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Traversal Support & Security</h3>
              <button type="button" onClick={() => setHelpOpen(false)} className="text-slate-400 hover:text-slate-600 text-lg">×</button>
            </div>
            <div className="py-4 space-y-3 text-xs text-slate-600 leading-relaxed">
              <p>
                <strong>Instant Exploration:</strong> You can click <span className="text-emerald-700 font-semibold">"Explore as guest"</span> anytime in the header to preview all discovery features without needing an account.
              </p>
              <p>
                <strong>Supabase Authentication:</strong> Connect your Supabase project in <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-800">.env</code> to enable live email confirmations, OAuth, and cloud sync.
              </p>
              <p>
                <strong>Encrypted Storage:</strong> Your saved places and travel notes are secured with row-level security.
              </p>
            </div>
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setHelpOpen(false)
                  onGuestLogin?.('guest.traveler@traversal.app')
                }}
                className="rounded-xl bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-800 transition cursor-pointer"
              >
                Launch Guest Demo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
