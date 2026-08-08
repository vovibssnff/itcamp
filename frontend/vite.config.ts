import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      port: 5173,
      ...(env.VITE_API_BASE_URL
        ? {
            proxy: {
              '/api': {
                target: env.VITE_API_BASE_URL,
                changeOrigin: true,
              },
            },
          }
        : {}),
    },
    build: {
      target: 'es2022',
      sourcemap: true,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom'],
            router: ['react-router'],
            antd: ['antd'],
            konva: ['konva', 'react-konva'],
            uplot: ['uplot'],
            zustand: ['zustand'],
          },
        },
      },
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: ['src/test-setup.ts'],
      // Only run Vitest unit tests; Playwright specs live in e2e/ and use a
      // different runner (their *.spec.ts would otherwise be picked up here).
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        // Scope coverage to the pure-logic modules covered by unit tests
        // (canvas/UI/mocks are exercised by Playwright E2E instead).
        include: [
          'src/utils/**',
          'src/store/**',
          'src/canvas/constructor/UndoManager.ts',
          'src/mocks/fixtures/telemetry.ts',
        ],
        thresholds: {
          lines: 70,
          functions: 70,
          branches: 70,
        },
      },
    },
  }
})
