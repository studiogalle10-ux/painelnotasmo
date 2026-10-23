import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    // Os testes do Emulator rodam à parte: npm run test:emulador
    include: ['src/**/*.test.ts'],
    exclude: ['src/**/*.emulador.test.ts'],
  },
})
