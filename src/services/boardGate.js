// Reine Gate-Bedingung fuer den AI-Advice-Button: direkt nach einem Draft-Wechsel
// sind livePicks kurz leer, obwohl der Draft laeuft ("drafting") -- ein AI-Call in
// diesem Fenster saehe faelschlich einen leeren Draft. Vor Draft-Start (pre_draft)
// ist ein leeres livePicks hingegen der Normalfall und der Button bleibt aktiv.
export function isAdviceButtonDisabled({ draft, livePicks } = {}) {
  return draft?.status === 'drafting' && !(livePicks?.length)
}
