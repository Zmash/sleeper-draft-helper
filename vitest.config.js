import { defineConfig } from 'vitest/config'
import { configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Selbes JSX-Runtime wie in vite.config.js — sonst brechen Komponenten,
  // die (korrekt) kein `import React` haben, unter Tests mit "React is not defined".
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    // .claude/worktrees enthält Arbeitskopien des Repos — ohne diesen
    // Ausschluss läuft die komplette Suite doppelt.
    exclude: [...configDefaults.exclude, '**/.claude/worktrees/**'],
  },
})
