/**
 * Hand-drawn mnemonic of the default ЭЛОУ-АВТ installation.
 *
 * Unlike `HmiCanvas` (a generic renderer driven by constructor node/edge
 * data, used for instructor-built templates), this is a hardcoded SVG laid
 * out to match the real process order from the technological regulation
 * (Раздел 3.2–3.5): сырая нефть → теплообменники → ЭЛОУ → Е-15 → К-1 →
 * печи П-1/П-3 → К-2. Equipment clicks open the same Faceplate used
 * elsewhere by constructing a lightweight synthetic CanvasNode, so the
 * reference-card and regulator infrastructure is fully reused, not
 * duplicated.
 *
 * Utility lines (деэмульгатор, щёлочь, пар, топливо, вода, дренаж, сброс
 * газа) are decorative — they follow the labelling used throughout the
 * real P&ID (см. "01_Схема КТС") to make the mnemonic read as a complete
 * process scheme rather than an instrumented subset, but they carry no
 * telemetry of their own.
 */
import type { CanvasNode } from '@/store/constructor'
import type { TagValue } from '@/store/session'
import { useCanvasTokens } from '@/theme/useCanvasTokens'
import type { CanvasTokens } from '@/theme/tokens'

interface EloudAvtSchemeProps {
  telemetry: Record<string, TagValue>
  interactive?: boolean
  flowing?: boolean
  onNodeClick?: (node: CanvasNode) => void
}

// Vessels/columns hold process fluid at standby too — show a nominal level
// so equipment doesn't read as "empty" before live telemetry arrives (WS
// connects only once the operator starts the lesson).
const NOMINAL_LEVEL_FRAC = 0.5

type Severity = TagValue['alarmState']
const SEVERITY_RANK: Record<Severity, number> = { normal: 0, L: 1, H: 1, LL: 2, HH: 3 }

function worstOf(tags: TagValue[]): Severity {
  return tags.reduce<Severity>(
    (acc, t) => (SEVERITY_RANK[t.alarmState] > SEVERITY_RANK[acc] ? t.alarmState : acc),
    'normal',
  )
}

function alarmColor(tk: CanvasTokens, state: Severity): string {
  if (state === 'HH') return tk.alarm
  if (state === 'LL') return tk.zone.k1
  if (state === 'H') return tk.warn
  if (state === 'L') return tk.zone.gdm
  return tk.line
}

function makeNode(id: string, typeId: string, label: string, tags: string[]): CanvasNode {
  return { id, typeId, x: 0, y: 0, label, parameters: {}, tags }
}

export function EloudAvtScheme({
  telemetry,
  interactive = true,
  flowing = false,
  onNodeClick,
}: EloudAvtSchemeProps) {
  const tk = useCanvasTokens()

  function readingsFor(tags: string[]): TagValue[] {
    return tags.map((t) => telemetry[t]).filter((t): t is TagValue => Boolean(t))
  }

  function handleClick(id: string, typeId: string, label: string, tags: string[]) {
    if (!interactive) return
    onNodeClick?.(makeNode(id, typeId, label, tags))
  }

  const pipeClass = flowing ? 'eloud-pipe eloud-pipe-flow' : 'eloud-pipe'
  const flameClass = flowing ? 'eloud-flame' : 'eloud-flame eloud-flame-off'

  // ── Small shared primitives ─────────────────────────────────────────────

  function Label({
    x,
    y,
    children,
    anchor = 'middle',
    size = 11,
    weight = 600,
    color,
  }: {
    x: number
    y: number
    children: string
    anchor?: 'start' | 'middle' | 'end' | 'inherit'
    size?: number
    weight?: number
    color?: string
  }) {
    return (
      <text
        x={x}
        y={y}
        textAnchor={anchor}
        fontFamily={tk.font.mono}
        fontSize={size}
        fontWeight={weight}
        fill={color ?? tk.text.secondary}
      >
        {children}
      </text>
    )
  }

  function Readout({
    x,
    y,
    tags,
    w = 84,
    align = 'left',
  }: {
    x: number
    y: number
    tags: string[]
    w?: number
    align?: 'left' | 'right'
  }) {
    const readings = readingsFor(tags)
    if (readings.length === 0) return null
    const boxX = align === 'right' ? x - w : x
    return (
      <g>
        {readings.map((r, i) => {
          const ry = y + i * 21
          const color = r.alarmState !== 'normal' ? alarmColor(tk, r.alarmState) : tk.text.primary
          return (
            <g key={r.tag}>
              <rect
                x={boxX}
                y={ry}
                width={w}
                height={17}
                rx={3}
                fill={tk.readout}
                stroke={tk.border.subtle}
                strokeWidth={1}
              />
              <text
                x={boxX + 7}
                y={ry + 12}
                fontFamily={tk.font.mono}
                fontSize={8.5}
                fontWeight={600}
                fill={tk.text.dim}
              >
                {r.tag}
              </text>
              <text
                x={boxX + w - 7}
                y={ry + 12}
                textAnchor="end"
                fontFamily={tk.font.mono}
                fontSize={10.5}
                fontWeight={700}
                fill={color}
              >
                {r.value.toFixed(1)} {r.unit}
              </text>
            </g>
          )
        })}
      </g>
    )
  }

  /** Decorative bow-tie valve glyph (matches real P&ID НО/НЗ arrow symbol). Non-interactive. */
  function StaticValve({
    x,
    y,
    rotate = 0,
    closed = false,
  }: {
    x: number
    y: number
    rotate?: number
    closed?: boolean
  }) {
    return (
      <g transform={`translate(${x},${y}) rotate(${rotate})`}>
        <polygon
          points="-11,-8 0,0 -11,8 11,-8 0,0 11,8"
          fill={closed ? tk.bg.elevated : 'url(#eloud-vessel)'}
          stroke={tk.lineDim}
          strokeWidth={1.4}
        />
      </g>
    )
  }

  /** Dashed utility line (деэмульгатор / щёлочь / пар / топливо / вода / дренаж). Decorative only. */
  function UtilityLine({
    d,
    label,
    labelX,
    labelY,
    valve,
    anchor = 'middle',
  }: {
    d: string
    label: string
    labelX: number
    labelY: number
    valve?: { x: number; y: number; rotate?: number }
    anchor?: 'start' | 'middle' | 'end' | 'inherit'
  }) {
    return (
      <g>
        <path
          d={d}
          fill="none"
          stroke={tk.lineDim}
          strokeWidth={1.4}
          strokeDasharray="5 4"
          markerEnd="url(#eloud-arrow-dim)"
        />
        {valve && <StaticValve x={valve.x} y={valve.y} rotate={valve.rotate} />}
        <text
          x={labelX}
          y={labelY}
          textAnchor={anchor}
          fontFamily={tk.font.mono}
          fontSize={8.5}
          letterSpacing={0.4}
          fill={tk.text.dim}
        >
          {label}
        </text>
      </g>
    )
  }

  function Pump({
    id,
    typeId,
    cx,
    cy,
    tag,
    tags = [],
    labelDy = -30,
    flip = false,
  }: {
    id: string
    typeId: string
    cx: number
    cy: number
    tag: string
    tags?: string[]
    labelDy?: number
    flip?: boolean
  }) {
    const state = worstOf(readingsFor(tags))
    const stroke = state !== 'normal' ? alarmColor(tk, state) : tk.line
    const r = 19
    const dir = flip ? -1 : 1
    return (
      <g
        style={{ cursor: interactive ? 'pointer' : 'default' }}
        onClick={() => handleClick(id, typeId, tag, tags)}
      >
        <rect
          x={cx - 7}
          y={cy + r - 2}
          width={14}
          height={6}
          rx={1.5}
          fill={tk.lineDim}
          opacity={0.5}
        />
        <circle cx={cx} cy={cy} r={r} fill="url(#eloud-vessel)" stroke={stroke} strokeWidth={1.6} />
        <polygon
          points={`${cx - dir * r * 0.32},${cy - r * 0.42} ${cx - dir * r * 0.32},${cy + r * 0.42} ${cx + dir * r * 0.5},${cy}`}
          fill={stroke}
        />
        <Label x={cx} y={cy + labelDy} weight={700}>
          {tag}
        </Label>
      </g>
    )
  }

  /** Horizontal capsule vessel — reflux drums Е-1/Е-2/Е-15. */
  function Vessel({
    id,
    typeId,
    x,
    y,
    w,
    h,
    tag,
    tags = [],
    readoutSide = 'bottom',
  }: {
    id: string
    typeId: string
    x: number
    y: number
    w: number
    h: number
    tag: string
    tags?: string[]
    readoutSide?: 'bottom' | 'right' | 'left'
  }) {
    const readings = readingsFor(tags)
    const state = worstOf(readings)
    const stroke = state !== 'normal' ? alarmColor(tk, state) : tk.line
    const level = readings.find((r) => r.tag.startsWith('LI'))
    const hasLevelTag = tags.some((t) => t.startsWith('LI'))
    const levelFrac = level
      ? Math.max(0, Math.min(1, level.value / 100))
      : hasLevelTag
        ? NOMINAL_LEVEL_FRAC
        : undefined
    const fillW = levelFrac !== undefined ? levelFrac * (w - 6) : 0
    const rx = h / 2
    return (
      <g
        style={{ cursor: interactive ? 'pointer' : 'default' }}
        onClick={() => handleClick(id, typeId, tag, tags)}
      >
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={rx}
          fill="url(#eloud-vessel)"
          stroke={stroke}
          strokeWidth={1.6}
        />
        {levelFrac !== undefined && (
          <rect
            x={x + 3}
            y={y + 3}
            width={fillW}
            height={h - 6}
            rx={rx - 3}
            fill={tk.zone.gdm}
            opacity={0.3}
          />
        )}
        <Label x={x + w / 2} y={y - 9}>
          {tag}
        </Label>
        {readoutSide === 'bottom' && <Readout x={x + w / 2 - 42} y={y + h + 10} tags={tags} />}
        {readoutSide === 'right' && <Readout x={x + w + 10} y={y + h / 2 - 9} tags={tags} />}
        {readoutSide === 'left' && (
          <Readout x={x - 10} y={y + h / 2 - 9} tags={tags} align="right" />
        )}
      </g>
    )
  }

  /** Trayed rectification column — К-1/К-2, with tray ladder and a discrete level gauge. */
  function Column({
    id,
    typeId,
    x,
    y,
    w,
    h,
    tag,
    tags = [],
    readoutAlign = 'left',
  }: {
    id: string
    typeId: string
    x: number
    y: number
    w: number
    h: number
    tag: string
    tags?: string[]
    readoutAlign?: 'left' | 'right'
  }) {
    const readings = readingsFor(tags)
    const state = worstOf(readings)
    const stroke = state !== 'normal' ? alarmColor(tk, state) : tk.line
    const level = readings.find((r) => r.tag.startsWith('LI'))
    const hasLevelTag = tags.some((t) => t.startsWith('LI'))
    const levelFrac = level
      ? Math.max(0, Math.min(1, level.value / 100))
      : hasLevelTag
        ? NOMINAL_LEVEL_FRAC
        : undefined
    const trayTop = y + 26
    const trayBottom = y + h - 74
    const trayCount = Math.max(2, Math.floor((trayBottom - trayTop) / 24))
    const gaugeH = 50
    const gaugeY = y + h - gaugeH - 12
    const gaugeFillH = levelFrac !== undefined ? levelFrac * (gaugeH - 6) : 0
    return (
      <g
        style={{ cursor: interactive ? 'pointer' : 'default' }}
        onClick={() => handleClick(id, typeId, tag, tags)}
      >
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={12}
          fill="url(#eloud-vessel)"
          stroke={stroke}
          strokeWidth={1.8}
        />
        {Array.from({ length: trayCount }).map((_, i) => (
          <line
            key={i}
            x1={x + 5}
            x2={x + w - 5}
            y1={trayTop + i * 24}
            y2={trayTop + i * 24}
            stroke={tk.lineDim}
            strokeWidth={1}
          />
        ))}
        {/* Discrete level gauge — clearer than a translucent full-body wash */}
        <rect
          x={x + 8}
          y={gaugeY}
          width={w - 16}
          height={gaugeH}
          rx={4}
          fill={tk.readout}
          stroke={tk.border.medium}
          strokeWidth={1}
        />
        {levelFrac !== undefined && (
          <rect
            x={x + 11}
            y={gaugeY + gaugeH - 3 - gaugeFillH}
            width={w - 22}
            height={gaugeFillH}
            rx={2}
            fill={tk.zone.gdm}
            opacity={0.55}
          />
        )}
        <Label x={x + w / 2} y={y - 12} size={13} weight={700}>
          {tag}
        </Label>
        {readoutAlign === 'left' ? (
          <Readout x={x - 12} y={y + 20} tags={tags} w={92} align="right" />
        ) : (
          <Readout x={x + w + 12} y={y + 20} tags={tags} w={92} />
        )}
      </g>
    )
  }

  /** Tubular furnace with a stack and an animated coil flame. */
  function Furnace({
    id,
    typeId,
    x,
    y,
    w,
    h,
    tag,
    tags = [],
  }: {
    id: string
    typeId: string
    x: number
    y: number
    w: number
    h: number
    tag: string
    tags?: string[]
  }) {
    const readings = readingsFor(tags)
    const state = worstOf(readings)
    const stroke = state !== 'normal' ? alarmColor(tk, state) : tk.warn
    const stackW = w * 0.22
    return (
      <g
        style={{ cursor: interactive ? 'pointer' : 'default' }}
        onClick={() => handleClick(id, typeId, tag, tags)}
      >
        <rect
          x={x + w / 2 - stackW / 2}
          y={y - 20}
          width={stackW}
          height={22}
          fill="url(#eloud-vessel)"
          stroke={tk.lineDim}
          strokeWidth={1.2}
        />
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={6}
          fill="url(#eloud-vessel)"
          stroke={stroke}
          strokeWidth={1.8}
        />
        <path
          className={flameClass}
          d={`M ${x + w * 0.2},${y + h - 12} C ${x + w * 0.14},${y + h * 0.55} ${x + w * 0.32},${y + h * 0.55} ${x + w * 0.28},${y + h * 0.3} C ${x + w * 0.42},${y + h * 0.5} ${x + w * 0.38},${y + h - 10} ${x + w * 0.5},${y + h - 12} C ${x + w * 0.6},${y + h - 30} ${x + w * 0.5},${y + h * 0.4} ${x + w * 0.62},${y + h * 0.22} C ${x + w * 0.7},${y + h * 0.5} ${x + w * 0.86},${y + h * 0.55} ${x + w * 0.78},${y + h - 12} Z`}
          fill={tk.warn}
          opacity={flowing ? 0.85 : 0.18}
        />
        <Label x={x + w / 2} y={y - 26}>
          {tag}
        </Label>
        <Readout x={x + w / 2 - 42} y={y + h + 10} tags={tags} />
      </g>
    )
  }

  /** Twin-diamond shell-and-tube heat-exchanger train — Т-1÷Т-11. */
  function HeatExchangerBlock({
    x,
    y,
    w,
    h,
    label,
  }: {
    x: number
    y: number
    w: number
    h: number
    label: string
  }) {
    const d = h * 0.7
    const cy = y + h / 2
    const c1 = x + w * 0.28
    const c2 = x + w * 0.72
    const diamond = (cx: number) =>
      `${cx},${cy - d / 2} ${cx + d / 2},${cy} ${cx},${cy + d / 2} ${cx - d / 2},${cy}`
    return (
      <g>
        <line
          x1={x}
          y1={cy}
          x2={x + w}
          y2={cy}
          stroke={tk.lineDim}
          strokeWidth={1}
          strokeDasharray="3 3"
        />
        <polygon
          points={diamond(c1)}
          fill="url(#eloud-vessel)"
          stroke={tk.line}
          strokeWidth={1.3}
        />
        <polygon
          points={diamond(c2)}
          fill="url(#eloud-vessel)"
          stroke={tk.line}
          strokeWidth={1.3}
        />
        <Label x={x + w / 2} y={y - 9}>
          {label}
        </Label>
      </g>
    )
  }

  /** Horizontal electrodesalter drum — Э-1,3,5 / Э-2,4,6 (electrostatic field + water wash). */
  function Desalter({
    id,
    typeId,
    x,
    y,
    w,
    h,
    tag,
    tags = [],
  }: {
    id: string
    typeId: string
    x: number
    y: number
    w: number
    h: number
    tag: string
    tags?: string[]
  }) {
    const readings = readingsFor(tags)
    const state = worstOf(readings)
    const stroke = state !== 'normal' ? alarmColor(tk, state) : tk.line
    const rx = h / 2
    const midY = y + h / 2
    return (
      <g
        style={{ cursor: interactive ? 'pointer' : 'default' }}
        onClick={() => handleClick(id, typeId, tag, tags)}
      >
        <rect
          x={x}
          y={y}
          width={w}
          height={h}
          rx={rx}
          fill="url(#eloud-vessel)"
          stroke={stroke}
          strokeWidth={1.6}
        />
        {/* electrode grid */}
        <line
          x1={x + rx * 0.6}
          y1={y + h * 0.32}
          x2={x + w - rx * 0.6}
          y2={y + h * 0.32}
          stroke={tk.lineDim}
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <line
          x1={x + rx * 0.6}
          y1={y + h * 0.68}
          x2={x + w - rx * 0.6}
          y2={y + h * 0.68}
          stroke={tk.lineDim}
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        {/* high-voltage bolt marker */}
        <path
          d={`M ${x + w / 2 - 4},${midY - 12} L ${x + w / 2 + 3},${midY - 2} L ${x + w / 2 - 2},${midY - 2} L ${x + w / 2 + 4},${midY + 12} L ${x + w / 2 - 5},${midY + 1} L ${x + w / 2},${midY + 1} Z`}
          fill={tk.zone.k1}
          opacity={0.85}
        />
        <Label x={x + w / 2} y={y - 9}>
          {tag}
        </Label>
        <text
          x={x + w / 2}
          y={y + h + 16}
          textAnchor="middle"
          fontFamily={tk.font.mono}
          fontSize={8.5}
          fill={tk.text.dim}
        >
          электрообессоливание
        </text>
        <Readout x={x + w / 2 - 42} y={y + h + 24} tags={tags} />
      </g>
    )
  }

  /** Crude-oil tank farm — Р-10,11,12 (Парк тит. 55/5). */
  function TankFarm({ x, y }: { x: number; y: number }) {
    const tankW = 32
    const gap = 10
    const h = 130
    return (
      <g>
        <text
          x={x + (tankW * 3 + gap * 2) / 2}
          y={y - 16}
          textAnchor="middle"
          fontFamily={tk.font.mono}
          fontSize={8.5}
          letterSpacing={0.35}
          fill={tk.text.dim}
        >
          СЫРАЯ НЕФТЬ · ТИТ. 55/5
        </text>
        {[0, 1, 2].map((i) => {
          const tx = x + i * (tankW + gap)
          return (
            <g key={i}>
              <rect
                x={tx}
                y={y + 10}
                width={tankW}
                height={h}
                fill="url(#eloud-vessel)"
                stroke={tk.line}
                strokeWidth={1.2}
              />
              <ellipse
                cx={tx + tankW / 2}
                cy={y + 10}
                rx={tankW / 2}
                ry={7}
                fill="url(#eloud-vessel)"
                stroke={tk.line}
                strokeWidth={1.2}
              />
              <path
                d={`M ${tx + 2},${y} L ${tx + tankW / 2},${y - 12} L ${tx + tankW - 2},${y}`}
                fill="none"
                stroke={tk.line}
                strokeWidth={1.2}
              />
              <line
                x1={tx + tankW / 2}
                y1={y - 12}
                x2={tx + tankW / 2}
                y2={y - 20}
                stroke={tk.lineDim}
                strokeWidth={1}
              />
            </g>
          )
        })}
        <text
          x={x + (tankW * 3 + gap * 2) / 2}
          y={y + h + 34}
          textAnchor="middle"
          fontFamily={tk.font.mono}
          fontSize={9}
          fill={tk.text.dim}
        >
          Р-10, Р-11, Р-12
        </text>
      </g>
    )
  }

  function Legend({ x, y }: { x: number; y: number }) {
    const rows: { color: string; label: string }[] = [
      { color: tk.line, label: 'Норма' },
      { color: tk.warn, label: 'Отклонение (H / L)' },
      { color: tk.alarm, label: 'Авария (HH)' },
      { color: tk.zone.k1, label: 'Авария (LL)' },
    ]
    return (
      <g transform={`translate(${x},${y})`}>
        <rect
          x={0}
          y={0}
          width={196}
          height={rows.length * 18 + 44}
          rx={6}
          fill={tk.bg.elevated}
          stroke={tk.border.subtle}
          strokeWidth={1}
          opacity={0.94}
        />
        <text
          x={12}
          y={18}
          fontFamily={tk.font.mono}
          fontSize={9.5}
          fontWeight={700}
          letterSpacing={0.5}
          fill={tk.text.secondary}
        >
          УСЛОВНЫЕ ОБОЗНАЧЕНИЯ
        </text>
        {rows.map((r, i) => (
          <g key={r.label} transform={`translate(12, ${34 + i * 18})`}>
            <circle cx={5} cy={-4} r={5} fill={r.color} />
            <text x={16} y={0} fontFamily={tk.font.mono} fontSize={9} fill={tk.text.secondary}>
              {r.label}
            </text>
          </g>
        ))}
        <g transform={`translate(12, ${34 + rows.length * 18 + 4})`}>
          <line
            x1={0}
            y1={-4}
            x2={20}
            y2={-4}
            className={pipeClass}
            stroke={tk.line}
            strokeWidth={2}
          />
          <text x={26} y={0} fontFamily={tk.font.mono} fontSize={9} fill={tk.text.secondary}>
            Технологический поток
          </text>
        </g>
      </g>
    )
  }

  // ── Layout ───────────────────────────────────────────────────────────────
  // Absolute SVG coordinates; viewBox is generous so nothing overlaps once
  // both zone panels + all utility branches are drawn in full.

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', background: tk.bg.canvas }}>
      <svg viewBox="0 0 1900 800" width={1900} height={800} style={{ display: 'block' }}>
        <defs>
          <linearGradient id="eloud-vessel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={tk.vesselFrom} />
            <stop offset="1" stopColor={tk.vesselTo} />
          </linearGradient>
          <marker
            id="eloud-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 Z" fill={tk.line} />
          </marker>
          <marker
            id="eloud-arrow-dim"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 Z" fill={tk.lineDim} />
          </marker>
        </defs>

        {/* ── Zone panels ─────────────────────────────────────────────── */}
        <rect x={0} y={0} width={150} height={800} fill={tk.zone.raw} opacity={0.05} />
        <rect
          x={0}
          y={0}
          width={150}
          height={800}
          fill="none"
          stroke={tk.zone.raw}
          strokeOpacity={0.35}
        />
        <rect x={12} y={14} width={7} height={7} fill={tk.zone.raw} />
        <text
          x={26}
          y={23}
          fontFamily={tk.font.mono}
          fontSize={8.5}
          fontWeight={700}
          letterSpacing={0.55}
          fill={tk.zone.raw}
        >
          ПАРК Р-10–12
        </text>

        <rect x={150} y={0} width={1010} height={800} fill={tk.zone.elou} opacity={0.05} />
        <rect
          x={150}
          y={0}
          width={1010}
          height={800}
          fill="none"
          stroke={tk.zone.elou}
          strokeOpacity={0.35}
        />
        <rect x={162} y={14} width={7} height={7} fill={tk.zone.elou} />
        <text
          x={176}
          y={23}
          fontFamily={tk.font.mono}
          fontSize={11}
          letterSpacing={1}
          fill={tk.zone.elou}
        >
          БЛОК ЭЛОУ — ПОДГОТОВКА СЫРЬЯ
        </text>

        <rect x={1160} y={0} width={740} height={800} fill={tk.zone.atm} opacity={0.05} />
        <rect
          x={1160}
          y={0}
          width={740}
          height={800}
          fill="none"
          stroke={tk.zone.atm}
          strokeOpacity={0.35}
        />
        <rect x={1172} y={14} width={7} height={7} fill={tk.zone.atm} />
        <text
          x={1186}
          y={23}
          fontFamily={tk.font.mono}
          fontSize={11}
          letterSpacing={1}
          fill={tk.zone.atm}
        >
          АТМОСФЕРНЫЙ БЛОК
        </text>

        {/* ── Process pipes (drawn first so equipment sits on top) ──────── */}
        <g fill="none" stroke={tk.line} strokeWidth={2.2}>
          {/* парк → Н-1 */}
          <path className={pipeClass} d="M 133,340 H 195" markerEnd="url(#eloud-arrow)" />
          {/* Н-1 → теплообменники */}
          <path className={pipeClass} d="M 214,340 H 250" markerEnd="url(#eloud-arrow)" />
          {/* теплообменники → Э-1,3,5 */}
          <path className={pipeClass} d="M 410,340 H 440" markerEnd="url(#eloud-arrow)" />
          {/* Э-1,3,5 → Э-2,4,6 */}
          <path className={pipeClass} d="M 630,340 H 670" markerEnd="url(#eloud-arrow)" />
          {/* Э-2,4,6 → Е-15 */}
          <path className={pipeClass} d="M 860,340 H 920" markerEnd="url(#eloud-arrow)" />
          {/* Е-15 → Н-20 */}
          <path className={pipeClass} d="M 1050,340 H 1091" markerEnd="url(#eloud-arrow)" />
          {/* Н-20 → К-1 */}
          <path className={pipeClass} d="M 1110,340 H 1180" markerEnd="url(#eloud-arrow)" />

          {/* К-1 верх → Е-1 */}
          <path className={pipeClass} d="M 1250,150 V 85 H 1300" markerEnd="url(#eloud-arrow)" />
          {/* Е-1 → Н-6 */}
          <path className={pipeClass} d="M 1450,85 H 1481" markerEnd="url(#eloud-arrow)" />
          {/* Н-6 → орошение К-1 (возврат) */}
          <path
            className={pipeClass}
            d="M 1500,66 V 25 H 1210 V 150"
            markerEnd="url(#eloud-arrow)"
          />
          {/* Е-1/Н-6 избыток бензина → К-4 (за пределы схемы) */}
          <path className="eloud-pipe" d="M 1500,104 V 130 H 1650" markerEnd="url(#eloud-arrow)" />

          {/* К-1 низ → Н-3 / Н-2 */}
          <path className={pipeClass} d="M 1210,490 V 545 H 1130" markerEnd="url(#eloud-arrow)" />
          <path className={pipeClass} d="M 1250,490 V 545 H 1330" markerEnd="url(#eloud-arrow)" />
          {/* Н-3 → П-3 (циркуляционный контур) */}
          <path className={pipeClass} d="M 1111,590 H 1080" markerEnd="url(#eloud-arrow)" />
          {/* П-3 → возврат в К-1 */}
          <path className={pipeClass} d="M 1020,545 V 250 H 1180" markerEnd="url(#eloud-arrow)" />
          {/* Н-2 → П-1 */}
          <path className={pipeClass} d="M 1349,590 H 1380" markerEnd="url(#eloud-arrow)" />
          {/* П-1 → К-2 */}
          <path className={pipeClass} d="M 1510,545 V 340 H 1560" markerEnd="url(#eloud-arrow)" />

          {/* К-2 верх → Е-2 */}
          <path className={pipeClass} d="M 1630,150 V 85 H 1680" markerEnd="url(#eloud-arrow)" />
          {/* Е-2 → Н-7 */}
          <path className={pipeClass} d="M 1830,85 H 1861" markerEnd="url(#eloud-arrow)" />
          {/* Н-7 → орошение К-2 (возврат) */}
          <path
            className={pipeClass}
            d="M 1880,66 V 25 H 1590 V 150"
            markerEnd="url(#eloud-arrow)"
          />
          {/* Е-2 избыток → на защелачивание (за пределы схемы) */}
          <path className="eloud-pipe" d="M 1880,104 V 130 H 1855" markerEnd="url(#eloud-arrow)" />

          {/* К-2 низ → Н-4/Н-32 → мазут */}
          <path className={pipeClass} d="M 1610,490 V 560 H 1650" markerEnd="url(#eloud-arrow)" />
          <path className="eloud-pipe" d="M 1669,560 H 1820" markerEnd="url(#eloud-arrow)" />
        </g>

        {/* ── Utility lines (декоративные — пар, топливо, вода, дренаж) ── */}
        <UtilityLine
          d="M 425,255 V 330"
          label="ДЕЭМУЛЬГАТОР"
          labelX={425}
          labelY={244}
          valve={{ x: 425, y: 292 }}
        />
        <UtilityLine
          d="M 655,255 V 330"
          label="NaOH · ЩЁЛОЧЬ"
          labelX={655}
          labelY={244}
          valve={{ x: 655, y: 292 }}
        />
        <UtilityLine
          d="M 500,392 V 430"
          label="ВОДА"
          labelX={500}
          labelY={444}
          valve={{ x: 500, y: 411, rotate: 90 }}
        />
        <UtilityLine d="M 600,392 V 430" label="ПОДТОВАРНАЯ ВОДА" labelX={600} labelY={444} />
        <UtilityLine
          d="M 730,392 V 430"
          label="ВОДА"
          labelX={730}
          labelY={444}
          valve={{ x: 730, y: 411, rotate: 90 }}
        />
        <UtilityLine d="M 830,392 V 430" label="ПОДТОВАРНАЯ ВОДА" labelX={830} labelY={444} />

        <UtilityLine
          d="M 1320,85 V 44"
          label="СБРОС ГАЗА"
          labelX={1320}
          labelY={37}
          valve={{ x: 1320, y: 62, rotate: 90 }}
        />
        <UtilityLine
          d="M 1375,115 V 150"
          label="ДРЕНАЖ"
          labelX={1375}
          labelY={162}
          valve={{ x: 1375, y: 133, rotate: 90 }}
        />
        <UtilityLine d="M 1140,455 H 1180" label="ПАР" labelX={1130} labelY={459} anchor="end" />
        <UtilityLine
          d="M 1020,646 V 685"
          label="ТОПЛИВО"
          labelX={1020}
          labelY={698}
          valve={{ x: 1020, y: 665, rotate: 90 }}
        />

        <UtilityLine
          d="M 1700,85 V 44"
          label="СБРОС ГАЗА"
          labelX={1700}
          labelY={37}
          valve={{ x: 1700, y: 62, rotate: 90 }}
        />
        <UtilityLine
          d="M 1755,115 V 150"
          label="ДРЕНАЖ"
          labelX={1755}
          labelY={162}
          valve={{ x: 1755, y: 133, rotate: 90 }}
        />
        <UtilityLine d="M 1540,455 H 1560" label="ПАР" labelX={1530} labelY={459} anchor="end" />
        <UtilityLine
          d="M 1440,646 V 685"
          label="ТОПЛИВО"
          labelX={1440}
          labelY={698}
          valve={{ x: 1440, y: 665, rotate: 90 }}
        />

        {/* ── Equipment ───────────────────────────────────────────────── */}
        <TankFarm x={20} y={250} />

        <Pump id="n-h1" typeId="ct-pump" cx={195} cy={340} tag="Н-1" tags={['FI-101']} />
        <HeatExchangerBlock x={250} y={300} w={160} h={80} label="Т-1÷Т-11" />
        <Desalter
          id="n-e135"
          typeId="ct-desalter"
          x={440}
          y={290}
          w={190}
          h={100}
          tag="Э-1,3,5"
          tags={['TI-101']}
        />
        <Desalter
          id="n-e246"
          typeId="ct-desalter"
          x={670}
          y={290}
          w={190}
          h={100}
          tag="Э-2,4,6"
          tags={['PI-101']}
        />
        <Vessel
          id="n-e15"
          typeId="ct-reflux-drum"
          x={920}
          y={300}
          w={130}
          h={80}
          tag="Е-15"
          tags={['LI-115']}
        />
        <Pump id="n-h20" typeId="ct-pump" cx={1110} cy={340} tag="Н-20" />

        <Column
          id="n-k1"
          typeId="ct-preflash"
          x={1180}
          y={150}
          w={100}
          h={340}
          tag="К-1"
          tags={['LI-101', 'PI-102', 'TI-102']}
          readoutAlign="left"
        />
        <Vessel
          id="n-e1"
          typeId="ct-reflux-drum"
          x={1300}
          y={55}
          w={150}
          h={60}
          tag="Е-1"
          tags={['LI-103']}
          readoutSide="left"
        />
        <Pump id="n-h6" typeId="ct-pump" cx={1500} cy={85} tag="Н-6" labelDy={26} />

        <Pump id="n-h3" typeId="ct-pump" cx={1130} cy={590} tag="Н-3" labelDy={26} flip />
        <Furnace
          id="n-p3"
          typeId="ct-pipe-furnace"
          x={960}
          y={545}
          w={120}
          h={100}
          tag="П-3"
          tags={['TI-103']}
        />
        <Pump id="n-h2" typeId="ct-pump" cx={1330} cy={590} tag="Н-2" labelDy={26} />
        <Furnace
          id="n-p1"
          typeId="ct-pipe-furnace"
          x={1380}
          y={545}
          w={130}
          h={105}
          tag="П-1"
          tags={['TI-104']}
        />

        <Column
          id="n-k2"
          typeId="ct-atm-column"
          x={1560}
          y={150}
          w={100}
          h={340}
          tag="К-2"
          tags={['LI-102', 'PI-103', 'TI-105', 'TI-106']}
          readoutAlign="left"
        />
        <Vessel
          id="n-e2"
          typeId="ct-reflux-drum"
          x={1680}
          y={55}
          w={150}
          h={60}
          tag="Е-2"
          tags={['LI-104']}
          readoutSide="left"
        />
        <Pump id="n-h7" typeId="ct-pump" cx={1861} cy={85} tag="Н-7" labelDy={26} />
        <Pump id="n-h4" typeId="ct-pump" cx={1650} cy={590} tag="Н-4,Н-32" labelDy={26} />

        <text
          x={1825}
          y={550}
          fontFamily={tk.font.mono}
          fontSize={10}
          fontWeight={600}
          fill={tk.text.dim}
        >
          Мазут
        </text>
        <text x={1520} y={128} fontFamily={tk.font.mono} fontSize={9} fill={tk.text.dim}>
          изб. бензина к К-4
        </text>
        <text
          x={1780}
          y={128}
          fontFamily={tk.font.mono}
          fontSize={9}
          fill={tk.text.dim}
          textAnchor="end"
        >
          на защелачивание
        </text>

        <Legend x={1690} y={640} />
      </svg>
    </div>
  )
}
