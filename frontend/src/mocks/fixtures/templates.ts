import type { CanvasNode, CanvasEdge } from '@/store/constructor'

export interface Template {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  isValid: boolean
}

export const TEMPLATES: Template[] = [
  {
    id: 'tmpl-elou-avt',
    name: 'ЭЛОУ-АВТ демо',
    description: 'Демонстрационный шаблон атмосферного блока установки ЭЛОУ-АВТ',
    createdAt: '2026-01-10T09:00:00Z',
    updatedAt: '2026-01-15T14:30:00Z',
    isValid: true,
    nodes: [
      {
        id: 'n-desalter',
        typeId: 'ct-desalter',
        x: 120,
        y: 200,
        label: 'ЭД-101',
        parameters: { temp: 120, pressure: 1.2, voltage: 25 },
      },
      {
        id: 'n-pump1',
        typeId: 'ct-pump',
        x: 280,
        y: 200,
        label: 'Н-101А',
        parameters: { flow_nominal: 120, head: 80, power: 55 },
      },
      {
        id: 'n-heatex',
        typeId: 'ct-heatexchanger',
        x: 420,
        y: 200,
        label: 'Э-101',
        parameters: { area: 150, u_coeff: 300 },
      },
      {
        id: 'n-furnace',
        typeId: 'ct-pipe-furnace',
        x: 560,
        y: 200,
        label: 'П-1',
        parameters: { temp_out: 360, fuel_flow: 2000 },
      },
      {
        id: 'n-column',
        typeId: 'ct-atm-column',
        x: 700,
        y: 150,
        label: 'К-2',
        parameters: { temp_top: 120, temp_bot: 350, pressure: 0.15, trays: 42, reflux_ratio: 2.5 },
      },
      {
        id: 'n-condenser',
        typeId: 'ct-condenser',
        x: 840,
        y: 100,
        label: 'ХК-301',
        parameters: { temp_out: 40 },
      },
      {
        id: 'n-drum',
        typeId: 'ct-reflux-drum',
        x: 840,
        y: 200,
        label: 'Е-301',
        parameters: { level_sp: 50 },
      },
      {
        id: 'n-trc',
        typeId: 'ct-pid',
        x: 560,
        y: 320,
        label: 'TRC-201',
        parameters: { kp: 2.0, ti: 120, td: 0, sp_default: 360 },
      },
    ],
    edges: [
      {
        id: 'e1',
        sourceNodeId: 'n-desalter',
        sourcePortId: 'out-crude',
        targetNodeId: 'n-pump1',
        targetPortId: 'in',
      },
      {
        id: 'e2',
        sourceNodeId: 'n-pump1',
        sourcePortId: 'out',
        targetNodeId: 'n-heatex',
        targetPortId: 'in-cold',
      },
      {
        id: 'e3',
        sourceNodeId: 'n-heatex',
        sourcePortId: 'out-cold',
        targetNodeId: 'n-furnace',
        targetPortId: 'in-feed',
      },
      {
        id: 'e4',
        sourceNodeId: 'n-furnace',
        sourcePortId: 'out-feed',
        targetNodeId: 'n-column',
        targetPortId: 'in-feed',
      },
      {
        id: 'e5',
        sourceNodeId: 'n-column',
        sourcePortId: 'out-top',
        targetNodeId: 'n-condenser',
        targetPortId: 'in',
      },
      {
        id: 'e6',
        sourceNodeId: 'n-condenser',
        sourcePortId: 'out-liq',
        targetNodeId: 'n-drum',
        targetPortId: 'in',
      },
      {
        id: 'e7',
        sourceNodeId: 'n-drum',
        sourcePortId: 'out-reflux',
        targetNodeId: 'n-column',
        targetPortId: 'in-reflux',
      },
    ],
  },
]
