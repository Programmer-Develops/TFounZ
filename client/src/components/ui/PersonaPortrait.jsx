import React from 'react';

const STYLE_MAP = {
  glam: { bg: '#181410', ring: '#C9A96E', suit: '#262019', skin: '#C89672', hair: '#1E1A18', glasses: true },
  baritone: { bg: '#171214', ring: '#B7895A', suit: '#201D22', skin: '#BE9272', hair: '#C9C6C0', beard: true, glasses: true },
  gamer: { bg: '#161218', ring: '#C86D74', suit: '#1D1D24', skin: '#C79674', hair: '#18181D', headphones: true },
  anime: { bg: '#10161D', ring: '#7CA3B8', suit: '#161C26', skin: '#DFC4B0', hair: '#E9E6E0', shades: true },
  panel: { bg: '#111715', ring: '#7DA88B', suit: '#172026', skin: '#BD8B68', hair: '#1B1B20' },
  studio: { bg: '#15141A', ring: '#A89F91', suit: '#201E28', skin: '#C89C7C', hair: '#201C22' },
};

/**
 * Art-directed minimalist portrait for AI Hosts & AI Guests (no emojis, refined obsidian & champagne aesthetic).
 */
export default function PersonaPortrait({ styleKey = 'glam', size = 48 }) {
  const p = STYLE_MAP[styleKey] || STYLE_MAP.glam;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{
        borderRadius: 8,
        border: `1px solid ${p.ring}55`,
        background: p.bg,
        flexShrink: 0,
        display: 'block',
      }}
      aria-hidden="true"
    >
      <circle cx="32" cy="24" r="22" fill={p.ring} fillOpacity="0.09" />
      {/* Shoulders */}
      <path d="M10 64C12 49 20 44 32 44C44 44 52 49 54 64H10Z" fill={p.suit} />
      <path d="M27 44L32 54L37 44H27Z" fill="#EFECE6" fillOpacity="0.85" />
      <path d="M31 46L33 46L32.6 55L32 57L31.4 55L31 46Z" fill={p.ring} />
      {/* Neck & Head */}
      <rect x="28.5" y="36" width="7" height="10" rx="3" fill={p.skin} />
      <ellipse cx="32" cy="28" rx="11.5" ry="13.5" fill={p.skin} />
      {/* Hair */}
      <path d="M20.5 25C20.5 16 25.5 13 32 13C38.5 13 43.5 16 43.5 25C40 19.5 24 19.5 20.5 25Z" fill={p.hair} />
      {p.beard && <path d="M23.5 33C25 39 28 41.5 32 41.5C36 41.5 39 39 40.5 33C38 35.5 26 35.5 23.5 33Z" fill={p.hair} fillOpacity="0.85" />}
      {/* Eyes / Shades / Glasses */}
      {p.shades ? (
        <>
          <rect x="22.5" y="24" width="8.5" height="5" rx="1.5" fill="#0B0B0D" stroke={p.ring} strokeWidth="1" />
          <rect x="33" y="24" width="8.5" height="5" rx="1.5" fill="#0B0B0D" stroke={p.ring} strokeWidth="1" />
          <line x1="31" y1="26.5" x2="33" y2="26.5" stroke={p.ring} strokeWidth="1" />
        </>
      ) : (
        <>
          <circle cx="27.5" cy="27.5" r="1.4" fill="#141316" />
          <circle cx="36.5" cy="27.5" r="1.4" fill="#141316" />
          {p.glasses && (
            <>
              <rect x="23.5" y="24.5" width="7.5" height="5.5" rx="1.5" stroke={p.ring} strokeWidth="1" />
              <rect x="33" y="24.5" width="7.5" height="5.5" rx="1.5" stroke={p.ring} strokeWidth="1" />
              <line x1="31" y1="27" x2="33" y2="27" stroke={p.ring} strokeWidth="1" />
            </>
          )}
        </>
      )}
      {p.headphones && (
        <>
          <path d="M19.5 28C19.5 19.5 25 13 32 13C39 13 44.5 19.5 44.5 28" stroke={p.ring} strokeWidth="2.2" />
          <rect x="17.5" y="25" width="3.5" height="8" rx="1.5" fill="#1B1B21" stroke={p.ring} strokeWidth="1" />
          <rect x="43" y="25" width="3.5" height="8" rx="1.5" fill="#1B1B21" stroke={p.ring} strokeWidth="1" />
        </>
      )}
      {/* Subtle Smile */}
      <path d="M29 34.5C30.2 35.8 33.8 35.8 35 34.5" stroke="#3B2320" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}
