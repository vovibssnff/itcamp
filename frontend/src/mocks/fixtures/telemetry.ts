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

// Tag set follows the real ЭЛОУ-АВТ process order (Технологический регламент,
// Раздел 3.2–3.5): сырая нефть → ЭЛОУ → Е-15 → К-1 → печи П-1/П-2/П-3 → К-2.
// Limits are taken from the regulation's stated operating ranges/interlocks
// rather than invented numbers.
export const TAG_CONFIG: TagConfig[] = [
  {
    tag: 'FI-101',
    label: 'Расход сырой нефти',
    unit: 'м³/ч',
    nominal: 400,
    noise: 10,
    hlimit: 500,
    hhlimit: 550,
    llimit: 250,
    lllimit: 150,
  },
  {
    // Регламент п.3.2: «нагревается до температуры не более 140°C».
    tag: 'TI-101',
    label: 'Темп. нефти перед ЭЛОУ',
    unit: '°C',
    nominal: 135,
    noise: 2,
    hlimit: 140,
    hhlimit: 145,
    llimit: 100,
    lllimit: 90,
  },
  {
    // Регламент п.3.3: сигнализация PRA 312 по минимальному давлению после ЭЛОУ.
    tag: 'PI-101',
    label: 'Давление нефти после ЭЛОУ',
    unit: 'кгс/см²',
    nominal: 7,
    noise: 0.3,
    hlimit: 9,
    hhlimit: 10,
    llimit: 5,
    lllimit: 4,
  },
  {
    // Регламент п.3.3: буферная ёмкость обессоленной нефти, уровнемер LRCA 605.
    tag: 'LI-115',
    label: 'Уровень Е-15',
    unit: '%',
    nominal: 50,
    noise: 2,
    hlimit: 75,
    hhlimit: 85,
    llimit: 20,
    lllimit: 15,
  },
  {
    // Регламент п.3.5: колонна К-1, LRCA 602, блокировка запуска Н-3/Н-2 <15%.
    tag: 'LI-101',
    label: 'Уровень К-1',
    unit: '%',
    nominal: 50,
    noise: 2,
    hlimit: 75,
    hhlimit: 85,
    llimit: 20,
    lllimit: 15,
  },
  {
    // Регламент п.3.5: давление К-1 — сигнализация 4,5, блокировка 4,8 кгс/см².
    tag: 'PI-102',
    label: 'Давление К-1',
    unit: 'кгс/см²',
    nominal: 2,
    noise: 0.2,
    hlimit: 4.5,
    hhlimit: 4.8,
    llimit: 1,
    lllimit: 0.5,
  },
  {
    // Регламент п.3.5: температура низа К-1 — не выше 280°C.
    tag: 'TI-102',
    label: 'Темп. низа К-1',
    unit: '°C',
    nominal: 270,
    noise: 3,
    hlimit: 280,
    hhlimit: 290,
    llimit: 240,
    lllimit: 220,
  },
  {
    // Регламент п.3.5: рефлюксная ёмкость Е-1, блокировка останова Н-6 <15%.
    tag: 'LI-103',
    label: 'Уровень Е-1',
    unit: '%',
    nominal: 50,
    noise: 2,
    hlimit: 75,
    hhlimit: 85,
    llimit: 20,
    lllimit: 15,
  },
  {
    // Регламент п.3.5: печь П-3 — температура на выходе не более 340°C.
    tag: 'TI-103',
    label: 'Темп. нефти на выходе П-3',
    unit: '°C',
    nominal: 330,
    noise: 2,
    hlimit: 340,
    hhlimit: 350,
    llimit: 300,
    lllimit: 280,
  },
  {
    // Регламент п.3.5: печь П-1 — температура на выходе не более 365°C.
    tag: 'TI-104',
    label: 'Темп. нефти на выходе П-1',
    unit: '°C',
    nominal: 355,
    noise: 3,
    hlimit: 365,
    hhlimit: 375,
    llimit: 320,
    lllimit: 300,
  },
  {
    // Регламент п.3.5: колонна К-2, LRCA 604, блокировка запуска Н-4/Н-32 <15%.
    tag: 'LI-102',
    label: 'Уровень К-2',
    unit: '%',
    nominal: 50,
    noise: 2,
    hlimit: 75,
    hhlimit: 85,
    llimit: 20,
    lllimit: 15,
  },
  {
    // Регламент п.3.5: давление К-2 — сигнализация 1,0, блокировка 1,5 кгс/см².
    tag: 'PI-103',
    label: 'Давление К-2',
    unit: 'кгс/см²',
    nominal: 0.6,
    noise: 0.05,
    hlimit: 1.0,
    hhlimit: 1.5,
    llimit: 0.2,
    lllimit: 0.1,
  },
  {
    // Регламент п.3.5: температура верха К-2 — до 148°C.
    tag: 'TI-105',
    label: 'Темп. верха К-2',
    unit: '°C',
    nominal: 140,
    noise: 2,
    hlimit: 148,
    hhlimit: 155,
    llimit: 110,
    lllimit: 100,
  },
  {
    // Регламент п.3.5: температура низа К-2 — до 350°C.
    tag: 'TI-106',
    label: 'Темп. низа К-2',
    unit: '°C',
    nominal: 340,
    noise: 3,
    hlimit: 350,
    hhlimit: 360,
    llimit: 300,
    lllimit: 280,
  },
  {
    // Регламент п.3.5: рефлюксная ёмкость Е-2, блокировка останова Н-7 <15%.
    tag: 'LI-104',
    label: 'Уровень Е-2',
    unit: '%',
    nominal: 50,
    noise: 2,
    hlimit: 75,
    hhlimit: 85,
    llimit: 20,
    lllimit: 15,
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
