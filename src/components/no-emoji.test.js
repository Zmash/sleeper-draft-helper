import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

// Pictographic emoji + dingbats + variation selectors. Typographic arrows
// (U+2190–U+21FF, e.g. → ↗ ⇄) are allowed as text and intentionally excluded.
const EMOJI = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u

function jsxFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? jsxFiles(join(dir, e.name))
      : e.name.endsWith('.jsx')
      ? [join(dir, e.name)]
      : []
  )
}

describe('no emoji icons in UI source', () => {
  for (const f of [...jsxFiles('src/components'), ...jsxFiles('src/pages')]) {
    it(`has no emoji: ${f}`, () => {
      expect(EMOJI.test(readFileSync(f, 'utf8'))).toBe(false)
    })
  }
})
