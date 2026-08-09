/**
 * Design tokens — CSS-var references for HTML elements, concrete hex for Konva canvas.
 *
 * CSS vars are defined in global.css (:root / html[data-theme="light"]).
 * These var() strings work in HTML inline styles and CSS-in-JS; Konva needs
 * concrete hex, so use `canvasTokens` for anything drawn with react-konva.
 */

export const tokens = {
  bg: {
    base: 'var(--ink)',
    surface: 'var(--srf)',
    elevated: 'var(--srf2)',
    surface3: 'var(--srf3)',
    overlay: 'rgba(4,5,6,.74)',
  },
  border: {
    subtle: 'var(--ln)',
    medium: 'var(--ln2)',
    strong: 'rgba(255,255,255,.22)',
  },
  text: {
    primary: 'var(--tx)',
    secondary: 'var(--tx2)',
    muted: 'var(--tx3)',
    dim: 'var(--tx4)',
    inactive: 'var(--tx4)',
  },
  accent: {
    cyan: 'var(--acc)',
    cyanHover: 'var(--acc-hi)',
    cyanInk: 'var(--acc-ink)',
    cyanDim: 'var(--acc-dim)',
    cyanTxt: 'var(--acc-txt)',
    amber: 'var(--warn)',
    blue: '#7e9cd8',
    red: 'var(--alarm)',
    redSoft: '#ff8a8a',
    redBg: 'rgba(255,74,74,.07)',
    redBorder: 'rgba(255,74,74,.28)',
    cyanBg: 'var(--acc-dim)',
    cyanBorder: 'color-mix(in srgb,var(--acc) 24%,transparent)',
    ok: 'var(--ok)',
  },
  /** Zone colors — CSS var aliases */
  zone: {
    elou: 'var(--acc)',
    atm: 'var(--warn)',
    gdm: '#7e9cd8',
  },
  font: {
    body: "var(--ui, 'Golos Text', 'Inter', sans-serif)",
    mono: "var(--mono, 'JetBrains Mono', 'IBM Plex Mono', monospace)",
  },
  radius: { sm: 'var(--r)', md: 'var(--r)', lg: 'var(--r)' },
} as const

export type Tokens = typeof tokens

/**
 * Concrete hex values for the Konva canvas. Konva cannot read CSS variables,
 * so we keep explicit palettes per theme and resolve them at render time via
 * `useCanvasTokens()` (or `getCanvasTokens(theme)` outside React).
 * Reference: ktk.html zone colors for the industrial HMI.
 */
export interface CanvasTokens {
  bg: {
    base: string
    surface: string
    elevated: string
    canvas: string
  }
  zone: {
    elou: string
    atm: string
    gdm: string
    k1: string
    stab: string
    benz: string
    raw: string
  }
  alarm: string
  warn: string
  ok: string
  accent: string
  text: {
    primary: string
    secondary: string
    muted: string
    dim: string
  }
  border: {
    subtle: string
    medium: string
  }
  gridDot: string
  selTint: string
  font: {
    mono: string
  }
  readout: string
  valveOpen: string
  valveClosed: string
}

export const canvasTokensDark: CanvasTokens = {
  bg: {
    base: '#0b0c0d',
    surface: '#111315',
    elevated: '#17191c',
    canvas: '#0e1012',
  },
  zone: {
    elou: '#e9ff57',
    atm: '#e0a458',
    gdm: '#7e9cd8',
    k1: '#a395d6',
    stab: '#d98bae',
    benz: '#86c98b',
    raw: '#8a9096',
  },
  alarm: '#ff4a4a',
  warn: '#e0a458',
  ok: '#7fd18f',
  accent: '#e9ff57',
  text: {
    primary: '#ecedee',
    secondary: '#9ba1a7',
    muted: '#6a7076',
    dim: '#484e54',
  },
  border: {
    subtle: 'rgba(255,255,255,0.07)',
    medium: 'rgba(255,255,255,0.14)',
  },
  gridDot: 'rgba(255,255,255,0.07)',
  selTint: 'rgba(233,255,87,0.05)',
  font: {
    mono: "'JetBrains Mono', 'IBM Plex Mono', monospace",
  },
  readout: '#08090a',
  valveOpen: '#7fd18f',
  valveClosed: '#ff4a4a',
}

/** Light-theme mirror of the canvas palette (derived from html[data-theme="light"]). */
export const canvasTokensLight: CanvasTokens = {
  bg: {
    base: '#f2f2f0',
    surface: '#ffffff',
    elevated: '#f6f6f4',
    canvas: '#f7f7f5',
  },
  zone: {
    elou: '#8faf6e',
    atm: '#c78a3e',
    gdm: '#5f79b0',
    k1: '#7a6cb8',
    stab: '#bd6a91',
    benz: '#5fa267',
    raw: '#6a7076',
  },
  alarm: '#d23b3b',
  warn: '#c78a3e',
  ok: '#4f9e63',
  accent: '#8faf6e',
  text: {
    primary: '#101214',
    secondary: '#585e64',
    muted: '#82878d',
    dim: '#afb4b9',
  },
  border: {
    subtle: 'rgba(10,12,13,0.09)',
    medium: 'rgba(10,12,13,0.17)',
  },
  gridDot: 'rgba(10,12,13,0.10)',
  selTint: 'rgba(143,175,110,0.14)',
  font: {
    mono: "'JetBrains Mono', 'IBM Plex Mono', monospace",
  },
  readout: '#eef0ee',
  valveOpen: '#4f9e63',
  valveClosed: '#d23b3b',
}

/** Resolve the canvas palette for a given theme (use outside React). */
export function getCanvasTokens(theme: 'dark' | 'light'): CanvasTokens {
  return theme === 'light' ? canvasTokensLight : canvasTokensDark
}

/**
 * Backwards-compatible default export (dark palette). Prefer `useCanvasTokens()`
 * in components so the canvas follows the active theme.
 */
export const canvasTokens = canvasTokensDark
