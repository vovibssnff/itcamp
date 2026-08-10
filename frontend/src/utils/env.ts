/** True when the SPA runs against MSW (Playwright / local mock). */
export function isMockApi(): boolean {
  return import.meta.env.VITE_MOCK_API === 'true'
}
