import React from 'react';

interface RainSenseIconProps {
  className?: string;
  size?: number | string;
  expression?: 'happy' | 'thinking' | 'excited' | 'rainy';
  withBadge?: boolean;
}

export function RainSenseIcon({
  className = '',
  size = 48,
  expression = 'happy',
  withBadge = false
}: RainSenseIconProps) {
  const pixelSize = typeof size === 'number' ? `${size}px` : size;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 select-none ${className}`}
      style={{ width: pixelSize, height: pixelSize }}
    >
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-md transition-transform hover:scale-105"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="cloudGrad" x1="20" y1="15" x2="80" y2="85" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="50%" stopColor="#0284C7" />
            <stop offset="100%" stopColor="#0369A1" />
          </linearGradient>

          <linearGradient id="bellyGrad" x1="30" y1="35" x2="70" y2="85" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#F0F9FF" />
            <stop offset="100%" stopColor="#BAE6FD" />
          </linearGradient>

          <linearGradient id="visorGrad" x1="25" y1="35" x2="75" y2="55" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#0F172A" />
            <stop offset="100%" stopColor="#1E293B" />
          </linearGradient>

          <linearGradient id="dropGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38BDF8" />
            <stop offset="100%" stopColor="#0284C7" />
          </linearGradient>

          <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Soft ground shadow */}
        <ellipse cx="50" cy="94" rx="26" ry="3.5" fill="rgba(2, 132, 199, 0.2)" />

        {/* Weather Radar Antenna */}
        <path d="M 50 18 L 50 8" stroke="#0284C7" strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="6" r="4.5" fill="#38BDF8" filter="url(#glowEffect)" />
        <circle cx="50" cy="6" r="2" fill="#FFFFFF" />
        {/* Antenna signal pulses */}
        <path d="M 43 7 A 8 8 0 0 1 57 7" stroke="#38BDF8" strokeWidth="1.8" strokeLinecap="round" fill="none" opacity="0.8" />
        <path d="M 38 4 A 14 14 0 0 1 62 4" stroke="#38BDF8" strokeWidth="1.4" strokeLinecap="round" fill="none" opacity="0.5" />

        {/* Main Body - Cute Streamlined Rain Cloud / Droplet Mascot */}
        <path
          d="M 28 65 C 20 65 14 58 14 50 C 14 42 20 36 28 35 C 30 24 40 16 52 16 C 65 16 75 25 76 36 C 84 37 90 43 90 51 C 90 59 83 65 75 65 Z"
          fill="url(#cloudGrad)"
          stroke="#0284C7"
          strokeWidth="2.5"
        />

        {/* Inner Cloud Belly */}
        <path
          d="M 30 63 C 23 63 18 57 18 51 C 18 44 23 39 30 38 C 32 28 41 21 51 21 C 62 21 71 29 72 39 C 79 40 84 45 84 52 C 84 59 78 63 71 63 Z"
          fill="url(#bellyGrad)"
        />

        {/* High-Tech Cyan Visor Screen */}
        <rect x="27" y="36" width="46" height="20" rx="10" fill="url(#visorGrad)" stroke="#38BDF8" strokeWidth="1.5" />

        {/* Expressive Glowing Eyes inside Visor */}
        {expression === 'thinking' ? (
          <>
            {/* Thinking / Scanning Waves */}
            <path d="M 33 46 L 43 46" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" filter="url(#glowEffect)" />
            <path d="M 57 46 L 67 46" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" filter="url(#glowEffect)" />
            <circle cx="50" cy="46" r="2.2" fill="#38BDF8" />
          </>
        ) : expression === 'excited' ? (
          <>
            {/* Happy Curved Up Eyes */}
            <path d="M 33 48 Q 39 42 45 48" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" fill="none" filter="url(#glowEffect)" />
            <path d="M 55 48 Q 61 42 67 48" stroke="#38BDF8" strokeWidth="3" strokeLinecap="round" fill="none" filter="url(#glowEffect)" />
          </>
        ) : (
          <>
            {/* Friendly Round Glowing Eyes with highlights */}
            <ellipse cx="39" cy="46" rx="4.5" ry="5.5" fill="#38BDF8" filter="url(#glowEffect)" />
            <circle cx="37.5" cy="44" r="1.8" fill="#FFFFFF" />
            <ellipse cx="61" cy="46" rx="4.5" ry="5.5" fill="#38BDF8" filter="url(#glowEffect)" />
            <circle cx="59.5" cy="44" r="1.8" fill="#FFFFFF" />
          </>
        )}

        {/* Soft Cheeks */}
        <ellipse cx="26" cy="55" rx="3.5" ry="2" fill="#38BDF8" opacity="0.6" />
        <ellipse cx="74" cy="55" rx="3.5" ry="2" fill="#38BDF8" opacity="0.6" />

        {/* Soft Friendly Smile */}
        <path d="M 46 59 Q 50 63 54 59" stroke="#0284C7" strokeWidth="2.2" strokeLinecap="round" fill="none" />

        {/* Little Floating Raindrops beneath the cloud */}
        <g>
          {/* Droplet 1 */}
          <path d="M 32 71 C 32 71 29.5 75 29.5 77 C 29.5 78.5 30.6 80 32 80 C 33.4 80 34.5 78.5 34.5 77 C 34.5 75 32 71 32 71 Z" fill="url(#dropGrad)" />
          {/* Droplet 2 (Center) */}
          <path d="M 50 74 C 50 74 46.5 79 46.5 81.5 C 46.5 83.5 48 85.5 50 85.5 C 52 85.5 53.5 83.5 53.5 81.5 C 53.5 79 50 74 50 74 Z" fill="url(#dropGrad)" filter="url(#glowEffect)" />
          {/* Droplet 3 */}
          <path d="M 68 71 C 68 71 65.5 75 65.5 77 C 65.5 78.5 66.6 80 68 80 C 69.4 80 70.5 78.5 70.5 77 C 70.5 75 68 71 68 71 Z" fill="url(#dropGrad)" />
        </g>
      </svg>

      {/* Online Live Badge */}
      {withBadge && (
        <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full shadow-sm" />
      )}
    </div>
  );
}
