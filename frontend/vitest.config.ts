import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'vite/**/*.test.ts'],
    restoreMocks: true,
    passWithNoTests: true,
    // npm run test:coverage 때만 켜진다. lcov는 SonarQube가 읽는다(sonar-project.properties)
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'lcov'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/**/__tests__/**', 'src/test/**'],
    },
  },
});
