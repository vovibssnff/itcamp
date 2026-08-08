import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  locale: 'ru' | 'en'
  sidebarCollapsed: boolean
  rightPanelCollapsed: boolean
  setLocale: (locale: 'ru' | 'en') => void
  setSidebarCollapsed: (v: boolean) => void
  setRightPanelCollapsed: (v: boolean) => void
  toggleSidebar: () => void
  toggleRightPanel: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      locale: 'ru',
      sidebarCollapsed: false,
      rightPanelCollapsed: false,

      setLocale: (locale) => set({ locale }),
      setSidebarCollapsed: (v) => set({ sidebarCollapsed: v }),
      setRightPanelCollapsed: (v) => set({ rightPanelCollapsed: v }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      toggleRightPanel: () => set((s) => ({ rightPanelCollapsed: !s.rightPanelCollapsed })),
    }),
    {
      name: 'ktk-ui',
    },
  ),
)
