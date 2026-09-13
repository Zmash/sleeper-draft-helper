import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { THEMES } from './themes'

const css = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../styles/tokens.css'), 'utf8')

// Block eines Themes: vom Selektor bis zur schliessenden Klammer.
function block(id) {
  const start = css.indexOf(`[data-theme='${id}']`)
  const open = css.indexOf('{', start)
  return css.slice(open, css.indexOf('}', open))
}
const val = (b, name) => (b.match(new RegExp(`${name}:\\s*([^;]+);`)) || [])[1]?.trim()

describe('Live-Farbe je Theme', () => {
  it.each(THEMES.map((t) => t.id))('%s definiert --live und --live-on', (id) => {
    const b = block(id)
    expect(val(b, '--live')).toMatch(/^#[0-9a-f]{6}$/i)
    expect(val(b, '--live-on')).toMatch(/^#[0-9a-f]{6}$/i)
  })

  it('Themes mit rotem Akzent bekommen eine abweichende Live-Farbe', () => {
    expect(val(block('broadcast-ferrari'), '--live')).toBe('#fff200')
    expect(val(block('broadcast-ferrari'), '--live-on')).toBe('#111111')
    expect(val(block('broadcast-nike'), '--live')).toBe('#d14900')
  })
})
