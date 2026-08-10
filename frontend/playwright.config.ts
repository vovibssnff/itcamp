import { defineConfig, devices } from '@playwright/test'

const live = !!process.env.E2E_LIVE

export default defineConfig({
  testDir: './e2e',
  fullyParallel: !live,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: live ? 1 : process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }]],
  use: {
    baseURL: live ? 'http://localhost:8090' : 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    colorScheme: 'dark',
  },
  projects: live
    ? [
        {
          name: 'live',
          testMatch: '**/live/**/*.spec.ts',
          timeout: 120_000,
          use: {
            ...devices['Desktop Chrome'],
            baseURL: 'http://localhost:8090',
            ...(process.env.PLAYWRIGHT_CHANNEL
              ? { channel: process.env.PLAYWRIGHT_CHANNEL as 'chrome' }
              : {}),
          },
        },
      ]
    : [
        {
          name: 'chromium',
          testIgnore: '**/live/**',
          use: {
            ...devices['Desktop Chrome'],
            ...(process.env.PLAYWRIGHT_CHANNEL
              ? { channel: process.env.PLAYWRIGHT_CHANNEL as 'chrome' }
              : {}),
          },
        },
      ],
  ...(live
    ? {}
    : {
        webServer: {
          command: 'VITE_MOCK_API=true VITE_API_BASE_URL= npm run dev -- --port 5173',
          url: 'http://localhost:5173',
          reuseExistingServer: !process.env.CI,
          timeout: 60000,
        },
      }),
})
