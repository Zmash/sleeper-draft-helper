// Draft-ID aus reiner ID oder URL extrahieren
export function parseDraftId(input) {
    if (!input) return ''
    const s = String(input).trim()
    // Beispiel-URL: https://sleeper.com/draft/nfl/1259938279696896000
    const fromUrl = s.match(/\/draft\/[^/]+\/(\d+)/i)
    if (fromUrl) return fromUrl[1]
    // reine Zahl?
    const onlyDigits = s.match(/\d{6,}/)
    return onlyDigits ? onlyDigits[0] : ''
  }
  