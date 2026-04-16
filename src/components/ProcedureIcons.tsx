interface IconProps {
  className?: string;
}

export const RetinografiaIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <radialGradient id="retino-pupil" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
      </radialGradient>
    </defs>
    <rect x="6" y="14" width="36" height="24" rx="4" stroke="hsl(var(--primary))" strokeWidth="2" />
    <path d="M18 14L20 10H28L30 14" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="24" cy="26" r="9" stroke="hsl(var(--primary))" strokeWidth="2" />
    <circle cx="24" cy="26" r="6.5" stroke="hsl(var(--accent))" strokeWidth="1" opacity="0.7" />
    <circle cx="24" cy="26" r="4" stroke="hsl(var(--accent))" strokeWidth="1" opacity="0.5" />
    <circle cx="24" cy="26" r="2" fill="url(#retino-pupil)" />
    <circle cx="36" cy="18" r="1.5" fill="hsl(var(--primary))" opacity="0.6" />
  </svg>
);

export const MapeamentoRetinaIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <radialGradient id="mapret-pupil" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.8" />
        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
      </radialGradient>
    </defs>
    <path d="M4 24C4 24 12 12 24 12C36 12 44 24 44 24C44 24 36 36 24 36C12 36 4 24 4 24Z" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="24" cy="24" r="8" stroke="hsl(var(--primary))" strokeWidth="2" />
    <line x1="16" y1="24" x2="32" y2="24" stroke="hsl(var(--accent))" strokeWidth="1" opacity="0.8" />
    <line x1="24" y1="16" x2="24" y2="32" stroke="hsl(var(--accent))" strokeWidth="1" opacity="0.8" />
    <line x1="18" y1="20" x2="30" y2="20" stroke="hsl(var(--accent))" strokeWidth="0.8" opacity="0.5" />
    <line x1="18" y1="28" x2="30" y2="28" stroke="hsl(var(--accent))" strokeWidth="0.8" opacity="0.5" />
    <line x1="20" y1="18" x2="20" y2="30" stroke="hsl(var(--accent))" strokeWidth="0.8" opacity="0.5" />
    <line x1="28" y1="18" x2="28" y2="30" stroke="hsl(var(--accent))" strokeWidth="0.8" opacity="0.5" />
    <circle cx="24" cy="24" r="2.5" fill="url(#mapret-pupil)" />
  </svg>
);

export const TonometriaIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M6 28C6 28 13 20 22 20C31 20 38 28 38 28C38 28 31 36 22 36C13 36 6 28 6 28Z" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="22" cy="28" r="5" stroke="hsl(var(--primary))" strokeWidth="2" />
    <circle cx="22" cy="28" r="2" fill="hsl(var(--primary))" opacity="0.7" />
    <path d="M40 12C40 12 42 8 44 8" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" />
    <path d="M38 10L40 12L42 10" stroke="hsl(var(--accent))" strokeWidth="1.2" strokeLinecap="round" opacity="0.8" />
    <line x1="42" y1="16" x2="44" y2="16" stroke="hsl(var(--primary))" strokeWidth="1.2" opacity="0.6" />
    <line x1="42" y1="20" x2="44" y2="20" stroke="hsl(var(--primary))" strokeWidth="1.2" opacity="0.6" />
    <line x1="42" y1="24" x2="44" y2="24" stroke="hsl(var(--primary))" strokeWidth="1.2" opacity="0.6" />
    <line x1="43" y1="28" x2="43" y2="14" stroke="hsl(var(--accent))" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M41 17L43 14L45 17" stroke="hsl(var(--accent))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const GonioscopiaIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M6 28C6 28 14 18 24 18C34 18 42 28 42 28C42 28 34 38 24 38C14 38 6 28 6 28Z" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="24" cy="28" r="6" stroke="hsl(var(--primary))" strokeWidth="2" />
    <circle cx="24" cy="28" r="2.5" fill="hsl(var(--primary))" opacity="0.6" />
    <path d="M16 10L24 18L32 10Z" stroke="hsl(var(--accent))" strokeWidth="1.5" fill="hsl(var(--accent))" fillOpacity="0.12" strokeLinejoin="round" />
    <line x1="18" y1="14" x2="14" y2="10" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.6" strokeDasharray="2 2" />
    <line x1="30" y1="14" x2="34" y2="10" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.6" strokeDasharray="2 2" />
  </svg>
);

export const BiometriaIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M4 24C4 24 12 14 24 14C36 14 44 24 44 24C44 24 36 34 24 34C12 34 4 24 4 24Z" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="24" cy="24" r="7" stroke="hsl(var(--primary))" strokeWidth="2" />
    <circle cx="24" cy="24" r="2.5" fill="hsl(var(--primary))" opacity="0.6" />
    <path d="M36 18C38 20 38 28 36 30" stroke="hsl(var(--accent))" strokeWidth="1.5" strokeLinecap="round" fill="none" />
    <path d="M39 16C42 19 42 29 39 32" stroke="hsl(var(--accent))" strokeWidth="1.2" strokeLinecap="round" fill="none" opacity="0.7" />
    <path d="M42 14C46 18 46 30 42 34" stroke="hsl(var(--accent))" strokeWidth="1" strokeLinecap="round" fill="none" opacity="0.4" />
    <ellipse cx="8" cy="16" rx="3" ry="1.5" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.7" />
    <line x1="5" y1="16" x2="3" y2="16" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.7" />
    <line x1="11" y1="16" x2="13" y2="16" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.7" />
  </svg>
);

export const CatarataIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M4 24C4 24 12 12 24 12C36 12 44 24 44 24C44 24 36 36 24 36C12 36 4 24 4 24Z" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="24" cy="24" r="9" stroke="hsl(var(--primary))" strokeWidth="2" />
    <ellipse cx="24" cy="24" rx="5" ry="3" stroke="hsl(var(--accent))" strokeWidth="2" />
    <path d="M19 24C17 22 15 22 14 23" stroke="hsl(var(--accent))" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M29 24C31 26 33 26 34 25" stroke="hsl(var(--accent))" strokeWidth="1.2" strokeLinecap="round" />
    <path d="M22 22.5L23 21.5" stroke="white" strokeWidth="1" strokeLinecap="round" opacity="0.7" />
    <circle cx="24" cy="24" r="1.5" fill="hsl(var(--primary))" opacity="0.5" />
  </svg>
);

export const PterigioIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M6 24C6 24 14 14 24 14C34 14 42 24 42 24C42 24 34 34 24 34C14 34 6 24 6 24Z" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="24" cy="24" r="7" stroke="hsl(var(--primary))" strokeWidth="2" />
    <circle cx="24" cy="24" r="2.5" fill="hsl(var(--primary))" opacity="0.6" />
    <path d="M6 24L14 22L18 24L14 26Z" fill="hsl(var(--accent))" fillOpacity="0.2" stroke="hsl(var(--accent))" strokeWidth="1.2" />
    <path d="M10 18L6 14" stroke="hsl(var(--accent))" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M6 14L9 14.5" stroke="hsl(var(--accent))" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M6 14L6.5 17" stroke="hsl(var(--accent))" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const YagLaserIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <radialGradient id="yag-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.35" />
        <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0" />
      </radialGradient>
    </defs>
    <path d="M6 26C6 26 14 16 24 16C34 16 42 26 42 26C42 26 34 36 24 36C14 36 6 26 6 26Z" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinejoin="round" />
    <circle cx="24" cy="26" r="7" stroke="hsl(var(--primary))" strokeWidth="2" />
    <circle cx="24" cy="26" r="2.5" fill="hsl(var(--primary))" opacity="0.5" />
    <line x1="12" y1="6" x2="24" y2="26" stroke="hsl(var(--accent))" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
    <line x1="24" y1="4" x2="24" y2="26" stroke="hsl(var(--accent))" strokeWidth="1.5" strokeLinecap="round" opacity="0.7" />
    <line x1="36" y1="6" x2="24" y2="26" stroke="hsl(var(--accent))" strokeWidth="1.5" strokeLinecap="round" opacity="0.9" />
    <circle cx="24" cy="26" r="4.5" fill="url(#yag-glow)" />
    <circle cx="24" cy="26" r="1.5" fill="hsl(var(--accent))" fillOpacity="0.35" />
  </svg>
);

export const IridotomiaIcon = ({ className }: IconProps) => (
  <svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <defs>
      <radialGradient id="irido-glow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity="0.7" />
        <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.2" />
      </radialGradient>
    </defs>
    <circle cx="24" cy="24" r="14" stroke="hsl(var(--primary))" strokeWidth="2" />
    {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map(angle => (
      <line
        key={angle}
        x1={24 + 6 * Math.cos(angle * Math.PI / 180)}
        y1={24 + 6 * Math.sin(angle * Math.PI / 180)}
        x2={24 + 13 * Math.cos(angle * Math.PI / 180)}
        y2={24 + 13 * Math.sin(angle * Math.PI / 180)}
        stroke="hsl(var(--primary))"
        strokeWidth="0.8"
        opacity="0.45"
      />
    ))}
    <circle cx="24" cy="24" r="5.5" stroke="hsl(var(--primary))" strokeWidth="1.2" />
    <circle cx="24" cy="24" r="3" fill="hsl(var(--primary))" opacity="0.4" />
    <circle cx="35" cy="18" r="2.5" fill="url(#irido-glow)" />
    <circle cx="35" cy="18" r="1.2" fill="hsl(var(--accent))" fillOpacity="0.9" />
    <line x1="42" y1="8" x2="35" y2="18" stroke="hsl(var(--accent))" strokeWidth="1.5" strokeLinecap="round" opacity="0.8" />
    <line x1="44" y1="14" x2="35" y2="18" stroke="hsl(var(--accent))" strokeWidth="1" strokeLinecap="round" opacity="0.6" />
  </svg>
);
