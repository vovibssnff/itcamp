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
      proxy: env.VITE_API_BASE_URL
        ? {
            '/api': {
              target: env.VITE_API_BASE_URL,
              changeOrigin: true,
            },
          }
        : {},
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
      coverage: {
        provider: 'v8',
        reporter: ['text', 'lcov'],
        exclude: [
          'src/api/generated/**',
          'src/mocks/**',
          'e2e/**',
          '**/*.config.*',
          '**/vite-env.d.ts',
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
