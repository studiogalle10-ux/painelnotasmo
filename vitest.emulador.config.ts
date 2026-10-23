import { defineConfig } from 'vitest/config'

// Testes contra o Firestore Emulator. Rodar com: npm run test:emulador
export default defineConfig({
  test: {
    include: ['src/**/*.emulador.test.ts'],
    // Um arquivo por vez: todos usam o mesmo banco do Emulator.
    fileParallelism: false,
    testTimeout: 20_000,
    hookTimeout: 30_000,
  },
})
