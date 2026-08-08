import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface UIState {
  locale: 'ru' | 'en'
  theme: 'dark' | 'light'
  sidebarCollapsed: boolean
  rightPanelCollapsed: boolean
  setLocale: (locale: 'ru' | 'en') => void
  setTheme: (theme: 'dark' | 'light') => void
  toggleTheme: () => void
  setSidebarCollapsed: (v: boolean) => void
  setRightPanelCollapsed: (v: boolean) => void
  toggleSidebar: () => void
  toggleRightPanel: () => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      locale: 'ru',
      theme: 'dark',
      sidebarCollapsed: false,
      rightPanelCollapsed: false,

      setLocale: (locale) => set({ locale }),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
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
