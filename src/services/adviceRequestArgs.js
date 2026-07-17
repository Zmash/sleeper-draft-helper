// src/services/adviceRequestArgs.js
// Einzige Quelle fuer den Argumente-Block, den buildAIAdviceRequest() (services/ai.js)
// bekommt. BoardSection nutzt diese Funktion an ZWEI Stellen -- der Kostenschaetzung
// am Advice-Button (adviceEstimate) UND dem echten AI-Call (doAskAIWithKey). Vorher
// bauten beide Stellen den Payload getrennt, die Schaetzung mit kleineren Options-
// Defaults (topNOverall=40, topPerPos=10 statt 60/20) und ohne customStrategyText/
// playerPreferences -- die Anzeige unterschaetzte die echten Kosten systematisch.
// Beide Aufrufer MUESSEN durch diese Funktion gehen, damit sie nicht wieder auseinanderlaufen.
export const ADVICE_REQUEST_OPTIONS = {
  topNOverall: 60,
  topPerPos: 20,
  temperature: 0.2,
  favBonus: 6,
  avoidPenalty: 10,
}

export function buildAdviceRequestArgs({
  boardPlayers,
  livePicks,
  meUserId,
  league,
  draft,
  currentPickNumber,
  draftSlot,
  tips,
  scoringType,
  isSuperflex,
  rosterPositions,
  teamsCount,
  draftMode,
  dynastyRoster,
  myDraftPicks,
  customStrategyText,
  playerPreferences,
} = {}) {
  return {
    boardPlayers: boardPlayers || [],
    livePicks: livePicks || [],
    me: meUserId || '',
    league: { ...(league || {}), roster_positions: rosterPositions, total_rosters: teamsCount },
    scoringType,
    isSuperflex,
    rosterPositions,
    draft: draft || null,
    currentPickNumber: Number.isFinite(currentPickNumber) ? currentPickNumber : null,
    customStrategyText: customStrategyText || '',
    playerPreferences: playerPreferences || {},
    draftSlot,
    tips,
    options: ADVICE_REQUEST_OPTIONS,
    draftMode,
    dynastyRoster,
    myDraftPicks,
  }
}
