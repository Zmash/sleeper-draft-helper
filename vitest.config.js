import { defineConfig } from 'vitest/config'
import { configDefaults } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.js'],
    globals: true,
    // .claude/worktrees enthält Arbeitskopien des Repos — ohne diesen
    // Ausschluss läuft die komplette Suite doppelt.
    exclude: [...configDefaults.exclude, '**/.claude/worktrees/**'],
  },
})
