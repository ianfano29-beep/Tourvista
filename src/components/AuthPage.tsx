import { useState, useMemo, type FormEvent } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import TourVistaLogo from './TourVistaLogo'

interface Props {
  onGuestLogin?: (email?: string) => void
  /** Returns true (or Promise<true>) if the creds matched admin — AuthPage should stop the flow. */
  onAdminLogin?: (email: string, password: string) => boolean | Promise<boolean>
}

export default function AuthPage({ onGuestLogin, onAdminLogin }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [agreeTerms, setAgreeTerms] = useState(true)
  const [msg, setMsg] = useState('')
  const [msgType, setMsgType] = useState<'error' | 'success' | 'info'>('info')
  const [busy, setBusy] = useState(false)

  // Password strength calculation for sign up
  const passwordStats = useMemo(() => {
    const hasMinLength = password.length >= 8
    const hasNumber = /\d/.test(password)
    const hasUpper = /[A-Z]/.test(password)
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>_\-+=[\]~]/.test(password)
    const score = [hasMinLength, hasNumber, hasUpper, hasSpecial].filter(Boolean).length

    let label = 'Weak Protection'
    let textColor = 'text-rose-600'
    let barColor = 'bg-rose-500'
    let activeBars = 1

    if (password.length === 0) {
      return {
        score: 0,
        activeBars: 0,
        label: 'Strong Protection',
        textColor: 'text-teal-600',
        barColor: 'bg-slate-200',
        isValid: false,
      }
    }

    if (score <= 1) {
      label = 'Weak Protection'
      textColor = 'text-rose-600'
      barColor = 'bg-rose-500'
      activeBars = 1
    } else if (score === 2) {
      label = 'Moderate Protection'
      textColor = 'text-amber-600'
      barColor = 'bg-amber-500'
      activeBars = 2
    } else {
      label = 'Strong Protection'
      textColor = 'text-[#059669]'
      barColor = 'bg-[#064e3b]'
      activeBars = 3
    }

    return { score, activeBars, label, textColor, barColor, isValid: score >= 2 }
  }, [password])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setMsg('')

    const submitEmail = email.trim()

    if (!submitEmail) {
      setBusy(false)
      setMsgType('error')
      setMsg('Please enter a valid email address.')
      return
    }

    // ── Admin shortcut ───────────────────────────────────────────────────────
    if (onAdminLogin && mode === 'login') {
      const handled = await onAdminLogin(submitEmail, password)
      if (handled) {
        setBusy(false)
        return
      }
    }

    // Direct demo login fallback
    if (submitEmail.toLowerCase() === 'ianfano29@gmail.com' && password === 'ianfano') {
      setTimeout(() => {
        setBusy(false)
        onGuestLogin?.(submitEmail)
      }, 300)
      return
    }

    if (mode === 'signup' && !agreeTerms) {
      setBusy(false)
      setMsgType('error')
      setMsg('Please agree to the Terms of Service and Privacy Policy to continue.')
      return
    }

    if (!isSupabaseConfigured) {
      setTimeout(() => {
        setBusy(false)
        if (onGuestLogin) {
          onGuestLogin(submitEmail || 'guest.traveler@tourvista.app')
        } else {
          setMsgType('info')
          setMsg('Supabase not configured. Logged in as demo explorer.')
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
    <div className="min-h-screen w-full bg-[#ebf2fa] text-slate-900 flex items-center justify-center p-3 sm:p-6 md:p-10 selection:bg-sky-100 selection:text-sky-900 font-sans">
      {/* Main Authentication Card Container */}
      <div className="w-full max-w-[1040px] bg-white rounded-[28px] shadow-2xl shadow-sky-950/10 border border-white overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[640px]">
        
        {/* Left Visual Hero Side */}
        <div className="lg:col-span-6 relative p-6 sm:p-9 flex flex-col justify-between overflow-hidden bg-slate-900 min-h-[460px] lg:min-h-full">
          {/* Background image: Plaza General Santos Monument (Zoomed) */}
          <img
            src="https://dynamic-media-cdn.tripadvisor.com/media/photo-o/19/78/75/dc/20190927-145858-largejpg.jpg?w=1200&h=1200&s=1"
            alt="Plaza General Santos Pioneer Landmark"
            className="absolute inset-0 h-full w-full object-cover object-[center_30%] scale-[1.4] sm:scale-[1.48] transition-transform duration-700"
          />

          {/* Scrim overlay gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-slate-900/40" />

          {/* Top Badges */}
          <div className="relative z-10 flex flex-wrap items-center justify-between gap-2.5">
            <TourVistaLogo variant="horizontal" size="sm" theme="dark" showTagline />
            <div className="flex items-center gap-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/20 text-white text-[11px] font-semibold tracking-wide shadow-sm">
                <span className="text-[#f59e0b] text-xs">🧭</span>
                <span>GENSAN HERITAGE PASS</span>
              </div>
            </div>
          </div>

          {/* Middle Headings */}
          <div className="relative z-10 my-auto py-6">
            <p className="text-[11px] sm:text-xs font-extrabold uppercase tracking-widest text-[#4ef3d2] mb-2">
              PIONEER HERITAGE LANDMARK
            </p>
            
            {mode === 'login' ? (
              <>
                <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-white leading-[1.15] tracking-tight">
                  Welcome back,<br />Explorer.
                </h1>
                <p className="text-xs sm:text-[13px] text-slate-200/90 mt-3 leading-relaxed max-w-md font-normal">
                  Sign in to access your curated itineraries, offline trail passes, real-time audio guides, and exclusive mountain waypoints.
                </p>
              </>
            ) : (
              <>
                <h1 className="text-3xl sm:text-4xl lg:text-[42px] font-extrabold text-white leading-[1.15] tracking-tight">
                  Begin Your<br />Journey.
                </h1>
                <p className="text-xs sm:text-[13px] text-slate-200/90 mt-3 leading-relaxed max-w-md font-normal">
                  Join millions of travelers discovering incredible curated tours, secret viewpoints, and bespoke adventures worldwide.
                </p>
              </>
            )}

            {/* Testimonial Glass Card */}
            <div className="mt-5 rounded-2xl bg-white/10 backdrop-blur-xl border border-white/20 p-4 text-white shadow-2xl max-w-md">
              {/* Star Rating */}
              <div className="flex items-center gap-1.5 mb-2">
                <div className="flex text-[#fbbf24] text-xs tracking-tight">
                  {'★'.repeat(5)}
                </div>
                <span className="text-[11px] font-bold text-white/90 ml-1">4.9 / 5.0</span>
              </div>

              {mode === 'login' ? (
                <>
                  <p className="text-[11px] sm:text-xs text-slate-200 leading-relaxed italic">
                    “TourVista provided incredible historical context on the General Paulino Santos monument and Pioneer settlement trails. Navigating General Santos City's cultural heritage was effortless.”
                  </p>
                  
                  {/* Reviewer Profile */}
                  <div className="flex items-center gap-2.5 mt-3 pt-2.5 border-t border-white/15">
                    <div className="h-8 w-8 rounded-full bg-[#d97706] text-white flex items-center justify-center font-bold text-[11px] shadow-sm">
                      CD
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">Cryz Fate Dumaniel</h4>
                      <p className="text-[10px] text-slate-300">GenSan Heritage & Culture Guide</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-[11px] sm:text-xs text-slate-200 leading-relaxed">
                    Join millions of travelers discovering incredible curated tours, secret viewpoints, and bespoke adventures worldwide.
                  </p>
                  
                  {/* Reviewer Profile */}
                  <div className="flex items-center gap-2.5 mt-3 pt-2.5 border-t border-white/15">
                    <div className="h-8 w-8 rounded-full bg-[#d97706] text-white flex items-center justify-center font-bold text-[11px] shadow-sm">
                      CL
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-white leading-tight">Charles Labuca</h4>
                      <p className="text-[10px] text-slate-300">Tourist</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Bottom Progress Indicator Line */}
          <div className="relative z-10 pt-2">
            <div className="w-full h-[3px] bg-white/25 rounded-full overflow-hidden">
              <div className="w-2/5 h-full bg-white rounded-full"></div>
            </div>
          </div>
        </div>

        {/* Right Form Side */}
        <div className="lg:col-span-6 p-6 sm:p-9 lg:p-10 flex flex-col justify-between bg-white">
          <div>
            {/* Top Brand Logo */}
            <div className="flex items-center justify-between">
              <TourVistaLogo variant="horizontal" size="sm" showTagline />

              {/* Guest / Demo Quick Link */}
              <button
                type="button"
                onClick={() => onGuestLogin?.('guest.explorer@tourvista.app')}
                className="text-[11px] font-semibold text-slate-500 hover:text-[#00a896] transition cursor-pointer hover:underline"
              >
                Demo Explorer
              </button>
            </div>

            {/* Title & Subtitle */}
            <div className="mt-6 mb-5">
              <h2 className="text-2xl sm:text-[26px] font-black text-slate-900 tracking-tight leading-tight">
                {mode === 'login' ? 'Sign In to Your Account' : 'Create Your TourVista Account'}
              </h2>
              <p className="text-xs sm:text-[13px] text-slate-500 mt-1">
                {mode === 'login'
                  ? 'Welcome back! Enter your details to continue your adventure.'
                  : 'Sign up in seconds and start planning your next escape.'}
              </p>
            </div>

            {/* Social Auth Buttons */}
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onGuestLogin?.('google.traveler@tourvista.app')}
                className="flex items-center justify-center gap-2.5 rounded-xl bg-[#edf3fb] hover:bg-[#e2edf8] py-2.5 px-3 text-xs font-semibold text-slate-700 transition cursor-pointer"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>Google</span>
              </button>

              <button
                type="button"
                onClick={() => onGuestLogin?.('apple.traveler@tourvista.app')}
                className="flex items-center justify-center gap-2.5 rounded-xl bg-[#1e293b] hover:bg-[#0f172a] py-2.5 px-3 text-xs font-semibold text-white transition cursor-pointer shadow-sm"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.99.6-2.63 1.35-.57.65-1.06 1.72-.93 2.75 1.01.08 2.02-.5 2.64-1.25z" />
                </svg>
                <span>Apple ID</span>
              </button>
            </div>

            {/* Divider */}
            <div className="relative my-4 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <span className="relative bg-white px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                OR CONTINUE WITH
              </span>
            </div>

            {/* Form */}
            <form onSubmit={submit} className="space-y-3">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                  <div className="relative">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. John Doe"
                      required={mode === 'signup'}
                      className="w-full rounded-xl bg-[#f1f5fa] border-0 pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#0c3150] outline-none transition"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email Address</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@example.com"
                    required
                    className="w-full rounded-xl bg-[#f1f5fa] border-0 pl-10 pr-3.5 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#0c3150] outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Password</label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••••"
                    minLength={mode === 'signup' ? 6 : undefined}
                    required
                    className="w-full rounded-xl bg-[#f1f5fa] border-0 pl-10 pr-10 py-2.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#0c3150] outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                      </svg>
                    ) : (
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    )}
                  </button>
                </div>

                {/* Password Strength Indicator for Sign Up */}
                {mode === 'signup' && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[11px] mb-1">
                      <span className="text-slate-500 font-medium">Password Strength</span>
                      <span className={`font-semibold flex items-center gap-1 ${passwordStats.textColor}`}>
                        <span>✓</span>
                        <span>{passwordStats.label}</span>
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className={`h-1 rounded-full transition-all duration-300 ${passwordStats.activeBars >= 1 ? passwordStats.barColor : 'bg-slate-200'}`}></div>
                      <div className={`h-1 rounded-full transition-all duration-300 ${passwordStats.activeBars >= 2 ? passwordStats.barColor : 'bg-slate-200'}`}></div>
                      <div className={`h-1 rounded-full transition-all duration-300 ${passwordStats.activeBars >= 3 ? passwordStats.barColor : 'bg-slate-200'}`}></div>
                    </div>
                  </div>
                )}
              </div>

              {/* Options Row: Remember me & Forgot Password */}
              <div className="flex items-center justify-between text-xs pt-1">
                <label className="flex items-center gap-2 cursor-pointer text-slate-600 select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-[#0c3150] focus:ring-[#0c3150]"
                  />
                  <span className="text-xs">Remember me</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setMsgType('info')
                    setMsg('Password reset link sent to your email address.')
                  }}
                  className="font-bold text-[#b45309] hover:text-[#92400e] text-xs hover:underline cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>

              {/* Terms Checkbox in Sign Up mode */}
              {mode === 'signup' && (
                <div className="pt-0.5">
                  <label className="flex items-start gap-2 cursor-pointer text-[11px] text-slate-600 select-none leading-snug">
                    <input
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      required
                      className="h-3.5 w-3.5 mt-0.5 rounded border-slate-300 text-[#0c3150] focus:ring-[#0c3150]"
                    />
                    <span>
                      I agree to TourVista's <span className="font-bold text-slate-900">Terms of Service</span> and <span className="font-bold text-slate-900">Privacy Policy</span>.
                    </span>
                  </label>
                </div>
              )}

              {/* Message Banner */}
              {msg && (
                <div
                  className={`rounded-xl p-2.5 text-xs font-medium ${
                    msgType === 'error'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : msgType === 'success'
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-sky-50 text-sky-800 border border-sky-200'
                  }`}
                >
                  {msg}
                </div>
              )}

              {/* Primary Submit Button */}
              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-xl bg-[#0c3150] hover:bg-[#072036] active:scale-[0.99] text-white py-3 px-4 font-bold text-xs sm:text-sm shadow-md transition duration-150 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 mt-3"
              >
                {busy ? (
                  <>
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    <span>Processing…</span>
                  </>
                ) : mode === 'login' ? (
                  <span>Sign In</span>
                ) : (
                  <span>Sign Up</span>
                )}
              </button>
            </form>
          </div>

          {/* Bottom Switch Mode Link */}
          <div className="pt-4 text-center text-xs text-slate-600 mt-3">
            {mode === 'login' ? (
              <p>
                Already have an account?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode('signup')
                    setMsg('')
                  }}
                  className="font-bold text-[#0c3150] hover:underline cursor-pointer"
                >
                  Create Account
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
                  className="font-bold text-[#0c3150] hover:underline cursor-pointer"
                >
                  Log in
                </button>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
