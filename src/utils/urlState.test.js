import { describe, it, expect } from 'vitest'
import { buildBoardSearch, parseBoardParams } from './urlState'

describe('buildBoardSearch', () => {
  it('serializes an active position and query', () => {
    expect(buildBoardSearch({ positionFilter: 'RB', searchQuery: 'bijan' })).toBe('pos=RB&q=bijan')
  })
  it('omits ALL position and empty query', () => {
    expect(buildBoardSearch({ positionFilter: 'ALL', searchQuery: '' })).toBe('')
  })
  it('includes query even when position is ALL', () => {
    expect(buildBoardSearch({ positionFilter: 'ALL', searchQuery: 'lamb' })).toBe('q=lamb')
  })
})

describe('parseBoardParams', () => {
  it('reads pos and q from a search string', () => {
    expect(parseBoardParams('?pos=WR&q=lamb')).toEqual({ pos: 'WR', q: 'lamb' })
  })
  it('returns nulls for an empty search', () => {
    expect(parseBoardParams('')).toEqual({ pos: null, q: null })
  })
  it('treats ALL as no position filter', () => {
    expect(parseBoardParams('?pos=ALL')).toEqual({ pos: null, q: null })
  })
})
