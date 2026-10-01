import React from 'react'

interface TourVistaLogoProps {
  /**
   * Layout format:
   * - 'full': Emblem + "TourVista" + "EXPLORE BEYOND" tagline + swoosh arc
   * - 'horizontal': Emblem + "TourVista" brand name side-by-side (ideal for navbars)
   * - 'icon': Just the circular emblem badge
   */
  variant?: 'full' | 'horizontal' | 'icon'
  /** Size scale preset or custom pixel height */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number
  /** Color theme for text (light mode = dark text, dark mode = white/light text) */
  theme?: 'light' | 'dark'
  /** Optional custom class name */
  className?: string
  /** Whether to show the "EXPLORE BEYOND" tagline in horizontal mode */
  showTagline?: boolean
}

export function TourVistaEmblem({ size = 32, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 160 160"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 select-none ${className}`}
    >
      <defs>
        <clipPath id={`tv-clip-${size}`}>
          <circle cx="80" cy="80" r="68" />
        </clipPath>
      </defs>

      {/* Dark Navy Background Base */}
      <circle cx="80" cy="80" r="70" fill="#08182b" />
      
      {/* Teal Outer Border Ring */}
      <circle cx="80" cy="80" r="69" stroke="#00A896" strokeWidth="8" fill="#08182b" />

      {/* Clipped Mountain & Sun artwork */}
      <g clipPath={`url(#tv-clip-${size})`}>
        {/* Navy Sky */}
        <rect width="160" height="160" fill="#08182b" />

        {/* Warm Golden Sun */}
        <circle cx="118" cy="48" r="17" fill="#F59E0B" />

        {/* Left Mint/Teal Mountain Facet */}
        <polygon points="10,150 58,62 100,140" fill="#38BDF8" />
        <polygon points="10,150 58,62 70,150" fill="#2DD4BF" />

        {/* Right Crisp White Mountain Facet */}
        <polygon points="46,150 108,54 158,150" fill="#E2E8F0" />
        <polygon points="46,150 108,54 108,150" fill="#FFFFFF" />

        {/* Left Foreground Accent Mountain */}
        <polygon points="12,150 58,64 94,130 58,150" fill="#22D3EE" />

        {/* Winding Golden Trail */}
        <path
          d="M 84 98 C 92 106, 98 116, 92 128 C 86 138, 74 144, 74 156"
          fill="none"
          stroke="#F59E0B"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      {/* Bottom Teal Crescent Arc */}
      <path
        d="M 46 142 C 64 152, 96 152, 114 142 C 102 153, 58 153, 46 142 Z"
        fill="#00A896"
      />
    </svg>
  )
}

export default function TourVistaLogo({
  variant = 'horizontal',
  size = 'md',
  theme = 'light',
  className = '',
  showTagline = false,
}: TourVistaLogoProps) {
  // Preset pixel heights
  const sizeMap = {
    xs: { icon: 22, text: 'text-sm', sub: 'text-[9px]', fullWidth: 160, fullHeight: 52 },
    sm: { icon: 28, text: 'text-base', sub: 'text-[10px]', fullWidth: 200, fullHeight: 64 },
    md: { icon: 34, text: 'text-xl', sub: 'text-[11px]', fullWidth: 260, fullHeight: 84 },
    lg: { icon: 44, text: 'text-2xl', sub: 'text-xs', fullWidth: 320, fullHeight: 104 },
    xl: { icon: 56, text: 'text-3xl', sub: 'text-sm', fullWidth: 400, fullHeight: 130 },
  }

  const isNumericSize = typeof size === 'number'
  const iconSize = isNumericSize ? size : sizeMap[size].icon
  const typography = !isNumericSize ? sizeMap[size] : sizeMap.md

  const tourTextColor = theme === 'dark' ? 'text-white' : 'text-[#08182b]'
  const subTextColor = theme === 'dark' ? 'text-slate-300' : 'text-slate-700'

  if (variant === 'icon') {
    return <TourVistaEmblem size={iconSize} className={className} />
  }

  if (variant === 'full') {
    return (
      <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
        <div className="flex items-center gap-3">
          <TourVistaEmblem size={iconSize * 1.35} />
          <div className="flex flex-col">
            <div className="flex items-baseline">
              <span className={`${typography.text} font-black tracking-tight ${tourTextColor}`}>
                Tour
              </span>
              <span className={`${typography.text} font-black tracking-tight text-[#00A896]`}>
                Vista
              </span>
            </div>
            <span
              className={`${typography.sub} font-bold tracking-[0.28em] ${subTextColor} uppercase -mt-0.5`}
            >
              Explore Beyond
            </span>
          </div>
        </div>
        {/* Subtle curved underline swoosh */}
        <svg
          viewBox="0 0 200 12"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full max-w-[220px] mt-1 text-[#00A896]"
        >
          <path
            d="M 10 3 Q 100 11 190 3"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </svg>
      </div>
    )
  }

  // Horizontal variant (default)
  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      <TourVistaEmblem size={iconSize} />
      <div className="flex flex-col justify-center leading-none">
        <div className="flex items-baseline leading-none">
          <span className={`${typography.text} font-black tracking-tight ${tourTextColor}`}>
            Tour
          </span>
          <span className={`${typography.text} font-black tracking-tight text-[#00A896]`}>
            Vista
          </span>
        </div>
        {showTagline && (
          <span
            className={`${typography.sub} font-bold tracking-[0.22em] ${subTextColor} uppercase mt-1`}
          >
            Explore Beyond
          </span>
        )}
      </div>
    </div>
  )
}
