import react from '@vitejs/plugin-react'
import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react()],
    server: {
      // A blank VITE_PORT or VITE_API_URL must fall back; || treats "" as missing.
      port: Number(env.VITE_PORT) || 5173,
      proxy: {
        '/api': env.VITE_API_URL || 'http://127.0.0.1:3000',
      },
    },
    test: {
      environment: 'jsdom',
    },
  }
})
