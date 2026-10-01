import { useEffect, useState } from 'react'

interface SplashScreenProps {
  onFinish: () => void
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter')

  useEffect(() => {
    // Phase: enter (0ms → 600ms fade/scale in)
    const holdTimer = setTimeout(() => setPhase('hold'), 600)
    // Phase: exit (2100ms → 2500ms fade out)
    const exitTimer = setTimeout(() => setPhase('exit'), 2100)
    // Phase: done (2500ms)
    const doneTimer = setTimeout(() => onFinish(), 2500)

    return () => {
      clearTimeout(holdTimer)
      clearTimeout(exitTimer)
      clearTimeout(doneTimer)
    }
  }, [onFinish])

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #08182b 0%, #0d2137 40%, #0a2540 70%, #05111e 100%)',
        transition: phase === 'exit' ? 'opacity 0.4s ease-out' : undefined,
        opacity: phase === 'exit' ? 0 : 1,
      }}
    >
      {/* Ambient glow blobs */}
      <div style={{
        position: 'absolute', width: 500, height: 500,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,168,150,0.18) 0%, transparent 70%)',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        animation: 'splashPulse 3s ease-in-out infinite',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', width: 300, height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%)',
        top: '35%', left: '60%',
        transform: 'translate(-50%, -50%)',
        animation: 'splashPulse 4s ease-in-out infinite reverse',
        pointerEvents: 'none',
      }} />

      {/* Logo container */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 32,
          animation: phase === 'enter'
            ? 'splashEnter 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards'
            : undefined,
          opacity: phase === 'enter' ? 0 : 1,
        }}
      >
        {/* Emblem only (large) */}
        <div style={{
          width: 160,
          height: 160,
          animation: 'splashRotateIn 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.1s both',
          filter: 'drop-shadow(0 0 32px rgba(0,168,150,0.5)) drop-shadow(0 0 8px rgba(0,168,150,0.3))',
        }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" fill="none" width="160" height="160">
            <defs>
              <clipPath id="splash-clip">
                <circle cx="90" cy="90" r="70" />
              </clipPath>
            </defs>
            {/* Outer ring */}
            <circle cx="90" cy="90" r="72" fill="#08182b" />
            <circle cx="90" cy="90" r="72" stroke="#00A896" strokeWidth="7" fill="#08182b" />
            {/* Inner scene */}
            <g clipPath="url(#splash-clip)">
              <rect x="10" y="10" width="160" height="160" fill="#08182b" />
              <circle cx="128" cy="58" r="16" fill="#F59E0B" />
              <polygon points="15,160 68,72 110,148" fill="#38BDF8" />
              <polygon points="15,160 68,72 80,160" fill="#2DD4BF" />
              <polygon points="55,160 118,65 170,160" fill="#E2E8F0" />
              <polygon points="55,160 118,65 118,160" fill="#FFFFFF" />
              <polygon points="16,160 68,74 105,138 68,160" fill="#22D3EE" />
              <path
                d="M 94 110 C 102 118, 108 128, 102 140 C 96 150, 84 156, 84 168"
                fill="none"
                stroke="#F59E0B"
                strokeWidth="6.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
            {/* Bottom arc */}
            <path d="M 56 154 C 74 163, 106 163, 124 154 C 112 165, 68 165, 56 154 Z" fill="#00A896" />
          </svg>
        </div>

        {/* Text group */}
        <div style={{
          textAlign: 'center',
          animation: 'splashTextIn 0.6s ease-out 0.3s both',
        }}>
          {/* TourVista wordmark */}
          <div style={{
            fontFamily: "'Plus Jakarta Sans', 'Outfit', 'Inter', system-ui, sans-serif",
            fontWeight: 900,
            fontSize: 52,
            letterSpacing: '-0.03em',
            lineHeight: 1,
          }}>
            <span style={{ color: '#ffffff' }}>Tour</span>
            <span style={{ color: '#00A896' }}>Vista</span>
          </div>

          {/* Subtitle */}
          <div style={{
            fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif",
            fontWeight: 700,
            fontSize: 12,
            letterSpacing: '0.34em',
            color: '#94a3b8',
            marginTop: 8,
            animation: 'splashTextIn 0.6s ease-out 0.5s both',
            opacity: 0,
          }}>
            EXPLORE BEYOND
          </div>

          {/* Swoosh underline */}
          <svg width="240" height="18" viewBox="0 0 240 18" fill="none" style={{ marginTop: 6 }}>
            <path
              d="M 4 9 Q 120 18 236 9"
              stroke="#00A896"
              strokeWidth="2.5"
              strokeLinecap="round"
              style={{ animation: 'splashSwoosh 0.7s ease-out 0.6s both' }}
            />
          </svg>
        </div>
      </div>

      {/* Loading dots */}
      <div style={{
        position: 'absolute',
        bottom: 64,
        display: 'flex',
        gap: 8,
        animation: 'splashTextIn 0.5s ease-out 0.8s both',
        opacity: 0,
      }}>
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: '#00A896',
              animation: `splashDot 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;900&display=swap');

        @keyframes splashEnter {
          from { opacity: 0; transform: translateY(30px) scale(0.92); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes splashRotateIn {
          from { opacity: 0; transform: scale(0.6) rotate(-15deg); }
          to   { opacity: 1; transform: scale(1)   rotate(0deg); }
        }
        @keyframes splashTextIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashSwoosh {
          from { stroke-dasharray: 300; stroke-dashoffset: 300; }
          to   { stroke-dasharray: 300; stroke-dashoffset: 0; }
        }
        @keyframes splashPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1);   opacity: 1; }
          50%       { transform: translate(-50%, -50%) scale(1.15); opacity: 0.7; }
        }
        @keyframes splashDot {
          0%, 80%, 100% { transform: scale(1);   opacity: 0.4; }
          40%            { transform: scale(1.5); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
