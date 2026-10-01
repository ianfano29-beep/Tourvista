import { useEffect, useState } from 'react'

interface SplashScreenProps {
  onFinish: () => void
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter')

  useEffect(() => {
    const holdTimer = setTimeout(() => setPhase('hold'), 600)
    const exitTimer = setTimeout(() => setPhase('exit'), 2100)
    const doneTimer = setTimeout(() => onFinish(), 2500)
    return () => {
      clearTimeout(holdTimer)
      clearTimeout(exitTimer)
      clearTimeout(doneTimer)
    }
  }, [onFinish])

  return (
    <div
      id="splash-root"
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
        pointerEvents: phase === 'exit' ? 'none' : 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* ── Ambient glow blobs ── */}
      <div className="splash-blob splash-blob--teal" />
      <div className="splash-blob splash-blob--amber" />

      {/* ── Main logo group ── */}
      <div
        className="splash-logo-group"
        style={{
          animation:
            phase === 'enter'
              ? 'splashEnter 0.7s cubic-bezier(0.34,1.56,0.64,1) forwards'
              : undefined,
          opacity: phase === 'enter' ? 0 : 1,
        }}
      >
        {/* Emblem */}
        <div className="splash-emblem">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 180 180"
            fill="none"
            width="100%"
            height="100%"
          >
            <defs>
              <clipPath id="splash-clip">
                <circle cx="90" cy="90" r="70" />
              </clipPath>
            </defs>
            <circle cx="90" cy="90" r="72" fill="#08182b" />
            <circle cx="90" cy="90" r="72" stroke="#00A896" strokeWidth="7" fill="#08182b" />
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
            <path
              d="M 56 154 C 74 163, 106 163, 124 154 C 112 165, 68 165, 56 154 Z"
              fill="#00A896"
            />
          </svg>
        </div>

        {/* Text */}
        <div className="splash-text-group">
          {/* Wordmark */}
          <div className="splash-wordmark">
            <span style={{ color: '#ffffff' }}>Tour</span>
            <span style={{ color: '#00A896' }}>Vista</span>
          </div>

          {/* Subtitle */}
          <div
            className="splash-subtitle"
            style={{ animation: 'splashTextIn 0.6s ease-out 0.5s both' }}
          >
            EXPLORE BEYOND
          </div>

          {/* Animated swoosh underline */}
          <svg
            className="splash-swoosh"
            viewBox="0 0 240 18"
            fill="none"
            preserveAspectRatio="none"
          >
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

      {/* ── Loading dots ── */}
      <div
        className="splash-dots"
        style={{ animation: 'splashTextIn 0.5s ease-out 0.8s both', opacity: 0 }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="splash-dot"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;900&display=swap');

        /* ─── Layout ─── */
        .splash-logo-group {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: clamp(20px, 4vw, 36px);
          padding: 0 clamp(16px, 5vw, 48px);
          max-width: 100vw;
          box-sizing: border-box;
        }

        /* ─── Emblem ─── */
        .splash-emblem {
          width:  clamp(120px, 38vw, 200px);
          height: clamp(120px, 38vw, 200px);
          animation: splashRotateIn 0.7s cubic-bezier(0.34,1.56,0.64,1) 0.1s both;
          filter: drop-shadow(0 0 clamp(16px, 5vw, 36px) rgba(0,168,150,0.50))
                  drop-shadow(0 0 6px rgba(0,168,150,0.30));
          flex-shrink: 0;
        }

        /* ─── Text group ─── */
        .splash-text-group {
          text-align: center;
          animation: splashTextIn 0.6s ease-out 0.3s both;
          width: 100%;
        }

        /* ─── Wordmark ─── */
        .splash-wordmark {
          font-family: 'Plus Jakarta Sans', 'Outfit', 'Inter', system-ui, sans-serif;
          font-weight: 900;
          font-size: clamp(36px, 11vw, 60px);
          letter-spacing: -0.03em;
          line-height: 1;
        }

        /* ─── Subtitle ─── */
        .splash-subtitle {
          font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif;
          font-weight: 700;
          font-size: clamp(9px, 2.5vw, 13px);
          letter-spacing: 0.34em;
          color: #94a3b8;
          margin-top: clamp(6px, 2vw, 10px);
          opacity: 0;
        }

        /* ─── Swoosh ─── */
        .splash-swoosh {
          display: block;
          width: clamp(160px, 55vw, 260px);
          height: 18px;
          margin: clamp(4px, 1.5vw, 8px) auto 0;
        }

        /* ─── Glow blobs ─── */
        .splash-blob {
          position: absolute;
          border-radius: 50%;
          pointer-events: none;
        }
        .splash-blob--teal {
          width:  clamp(280px, 80vw, 540px);
          height: clamp(280px, 80vw, 540px);
          background: radial-gradient(circle, rgba(0,168,150,0.18) 0%, transparent 70%);
          top: 50%; left: 50%;
          transform: translate(-50%, -50%);
          animation: splashPulse 3s ease-in-out infinite;
        }
        .splash-blob--amber {
          width:  clamp(180px, 55vw, 320px);
          height: clamp(180px, 55vw, 320px);
          background: radial-gradient(circle, rgba(245,158,11,0.12) 0%, transparent 70%);
          top: 32%; left: 62%;
          transform: translate(-50%, -50%);
          animation: splashPulse 4s ease-in-out infinite reverse;
        }

        /* ─── Loading dots ─── */
        .splash-dots {
          position: absolute;
          bottom: clamp(32px, 8vw, 72px);
          display: flex;
          gap: clamp(6px, 2vw, 10px);
        }
        .splash-dot {
          width:  clamp(5px, 1.8vw, 8px);
          height: clamp(5px, 1.8vw, 8px);
          border-radius: 50%;
          background-color: #00A896;
          animation: splashDot 1.2s ease-in-out infinite;
        }

        /* ─── Keyframes ─── */
        @keyframes splashEnter {
          from { opacity: 0; transform: translateY(30px) scale(0.92); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
        @keyframes splashRotateIn {
          from { opacity: 0; transform: scale(0.55) rotate(-18deg); }
          to   { opacity: 1; transform: scale(1)    rotate(0deg); }
        }
        @keyframes splashTextIn {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes splashSwoosh {
          from { stroke-dasharray: 300; stroke-dashoffset: 300; }
          to   { stroke-dasharray: 300; stroke-dashoffset: 0; }
        }
        @keyframes splashPulse {
          0%, 100% { transform: translate(-50%, -50%) scale(1);    opacity: 1; }
          50%       { transform: translate(-50%, -50%) scale(1.15); opacity: 0.7; }
        }
        @keyframes splashDot {
          0%, 80%, 100% { transform: scale(1);   opacity: 0.4; }
          40%            { transform: scale(1.6); opacity: 1; }
        }

        /* ─── Phone-specific overrides (≤ 480px) ─── */
        @media (max-width: 480px) {
          .splash-logo-group { gap: 18px; }
          .splash-blob--amber { left: 70%; }
        }

        /* ─── Very small phones (≤ 360px) ─── */
        @media (max-width: 360px) {
          .splash-wordmark { font-size: 32px; }
          .splash-emblem   { width: 110px; height: 110px; }
        }
      `}</style>
    </div>
  )
}
