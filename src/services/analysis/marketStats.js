// Markt-Statistiken aus den Feldern, die marketMerge.js mitbringt:
// stdev (Streuung der ADP), low/high (Extremwerte), adp (Mittel). Seit dem
// FantasyPros-Import zusaetzlich rank_min/rank_max/rank_std (Streuung im
// Experten-Panel) -- eine zweite, unabhaengige Quelle fuer "wie einig ist
// man sich eigentlich".
import { normalizePos, toFiniteOrNull } from '../../utils/formatting'
import { pickName, SCORING_EXCLUDED_POS } from './draftStats'

// Keine einzelne Position darf die Liste fuellen -- ohne Deckel gewinnt
// strukturell TE (grosse Kluft zwischen Elite- und Streaming-Tier sorgt fuer
// hohe Streuung, unabhaengig davon, ob der Markt sich sonst einig ist).
const DEFAULT_MAX_PER_POS = 3

/**
 * Gemeinsamer Kern fuer marketDisagreement/expertDisagreement: beide messen
 * "Streuung relativ zum eigenen Mittelwert" (Variationskoeffizient) statt
 * absoluter Streuung -- sonst gewinnen automatisch Spaetrunden-Spieler bzw.
 * tief gerankte Spieler, weil dort JEDE Erhebung staerker schwankt, ohne
 * dass echte Uneinigkeit dahintersteckt.
 */
function computeDisagreement(boardPlayers, picks, {
  centerField, stdevField, lowField, highField, limit, maxPerPos,
}) {
  const taken = new Set((picks || []).map(pickName).filter(Boolean))
  const num = toFiniteOrNull

  const usable = (boardPlayers || [])
    // K und DEF fliegen raus, wie schon bei teamDraftRanking: sie haben
    // naturgemaess die groesste Streuung, weil jede Liga sie irgendwann nimmt
    // und der Zeitpunkt beliebig ist. Sie wuerden die Liste fuellen, ohne dass
    // dahinter eine strittige Einschaetzung steckt.
    .filter((bp) => !SCORING_EXCLUDED_POS.has(normalizePos(bp?.pos))
      && num(bp?.[stdevField]) !== null
      && num(bp?.[lowField]) !== null
      && num(bp?.[highField]) !== null
      && num(bp?.[centerField]) > 0
      && bp?.nname && !taken.has(bp.nname))
    .map((bp) => {
      const center = num(bp[centerField])
      const stdev = num(bp[stdevField])
      const lowRaw = num(bp[lowField])
      const highRaw = num(bp[highField])
      return {
        name: bp.name || bp.nname,
        pos: normalizePos(bp.pos),
        // "high" meint je nach Quelle die HOECHSTE Draftposition/den besten
        // Rang, also den kleineren Zahlenwert (Jahmyr Gibbs: high 1, low 3).
        // Beim Lesen nach Groesse sortiert statt an der Quelle zu tauschen,
        // sonst waere die gezeichnete Balkenbreite negativ.
        low: Math.min(lowRaw, highRaw),
        high: Math.max(lowRaw, highRaw),
        avg: center,
        stdev,
        cv: stdev / center,
      }
    })
    .sort((a, b) => b.cv - a.cv)

  const posCount = {}
  const players = []
  for (const p of usable) {
    const count = posCount[p.pos] || 0
    if (count >= maxPerPos) continue
    posCount[p.pos] = count + 1
    players.push(p)
    if (players.length >= limit) break
  }

  const scaleMin = players.length ? Math.min(...players.map((x) => x.low)) : 0
  // Mindestbreite 1, damit die Balkenberechnung nie durch null teilt.
  const scaleMax = players.length
    ? Math.max(Math.max(...players.map((x) => x.high)), scaleMin + 1)
    : 1

  return { players, basis: usable.length, scaleMin, scaleMax }
}

/**
 * Die Spieler, ueber die sich echte Mock-Draft-Teilnehmer (FFC) am wenigsten
 * einig sind -- samt ihrem realistischen Zugriffs-Fenster.
 */
export function marketDisagreement({ boardPlayers = [], picks = [], limit = 6, maxPerPos = DEFAULT_MAX_PER_POS } = {}) {
  // low/high/stdev stammen aus FFC-Drafts (siehe overlayFfcSpread) -- der
  // Bezugswert dazu ist market_adp (dieselbe FFC-Erhebung), nicht adp (die
  // Board-Haupt-ADP aus Sleeper/RotoWire). Fallback auf adp nur, falls
  // market_adp fehlt (aeltere Boards ohne FFC-Overlay). computeDisagreement
  // braucht dafuer einen einzelnen Feldnamen, deshalb hier vorberechnet.
  const withCenter = (boardPlayers || []).map((bp) => ({ ...bp, _adpCenter: bp.market_adp ?? bp.adp }))
  return computeDisagreement(withCenter, picks, {
    centerField: '_adpCenter', stdevField: 'stdev', lowField: 'low', highField: 'high', limit, maxPerPos,
  })
}

/**
 * Die Spieler, bei denen das FantasyPros-Expertenpanel am weitesten
 * auseinanderliegt -- unabhaengig von der Markt-Kachel oben: die misst reale
 * Drafter (FFC-Mock-Drafts), diese misst Analysten-Meinung (rank_min/
 * rank_max/rank_std aus dem FantasyPros-Scrape). Nur befuellt, wenn das Board
 * ueber den FantasyPros-Import entstand -- sonst fehlen die Felder und die
 * Liste bleibt leer.
 */
export function expertDisagreement({ boardPlayers = [], picks = [], limit = 6, maxPerPos = DEFAULT_MAX_PER_POS } = {}) {
  return computeDisagreement(boardPlayers, picks, {
    centerField: 'ecr', stdevField: 'rank_std', lowField: 'rank_min', highField: 'rank_max', limit, maxPerPos,
  })
}
