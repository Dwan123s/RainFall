import React from 'react';

interface ChiikawaIconProps {
  className?: string;
  size?: number | string;
  expression?: 'happy' | 'thinking' | 'excited' | 'sleepy';
  withBadge?: boolean;
}

export function ChiikawaIcon({
  className = '',
  size = 48,
  expression = 'happy',
  withBadge = false
}: ChiikawaIconProps) {
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
        className="w-full h-full drop-shadow-sm transition-transform hover:scale-105"
      >
        {/* Soft Shadow behind head */}
        <ellipse cx="50" cy="94" rx="34" ry="5" fill="rgba(0, 0, 0, 0.08)" />

        {/* Left Ear */}
        <circle cx="28" cy="24" r="13" fill="#FFFFFF" stroke="#334155" strokeWidth="3" />
        <circle cx="28" cy="24" r="8" fill="#FCE7F3" />

        {/* Right Ear */}
        <circle cx="72" cy="24" r="13" fill="#FFFFFF" stroke="#334155" strokeWidth="3" />
        <circle cx="72" cy="24" r="8" fill="#FCE7F3" />

        {/* Main Head / Body (Squishy rounded white shape) */}
        <path
          d="M 22 45 C 16 68 28 88 50 88 C 72 88 84 68 78 45 C 75 28 65 24 50 24 C 35 24 25 28 22 45 Z"
          fill="#FFFFFF"
          stroke="#334155"
          strokeWidth="3.2"
          strokeLinejoin="round"
        />

        {/* Eyebrows */}
        {expression === 'thinking' ? (
          <>
            <path d="M 33 42 Q 38 40 42 43" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 58 43 Q 62 40 67 42" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
          </>
        ) : (
          <>
            <path d="M 34 40 Q 38 37 42 39" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
            <path d="M 58 39 Q 62 37 66 40" stroke="#334155" strokeWidth="2.5" strokeLinecap="round" />
          </>
        )}

        {/* Eyes (Large cute sparkling glossy eyes) */}
        {/* Left Eye */}
        <ellipse cx="37" cy="49" rx="4.8" ry="6" fill="#1E293B" />
        <circle cx="35.5" cy="47" r="2.2" fill="#FFFFFF" />
        <circle cx="38.5" cy="51.5" r="1.1" fill="#FFFFFF" />

        {/* Right Eye */}
        <ellipse cx="63" cy="49" rx="4.8" ry="6" fill="#1E293B" />
        <circle cx="61.5" cy="47" r="2.2" fill="#FFFFFF" />
        <circle cx="64.5" cy="51.5" r="1.1" fill="#FFFFFF" />

        {/* Blushing Cheeks (Rosy pink ovals with soft glow) */}
        <ellipse cx="27" cy="57" rx="7" ry="4.5" fill="#FDA4AF" opacity="0.9" />
        <ellipse cx="73" cy="57" rx="7" ry="4.5" fill="#FDA4AF" opacity="0.9" />
        {/* Cheek highlights */}
        <path d="M 25 56 L 27 54" stroke="#FFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
        <path d="M 28 58 L 30 56" stroke="#FFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
        <path d="M 71 56 L 73 54" stroke="#FFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
        <path d="M 74 58 L 76 56" stroke="#FFF" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />

        {/* Nose / Mouth */}
        {expression === 'excited' ? (
          <path
            d="M 45 57 Q 50 64 55 57 Z"
            fill="#FB7185"
            stroke="#334155"
            strokeWidth="2.2"
            strokeLinejoin="round"
          />
        ) : (
          <path
            d="M 44 56 Q 47 59 50 56 Q 53 59 56 56"
            stroke="#334155"
            strokeWidth="2.4"
            strokeLinecap="round"
            fill="none"
          />
        )}

        {/* Little cute paws resting in front */}
        <path
          d="M 37 78 C 37 74 44 74 44 78 Z"
          fill="#FFFFFF"
          stroke="#334155"
          strokeWidth="2.4"
        />
        <path
          d="M 56 78 C 56 74 63 74 63 78 Z"
          fill="#FFFFFF"
          stroke="#334155"
          strokeWidth="2.4"
        />

        {/* Raindrop weather badge hanging on chest */}
        {withBadge && (
          <g transform="translate(44, 76) scale(0.7)">
            <path
              d="M 8 0 C 8 0 0 11 0 16 A 8 8 0 0 0 16 16 C 16 11 8 0 8 0 Z"
              fill="#06B6D4"
              stroke="#0891B2"
              strokeWidth="1.5"
            />
            <circle cx="5" cy="14" r="2" fill="#FFFFFF" opacity="0.8" />
          </g>
        )}
      </svg>

      {/* Online indicator dot */}
      <span className="absolute bottom-0.5 right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white dark:border-slate-900 rounded-full animate-pulse shadow-sm" />
    </div>
  );
}
