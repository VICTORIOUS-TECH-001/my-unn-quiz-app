import React, { useState } from 'react';

interface UNNLogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'banner' | 'shield' | 'header';
  textColor?: string;
  subText?: string;
  className?: string;
}

export const UNNLogo: React.FC<UNNLogoProps> = ({
  size = 'md',
  showText = true,
  variant = 'header',
  textColor,
  subText = 'to restore the dignity of man',
  className = '',
}) => {
  const [imageError, setImageError] = useState(false);

  // Dimension scaling (square 1:1 matching official crest emblem)
  const sizeMap = {
    sm: { height: 36, shieldW: 36, shieldH: 36, title: 'text-sm sm:text-base', motto: 'text-[10px]' },
    md: { height: 48, shieldW: 48, shieldH: 48, title: 'text-lg sm:text-xl', motto: 'text-xs' },
    lg: { height: 64, shieldW: 64, shieldH: 64, title: 'text-2xl', motto: 'text-sm' },
    xl: { height: 88, shieldW: 88, shieldH: 88, title: 'text-3xl', motto: 'text-base' },
  };

  const current = sizeMap[size];

  // The UNN green: #0b6537
  const unnGreen = '#0b6537';
  const defaultTextClass = textColor || 'text-[#0b6537]';

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* 1. Official UNN Crest Logo (From /image folder) */}
      <div
        className="relative shrink-0 flex items-center justify-center rounded-md overflow-hidden bg-white border border-slate-200 shadow-xs"
        style={{ width: current.shieldW, height: current.shieldH }}
        title="University of Nigeria Official Emblem"
      >
        {!imageError ? (
          <img
            src="/image/logo.png"
            alt="University of Nigeria Crest"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.endsWith('/unn_crest.jpg')) {
                target.src = '/unn_crest.jpg';
              } else {
                setImageError(true);
              }
            }}
            className="w-full h-full object-contain"
          />
        ) : (
          /* High-Fidelity SVG of the Official UNN Shield from User Image */
          <svg
            viewBox="0 0 100 120"
            className="w-full h-full drop-shadow-sm"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Outer Shield Outline */}
            <path
              d="M12 12 H88 V70 C88 94 50 114 50 114 C50 114 12 94 12 70 Z"
              fill="#0b6537"
              stroke="#074625"
              strokeWidth="2.5"
            />
            {/* Inner Shield Boundary */}
            <path
              d="M16 16 H84 V68 C84 90 50 108 50 108 C50 108 16 90 16 68 Z"
              fill="#0b6537"
            />
            {/* Middle White Horizontal Band (Green-White-Green Nigerian / UNN stripes) */}
            <rect x="16" y="38" width="68" height="30" fill="#FFFFFF" />

            {/* Shield Border Highlight */}
            <path
              d="M16 16 H84 V68 C84 90 50 108 50 108 C50 108 16 90 16 68 Z"
              stroke="#FFFFFF"
              strokeWidth="2"
              fill="none"
              opacity="0.8"
            />

            {/* Rampant Heraldic Black Lion from UNN Emblem */}
            <g id="unn-lion" fill="#0F172A">
              {/* Lion Head & Open Roaring Jaw */}
              <circle cx="58" cy="28" r="7" />
              <path d="M60 25 L68 28 L60 33 Z" />
              {/* Eye & Ears */}
              <circle cx="56" cy="26" r="1.2" fill="#FFFFFF" />
              <path d="M52 23 L55 20 L57 24 Z" />
              {/* White Dotted Collar around Neck */}
              <path d="M51 32 Q57 35 63 32" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
              <circle cx="53" cy="33" r="0.8" fill="#0F172A" />
              <circle cx="57" cy="34" r="0.8" fill="#0F172A" />
              <circle cx="61" cy="33" r="0.8" fill="#0F172A" />
              {/* Powerful Lion Body */}
              <path d="M47 33 C45 42 43 55 49 68 C53 72 61 74 65 67 C63 56 61 46 54 36 Z" />
              {/* Forelegs Reaching Up/Forward */}
              <path d="M53 37 L41 33 L38 27 M41 33 L35 32" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" />
              <path d="M54 44 L43 45 L38 41 M43 45 L38 48" stroke="#0F172A" strokeWidth="3.5" strokeLinecap="round" />
              {/* Hindlegs Crouched / Stepping */}
              <path d="M50 67 L44 79 L37 83 M44 79 L40 86" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" />
              <path d="M62 67 L63 80 L69 84 M63 80 L65 87" stroke="#0F172A" strokeWidth="4" strokeLinecap="round" />
              {/* Tail Curved Upward with Tufted End */}
              <path
                d="M62 63 C75 58 80 43 73 34 C69 29 65 32 68 37 C71 42 66 48 57 55"
                stroke="#0F172A"
                strokeWidth="2.8"
                fill="none"
                strokeLinecap="round"
              />
              <circle cx="68" cy="32" r="3.5" />
            </g>

            {/* Bottom Curving White Motto Ribbon */}
            <path
              d="M10 102 Q50 94 90 102 L94 114 Q50 105 6 114 Z"
              fill="#FFFFFF"
              stroke="#074625"
              strokeWidth="1.2"
            />
            {/* Motto text: TO RESTORE THE DIGNITY OF MAN */}
            <text
              x="50"
              y="107"
              fontSize="4.5"
              fontFamily="serif"
              fontWeight="bold"
              fill="#0b6537"
              textAnchor="middle"
              letterSpacing="0.4"
            >
              TO RESTORE THE DIGNITY OF MAN
            </text>
          </svg>
        )}
      </div>

      {/* 2. Text Component: Exact match to user image */}
      {showText && (
        <div className="flex flex-col text-left justify-center">
          <span
            className={`font-sans font-black tracking-tight ${current.title} ${defaultTextClass} leading-none`}
            style={{ fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
          >
            University of Nigeria
          </span>
          <span
            className={`font-serif italic font-normal tracking-wide ${current.motto} ${
              textColor ? textColor + ' opacity-90' : 'text-[#0b6537]'
            } mt-0.5 sm:mt-1`}
          >
            {subText}
          </span>
        </div>
      )}
    </div>
  );
};

/**
 * Top full-width official UNN Header Banner (Direct reproduction of the user's uploaded banner)
 */
export const UNNHeaderBanner: React.FC<{
  subTitle?: string;
  className?: string;
}> = ({ subTitle = 'to restore the dignity of man', className = '' }) => {
  return (
    <div className={`w-full bg-white shadow-xs border-b-[6px] border-[#0b6537] ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
        <UNNLogo size="md" subText={subTitle} textColor="text-[#0b6537]" />
        <div className="hidden md:flex flex-col text-right">
          <span className="text-xs font-mono font-bold text-[#0b6537] tracking-wider uppercase">
            FACULTY OF LAW &bull; UNEC
          </span>
          <span className="text-[11px] text-slate-500">
            Student Quiz Competition Portal
          </span>
        </div>
      </div>
    </div>
  );
};
