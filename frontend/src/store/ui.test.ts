import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from './ui'

describe('uiStore', () => {
  beforeEach(() => {
    useUIStore.setState({ locale: 'ru', sidebarCollapsed: false, rightPanelCollapsed: false })
  })

  it('sets locale', () => {
    useUIStore.getState().setLocale('en')
    expect(useUIStore.getState().locale).toBe('en')
  })

  it('toggles sidebar', () => {
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarCollapsed).toBe(true)
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarCollapsed).toBe(false)
  })

  it('toggles right panel', () => {
    useUIStore.getState().toggleRightPanel()
    expect(useUIStore.getState().rightPanelCollapsed).toBe(true)
  })

  it('sets collapse flags directly', () => {
    const s = useUIStore.getState()
    s.setSidebarCollapsed(true)
    s.setRightPanelCollapsed(true)
    const state = useUIStore.getState()
    expect(state.sidebarCollapsed).toBe(true)
    expect(state.rightPanelCollapsed).toBe(true)
  })
})
