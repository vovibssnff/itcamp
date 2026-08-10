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

  // ── Equipment icons ──────────────────────────────────────────────────────

  function Label({
    x,
    y,
    children,
    anchor = 'middle',
  }: {
    x: number
    y: number
    children: string
    anchor?: 'start' | 'middle' | 'end' | 'inherit'
  }) {
    return (
      <text
        x={x}
        y={y}
        textAnchor={anchor}
        fontFamily={tk.font.mono}
        fontSize={11}
        fontWeight={500}
        fill={tk.text.secondary}
      >
        {children}
      </text>
    )
  }

  function Readout({ x, y, tags, w = 78 }: { x: number; y: number; tags: string[]; w?: number }) {
    const readings = readingsFor(tags)
    if (readings.length === 0) return null
    return (
      <g>
        {readings.map((r, i) => {
          const ry = y + i * 20
          const color = r.alarmState !== 'normal' ? alarmColor(tk, r.alarmState) : tk.text.primary
          return (
            <g key={r.tag}>
              <rect x={x} y={ry} width={w} height={16} rx={2} fill={tk.readout} />
              <text
                x={x + w / 2}
                y={ry + 11.5}
                textAnchor="middle"
                fontFamily={tk.font.mono}
                fontSize={10}
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

  function Pump({
    id,
    typeId,
    cx,
    cy,
    tag,
    tags = [],
    labelDy = -30,
  }: {
    id: string
    typeId: string
    cx: number
    cy: number
    tag: string
    tags?: string[]
    labelDy?: number
  }) {
    const state = worstOf(readingsFor(tags))
    const stroke = state !== 'normal' ? alarmColor(tk, state) : tk.line
    const r = 20
    return (
      <g
        style={{ cursor: interactive ? 'pointer' : 'default' }}
        onClick={() => handleClick(id, typeId, tag, tags)}
      >
        <circle cx={cx} cy={cy} r={r} fill="url(#eloud-vessel)" stroke={stroke} strokeWidth={1.4} />
        <polygon
          points={`${cx - r * 0.35},${cy - r * 0.45} ${cx - r * 0.35},${cy + r * 0.45} ${cx + r * 0.55},${cy}`}
          fill={stroke}
        />
        <Label x={cx} y={cy + labelDy}>
          {tag}
        </Label>
      </g>
    )
  }

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
    readoutSide?: 'bottom' | 'right'
  }) {
    const readings = readingsFor(tags)
    const state = worstOf(readings)
    const stroke = state !== 'normal' ? alarmColor(tk, state) : tk.line
    const level = readings.find((r) => r.tag.startsWith('LI'))
    const levelFrac = level ? Math.max(0, Math.min(1, level.value / 100)) : undefined
    const fillH = levelFrac !== undefined ? levelFrac * (h - 6) : 0
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
          rx={Math.min(h * 0.28, 20)}
          fill="url(#eloud-vessel)"
          stroke={stroke}
          strokeWidth={1.4}
        />
        {levelFrac !== undefined && (
          <rect
            x={x + 3}
            y={y + h - 3 - fillH}
            width={w - 6}
            height={fillH}
            fill={tk.zone.gdm}
            opacity={0.32}
          />
        )}
        <Label x={x + w / 2} y={y - 8}>
          {tag}
        </Label>
        {readoutSide === 'bottom' ? (
          <Readout x={x + w / 2 - 39} y={y + h + 8} tags={tags} />
        ) : (
          <Readout x={x + w + 8} y={y + h / 2 - 8} tags={tags} />
        )}
      </g>
    )
  }

  function Column({
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
    const level = readings.find((r) => r.tag.startsWith('LI'))
    const levelFrac = level ? Math.max(0, Math.min(1, level.value / 100)) : undefined
    const fillH = levelFrac !== undefined ? levelFrac * Math.min(h * 0.3, 90) : 0
    const trayCount = Math.floor((h - 30) / 22)
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
          rx={10}
          fill="url(#eloud-vessel)"
          stroke={stroke}
          strokeWidth={1.4}
        />
        {levelFrac !== undefined && (
          <rect
            x={x + 3}
            y={y + h - 3 - fillH}
            width={w - 6}
            height={fillH}
            fill={tk.zone.gdm}
            opacity={0.32}
          />
        )}
        {Array.from({ length: trayCount }).map((_, i) => (
          <line
            key={i}
            x1={x + 4}
            x2={x + w - 4}
            y1={y + 16 + i * 22}
            y2={y + 16 + i * 22}
            stroke={tk.lineDim}
            strokeWidth={1}
          />
        ))}
        <Label x={x + w / 2} y={y - 10}>
          {tag}
        </Label>
        <Readout x={x + w + 10} y={y + 20} tags={tags} w={86} />
      </g>
    )
  }

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
    const stroke = state !== 'normal' ? alarmColor(tk, state) : tk.line
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
          rx={4}
          fill="url(#eloud-vessel)"
          stroke={stroke}
          strokeWidth={1.4}
        />
        <Label x={x + w / 2} y={y - 8}>
          {tag}
        </Label>
        <Readout x={x + w / 2 - 39} y={y + h + 8} tags={tags} />
      </g>
    )
  }

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
    const d = h * 0.75
    const cy = y + h / 2
    const c1 = x + w * 0.32
    const c2 = x + w * 0.68
    const diamond = (cx: number) =>
      `${cx},${cy - d / 2} ${cx + d / 2},${cy} ${cx},${cy + d / 2} ${cx - d / 2},${cy}`
    return (
      <g>
        <polygon
          points={diamond(c1)}
          fill="url(#eloud-vessel)"
          stroke={tk.line}
          strokeWidth={1.25}
        />
        <polygon
          points={diamond(c2)}
          fill="url(#eloud-vessel)"
          stroke={tk.line}
          strokeWidth={1.25}
        />
        <Label x={x + w / 2} y={y - 8}>
          {label}
        </Label>
      </g>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'auto', background: tk.bg.canvas }}>
      <svg viewBox="0 0 1520 620" width={1520} height={620} style={{ display: 'block' }}>
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
        </defs>

        {/* Zone panels */}
        <rect x={0} y={0} width={720} height={620} fill={tk.zone.elou} opacity={0.05} />
        <rect
          x={0}
          y={0}
          width={720}
          height={620}
          fill="none"
          stroke={tk.zone.elou}
          strokeOpacity={0.35}
        />
        <rect x={12} y={14} width={7} height={7} fill={tk.zone.elou} />
        <text
          x={26}
          y={23}
          fontFamily={tk.font.mono}
          fontSize={11}
          letterSpacing={1}
          fill={tk.zone.elou}
        >
          ПОДГОТОВКА СЫРЬЯ / ЭЛОУ
        </text>

        <rect x={720} y={0} width={800} height={620} fill={tk.zone.atm} opacity={0.05} />
        <rect
          x={720}
          y={0}
          width={800}
          height={620}
          fill="none"
          stroke={tk.zone.atm}
          strokeOpacity={0.35}
        />
        <rect x={732} y={14} width={7} height={7} fill={tk.zone.atm} />
        <text
          x={746}
          y={23}
          fontFamily={tk.font.mono}
          fontSize={11}
          letterSpacing={1}
          fill={tk.zone.atm}
        >
          АТМОСФЕРНЫЙ БЛОК
        </text>

        {/* ── Резервуарный парк сырой нефти (Раздел 3.1: Р-10, Р-11, Р-12) ── */}
        <g>
          <ellipse
            cx={30}
            cy={272}
            rx={9}
            ry={22}
            fill="url(#eloud-vessel)"
            stroke={tk.line}
            strokeWidth={1.2}
          />
          <rect
            x={30}
            y={250}
            width={40}
            height={44}
            fill="url(#eloud-vessel)"
            stroke={tk.line}
            strokeWidth={1.2}
          />
          <ellipse
            cx={70}
            cy={272}
            rx={9}
            ry={22}
            fill="url(#eloud-vessel)"
            stroke={tk.line}
            strokeWidth={1.2}
          />
          <ellipse
            cx={30}
            cy={330}
            rx={9}
            ry={22}
            fill="url(#eloud-vessel)"
            stroke={tk.line}
            strokeWidth={1.2}
          />
          <rect
            x={30}
            y={308}
            width={40}
            height={44}
            fill="url(#eloud-vessel)"
            stroke={tk.line}
            strokeWidth={1.2}
          />
          <ellipse
            cx={70}
            cy={330}
            rx={9}
            ry={22}
            fill="url(#eloud-vessel)"
            stroke={tk.line}
            strokeWidth={1.2}
          />
          <text
            x={50}
            y={230}
            textAnchor="middle"
            fontFamily={tk.font.mono}
            fontSize={9}
            fill={tk.text.dim}
          >
            Парк тит. 55/5
          </text>
          <text
            x={50}
            y={370}
            textAnchor="middle"
            fontFamily={tk.font.mono}
            fontSize={9}
            fill={tk.text.dim}
          >
            Р-10,11,12
          </text>
          <path
            className={pipeClass}
            d="M 79,272 H 100 V 300 H 142"
            fill="none"
            stroke={tk.line}
            strokeWidth={2}
            markerEnd="url(#eloud-arrow)"
          />
        </g>

        <g transform="translate(120,0)">
          {/* ── Pipes (drawn first so equipment sits on top) ───────────────── */}
          <g fill="none" stroke={tk.line} strokeWidth={2}>
            {/* сырая нефть → Н-1 */}
            <path className={pipeClass} d="M 20,300 H 55" markerEnd="url(#eloud-arrow)" />
            {/* Н-1 → теплообменники */}
            <path className={pipeClass} d="M 90,300 H 150" markerEnd="url(#eloud-arrow)" />
            {/* теплообменники → Э-1,3,5 */}
            <path className={pipeClass} d="M 250,300 H 285" markerEnd="url(#eloud-arrow)" />
            {/* Э-1,3,5 → Э-2,4,6 */}
            <path className={pipeClass} d="M 375,300 H 410" markerEnd="url(#eloud-arrow)" />
            {/* Э-2,4,6 → Е-15 */}
            <path className={pipeClass} d="M 500,300 H 535" markerEnd="url(#eloud-arrow)" />
            {/* Е-15 → Н-20 */}
            <path className={pipeClass} d="M 605,300 H 630" markerEnd="url(#eloud-arrow)" />
            {/* Н-20 → К-1 */}
            <path className={pipeClass} d="M 650,300 H 700" markerEnd="url(#eloud-arrow)" />

            {/* К-1 верх → Е-1 */}
            <path className={pipeClass} d="M 735,150 V 90 H 760" markerEnd="url(#eloud-arrow)" />
            {/* Е-1 → Н-6 */}
            <path className={pipeClass} d="M 860,65 H 900" markerEnd="url(#eloud-arrow)" />
            {/* Н-6 → орошение К-1 (возврат) */}
            <path
              className={pipeClass}
              d="M 922,55 V 30 H 700 V 90"
              markerEnd="url(#eloud-arrow)"
            />
            {/* Е-1 избыток → К-4 (за пределы схемы) */}
            <path className="eloud-pipe" d="M 862,80 H 900" markerEnd="url(#eloud-arrow)" />

            {/* К-1 низ → Н-3 / Н-2 */}
            <path className={pipeClass} d="M 720,450 V 490 H 700" markerEnd="url(#eloud-arrow)" />
            <path className={pipeClass} d="M 720,450 V 490 H 900" markerEnd="url(#eloud-arrow)" />
            {/* Н-3 → П-3 */}
            <path className={pipeClass} d="M 700,510 V 545 H 800" markerEnd="url(#eloud-arrow)" />
            {/* Н-2 → П-1 */}
            <path className={pipeClass} d="M 900,510 V 545 H 1010" markerEnd="url(#eloud-arrow)" />
            {/* П-3 → К-2 */}
            <path className={pipeClass} d="M 845,545 H 1130 V 440" markerEnd="url(#eloud-arrow)" />
            {/* П-1 → К-2 */}
            <path className={pipeClass} d="M 1055,545 H 1170 V 440" markerEnd="url(#eloud-arrow)" />

            {/* К-2 верх → Е-2 */}
            <path className={pipeClass} d="M 1170,120 V 65 H 1200" markerEnd="url(#eloud-arrow)" />
            {/* Е-2 → Н-7 */}
            <path className={pipeClass} d="M 1310,40 H 1340" markerEnd="url(#eloud-arrow)" />
            {/* Н-7 → орошение К-2 (возврат) */}
            <path
              className={pipeClass}
              d="M 1340,60 V 20 H 1130 V 120"
              markerEnd="url(#eloud-arrow)"
            />
            {/* Е-2 избыток → на защелачивание (за пределы схемы) */}
            <path className="eloud-pipe" d="M 1312,55 H 1350" markerEnd="url(#eloud-arrow)" />

            {/* К-2 низ → Н-4/Н-32 → мазут */}
            <path className={pipeClass} d="M 1150,440 V 490 H 1180" markerEnd="url(#eloud-arrow)" />
            <path className="eloud-pipe" d="M 1202,490 H 1340" markerEnd="url(#eloud-arrow)" />
          </g>

          {/* ── Equipment ────────────────────────────────────────────────── */}
          <Pump id="n-h1" typeId="ct-pump" cx={70} cy={300} tag="Н-1" tags={['FI-101']} />
          <HeatExchangerBlock x={150} y={270} w={100} h={60} label="Т-1÷Т-11" />
          <Vessel
            id="n-e135"
            typeId="ct-desalter"
            x={285}
            y={250}
            w={90}
            h={100}
            tag="Э-1,3,5"
            tags={['TI-101']}
          />
          <Vessel
            id="n-e246"
            typeId="ct-desalter"
            x={410}
            y={250}
            w={90}
            h={100}
            tag="Э-2,4,6"
            tags={['PI-101']}
          />
          <Vessel
            id="n-e15"
            typeId="ct-reflux-drum"
            x={535}
            y={250}
            w={70}
            h={100}
            tag="Е-15"
            tags={['LI-115']}
          />
          <Pump id="n-h20" typeId="ct-pump" cx={630} cy={300} tag="Н-20" />

          <Column
            id="n-k1"
            typeId="ct-preflash"
            x={700}
            y={150}
            w={70}
            h={300}
            tag="К-1"
            tags={['LI-101', 'PI-102', 'TI-102']}
          />
          <Vessel
            id="n-e1"
            typeId="ct-reflux-drum"
            x={760}
            y={40}
            w={100}
            h={45}
            tag="Е-1"
            tags={['LI-103']}
            readoutSide="right"
          />
          <Pump id="n-h6" typeId="ct-pump" cx={922} cy={45} tag="Н-6" labelDy={22} />

          <Pump id="n-h3" typeId="ct-pump" cx={680} cy={505} tag="Н-3" labelDy={22} />
          <Furnace
            id="n-p3"
            typeId="ct-pipe-furnace"
            x={805}
            y={510}
            w={80}
            h={70}
            tag="П-3"
            tags={['TI-103']}
          />
          <Pump id="n-h2" typeId="ct-pump" cx={900} cy={505} tag="Н-2" labelDy={22} />
          <Furnace
            id="n-p1"
            typeId="ct-pipe-furnace"
            x={1015}
            y={510}
            w={80}
            h={70}
            tag="П-1"
            tags={['TI-104']}
          />

          <Column
            id="n-k2"
            typeId="ct-atm-column"
            x={1130}
            y={120}
            w={80}
            h={320}
            tag="К-2"
            tags={['LI-102', 'PI-103', 'TI-105', 'TI-106']}
          />
          <Vessel
            id="n-e2"
            typeId="ct-reflux-drum"
            x={1200}
            y={15}
            w={110}
            h={45}
            tag="Е-2"
            tags={['LI-104']}
            readoutSide="right"
          />
          <Pump id="n-h7" typeId="ct-pump" cx={1340} cy={40} tag="Н-7" labelDy={22} />
          <Pump id="n-h4" typeId="ct-pump" cx={1180} cy={505} tag="Н-4,Н-32" labelDy={22} />

          <text x={1345} y={495} fontFamily={tk.font.mono} fontSize={10} fill={tk.text.dim}>
            Мазут
          </text>
          <text x={905} y={78} fontFamily={tk.font.mono} fontSize={9} fill={tk.text.dim}>
            к К-4 (бензин)
          </text>
          <text x={1315} y={53} fontFamily={tk.font.mono} fontSize={9} fill={tk.text.dim}>
            на защелачивание
          </text>
        </g>
      </svg>
    </div>
  )
}
