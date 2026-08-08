export const tokens = {
  bg: {
    base: '#0a0f14',
    surface: '#11181f',
    elevated: '#0d1319',
    overlay: 'rgba(0,0,0,0.6)',
  },
  border: {
    subtle: 'rgba(255,255,255,0.08)',
    medium: 'rgba(255,255,255,0.12)',
    strong: 'rgba(255,255,255,0.15)',
  },
  text: {
    primary: '#e6edf1',
    secondary: '#9aa7ad',
    muted: '#7c8a94',
    dim: '#5a6971',
    inactive: '#4d5a63',
  },
  accent: {
    cyan: '#00e5c7',
    cyanHover: '#5eeadb',
    amber: '#ffb020',
    blue: '#5b8cff',
    red: '#ff4d4d',
    redSoft: '#ff8080',
    redBg: 'rgba(255,77,77,0.08)',
    redBorder: 'rgba(255,77,77,0.3)',
    cyanBg: 'rgba(0,229,199,0.08)',
    cyanBorder: 'rgba(0,229,199,0.3)',
  },
  zone: {
    elou: '#00e5c7',
    atm: '#ffb020',
    gdm: '#5b8cff',
  },
  font: {
    body: "'Inter', sans-serif",
    mono: "'IBM Plex Mono', monospace",
  },
  radius: { sm: '3px', md: '4px', lg: '6px' },
} as const

export type Tokens = typeof tokens
