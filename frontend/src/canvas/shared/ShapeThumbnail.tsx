import type { ComponentType } from '@/mocks/fixtures/components'
import { tokens } from '@/theme/tokens'

/** Tiny SVG thumbnails for palette — same equipment language as Konva widgets. */
export function ShapeThumbnail({
  shape,
  color,
  size = 22,
}: {
  shape: ComponentType['shape'] | string | undefined
  color: string
  size?: number
}) {
  const stroke = color
  const fill = tokens.bg.elevated
  const s = size

  switch (shape) {
    case 'pump':
    case 'compressor':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="9" fill={fill} stroke={stroke} strokeWidth="1.5" />
          {shape === 'compressor' && (
            <circle cx="12" cy="12" r="5" fill="none" stroke={stroke} strokeWidth="1" />
          )}
          <polygon points="8,7 8,17 18,12" fill={stroke} opacity="0.85" />
        </svg>
      )
    case 'column':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
          <rect
            x="6"
            y="2"
            width="12"
            height="20"
            rx="4"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          <line x1="8" y1="8" x2="16" y2="8" stroke={stroke} strokeWidth="1" opacity="0.4" />
          <line x1="8" y1="12" x2="16" y2="12" stroke={stroke} strokeWidth="1" opacity="0.4" />
          <line x1="8" y1="16" x2="16" y2="16" stroke={stroke} strokeWidth="1" opacity="0.4" />
        </svg>
      )
    case 'vessel':
    case 'separator':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
          <rect
            x="4"
            y="4"
            width="16"
            height="16"
            rx={shape === 'separator' ? 8 : 6}
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
          <line
            x1="6"
            y1="14"
            x2="18"
            y2="14"
            stroke={stroke}
            strokeWidth="1"
            strokeDasharray="3 2"
            opacity="0.45"
          />
        </svg>
      )
    case 'heatexchanger':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
          <polygon points="12,3 21,12 12,21 3,12" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <line x1="12" y1="5" x2="12" y2="19" stroke={stroke} strokeWidth="1" opacity="0.4" />
          <line x1="5" y1="12" x2="19" y2="12" stroke={stroke} strokeWidth="1" opacity="0.4" />
        </svg>
      )
    case 'valve':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
          <polygon points="3,4 3,20 12,12" fill={stroke} opacity="0.75" />
          <polygon points="21,4 21,20 12,12" fill={fill} stroke={stroke} strokeWidth="1.2" />
        </svg>
      )
    case 'furnace':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
          <rect
            x="4"
            y="4"
            width="16"
            height="16"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
            strokeDasharray="4 2"
          />
          <polygon points="8,18 12,6 16,18" fill={stroke} opacity="0.5" />
        </svg>
      )
    case 'sensor':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="8" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <line x1="6" y1="12" x2="18" y2="12" stroke={stroke} strokeWidth="1" opacity="0.6" />
          <line x1="12" y1="6" x2="12" y2="18" stroke={stroke} strokeWidth="1" opacity="0.6" />
        </svg>
      )
    case 'controller':
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
          <circle cx="12" cy="12" r="8" fill={fill} stroke={stroke} strokeWidth="1.5" />
          <line x1="5" y1="12" x2="19" y2="12" stroke={stroke} strokeWidth="1.25" />
        </svg>
      )
    default:
      return (
        <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden>
          <rect
            x="4"
            y="4"
            width="16"
            height="16"
            rx="2"
            fill={fill}
            stroke={stroke}
            strokeWidth="1.5"
          />
        </svg>
      )
  }
}
