import type { TagValue } from '@/store/session'

interface TagConfig {
  tag: string
  label: string
  unit: string
  nominal: number
  noise: number
  hlimit: number
  hhlimit: number
  llimit: number
  lllimit: number
}

export const TAG_CONFIG: TagConfig[] = [
  {
    tag: 'TI-201',
    label: 'Темп. входа К-2',
    unit: '°C',
    nominal: 360,
    noise: 2,
    hlimit: 375,
    hhlimit: 385,
    llimit: 340,
    lllimit: 330,
  },
  {
    tag: 'TI-202',
    label: 'Темп. верха К-2',
    unit: '°C',
    nominal: 120,
    noise: 1.5,
    hlimit: 130,
    hhlimit: 140,
    llimit: 110,
    lllimit: 100,
  },
  {
    tag: 'TI-203',
    label: 'Темп. низа К-2',
    unit: '°C',
    nominal: 350,
    noise: 2,
    hlimit: 360,
    hhlimit: 370,
    llimit: 335,
    lllimit: 325,
  },
  {
    tag: 'PI-101',
    label: 'Давление верха К-2',
    unit: 'МПа',
    nominal: 0.15,
    noise: 0.005,
    hlimit: 0.18,
    hhlimit: 0.22,
    llimit: 0.1,
    lllimit: 0.08,
  },
  {
    tag: 'LI-301',
    label: 'Уровень Е-301',
    unit: '%',
    nominal: 50,
    noise: 2,
    hlimit: 75,
    hhlimit: 85,
    llimit: 25,
    lllimit: 15,
  },
  {
    tag: 'FI-101',
    label: 'Расход нефти',
    unit: 'м³/ч',
    nominal: 120,
    noise: 3,
    hlimit: 145,
    hhlimit: 155,
    llimit: 80,
    lllimit: 70,
  },
  {
    tag: 'FI-301',
    label: 'Орошение К-2',
    unit: 'м³/ч',
    nominal: 80,
    noise: 2,
    hlimit: 110,
    hhlimit: 120,
    llimit: 50,
    lllimit: 40,
  },
  {
    tag: 'TI-101',
    label: 'Темп. ЭД-101',
    unit: '°C',
    nominal: 120,
    noise: 1,
    hlimit: 135,
    hhlimit: 145,
    llimit: 100,
    lllimit: 90,
  },
]

const driftState: Record<string, number> = {}

for (const t of TAG_CONFIG) {
  driftState[t.tag] = t.nominal
}

function getAlarmState(value: number, cfg: TagConfig): TagValue['alarmState'] {
  if (value >= cfg.hhlimit || value <= cfg.lllimit) return value >= cfg.hhlimit ? 'HH' : 'LL'
  if (value >= cfg.hlimit || value <= cfg.llimit) return value >= cfg.hlimit ? 'H' : 'L'
  return 'normal'
}

export function generateTelemetryTick(deltaT = 1): TagValue[] {
  const ts = Date.now()
  return TAG_CONFIG.map((cfg) => {
    const prev = driftState[cfg.tag] ?? cfg.nominal
    const drift = (Math.random() - 0.5) * 0.1 * cfg.noise * deltaT
    const reversion = (cfg.nominal - prev) * 0.05 * deltaT
    const noise = (Math.random() - 0.5) * cfg.noise
    const next = prev + drift + reversion + noise
    driftState[cfg.tag] = next
    return {
      tag: cfg.tag,
      value: Math.round(next * 100) / 100,
      unit: cfg.unit,
      alarmState: getAlarmState(next, cfg),
      timestamp: ts,
    }
  })
}

export function resetTelemetry() {
  for (const t of TAG_CONFIG) {
    driftState[t.tag] = t.nominal
  }
}
