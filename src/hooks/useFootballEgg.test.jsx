import { renderHook } from '@testing-library/react'
import { fireEvent } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { openFootballEgg } from '../utils/easterEgg.js'
import { useFootballEgg } from './useFootballEgg.js'

vi.mock('../utils/easterEgg.js', async (importOriginal) => {
  const mod = await importOriginal()
  return { ...mod, openFootballEgg: vi.fn() }
})

function typeWord(word, target) {
  for (const ch of word) {
    fireEvent.keyDown(target ?? document.body, { key: ch })
  }
}

describe('useFootballEgg', () => {
  beforeEach(() => vi.clearAllMocks())
  it('öffnet das Easter Egg nach "football"', () => {
    renderHook(() => useFootballEgg())
    typeWord('xxfootball')
    expect(openFootballEgg).toHaveBeenCalledTimes(1)
  })

  it('ignoriert Tasten in Eingabefeldern', () => {
    renderHook(() => useFootballEgg())
    const input = document.createElement('input')
    document.body.appendChild(input)
    typeWord('football', input)
    expect(openFootballEgg).not.toHaveBeenCalled()
    input.remove()
  })

  it('laesst sich erneut ausloesen', () => {
    renderHook(() => useFootballEgg())
    typeWord('football')
    typeWord('football')
    expect(openFootballEgg).toHaveBeenCalledTimes(2)
  })
})
