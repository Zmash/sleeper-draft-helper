// Pure helpers for syncing board filters with the URL query string.

export function buildBoardSearch({ positionFilter, searchQuery }) {
  const params = new URLSearchParams()
  if (positionFilter && positionFilter !== 'ALL') params.set('pos', positionFilter)
  if (searchQuery) params.set('q', searchQuery)
  return params.toString()
}

export function parseBoardParams(search) {
  const params = new URLSearchParams(search || '')
  const pos = params.get('pos')
  return {
    pos: pos && pos !== 'ALL' ? pos : null,
    q: params.get('q') || null,
  }
}
