import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Icon from './Icon'
import { cx } from '../utils/formatting'
import { useUIStore } from '../stores/useUIStore'
import { useSessionStore } from '../stores/useSessionStore'
import { useLiveStore } from '../stores/useLiveStore'
import { useBoardStore } from '../stores/useBoardStore'
import { THEMES } from '../theme/themes'
import { groupDrafts, draftLabel, draftSubtitle } from '../services/draftGroups'
import '../styles/newshell.css'

// Cmd auf Apple, Strg ueberall sonst. Das Zeichen ⌘ ist auf Windows/Linux
// schlicht falsch und wird dort auch nicht verstanden.
export const IS_APPLE =
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad|iPod/i.test(navigator.userAgentData?.platform || navigator.platform || navigator.userAgent)
export const MOD_K = IS_APPLE ? '⌘K' : 'Strg+K'

const RAIL = [
  { icon: 'home', tip: 'Dashboard', path: '/dashboard' },
  { icon: 'board', tip: 'Board', path: '/board' },
  { icon: 'swap', tip: 'Trade', path: '/trade' },
  { icon: 'chart', tip: 'Roster & Analyse', path: '/roster' },
]

export default function NextShell({ children, pageProps = {} }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const setShellVersion = useUIStore((s) => s.setShellVersion)
  const themeId = useUIStore((s) => s.themeId)
  const setTheme = useUIStore((s) => s.setTheme)
  const boardDensity = useUIStore((s) => s.boardDensity)
  const setBoardDensity = useUIStore((s) => s.setBoardDensity)

  const {
    selectedDraftId, selectedLeagueId, availableLeagues, availableDrafts, cardNicknames,
    setSelectedDraftId, setSelectedLeagueId,
  } = useSessionStore()
  const [switcherOpen, setSwitcherOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const {
    livePicks, lastSyncAt, picksLoading, autoRefreshEnabled, refreshIntervalSeconds,
    loadPicks, setAutoRefreshEnabled,
  } = useLiveStore()
  const { boardPlayers, rankingSource, marketMeta, draftMode } = useBoardStore()

  const [cmdOpen, setCmdOpen] = useState(false)
  const [tipsOpen, setTipsOpen] = useState(false)

  const { selectedLeague, selectedDraft, teamsCount, draftSlot, tips } = pageProps
  const tipList = Array.isArray(tips) ? tips : []

  const completed = livePicks?.length || 0
  const teams = Number(teamsCount) || Number(selectedDraft?.settings?.teams) || 12
  const rounds = Number(selectedDraft?.settings?.rounds) || 0
  const upcoming = completed + 1
  const round = Math.floor((upcoming - 1) / teams) + 1
  const posInRound = ((upcoming - 1) % teams) + 1
  const onClockLabel = selectedDraft ? `${round}.${String(posInRound).padStart(2, '0')}` : '—'

  // Bis zum naechsten eigenen Pick: gleiche Snake-Rechnung wie derive.js,
  // hier nur fuer die Statusleiste.
  const untilMine = useMemo(() => {
    if (!draftSlot || !selectedDraft) return null
    for (let p = upcoming; p <= upcoming + teams * 2; p++) {
      const r = Math.floor((p - 1) / teams) + 1
      const inR = ((p - 1) % teams) + 1
      const slot = r % 2 === 1 ? inR : teams - inR + 1
      if (slot === draftSlot) return p - upcoming
    }
    return null
  }, [upcoming, teams, draftSlot, selectedDraft])

  function sync() { if (selectedDraftId) loadPicks(selectedDraftId).catch(() => {}) }
  function backToClassic() { setShellVersion('classic'); navigate('/dashboard') }

  const commands = useMemo(() => [
    { group: 'Draft', label: 'Picks jetzt synchronisieren', keys: 'R', run: sync },
    { group: 'Draft', label: `Auto-Sync ${autoRefreshEnabled ? 'ausschalten' : 'einschalten'}`, run: () => setAutoRefreshEnabled(!autoRefreshEnabled) },
    { group: 'Draft', label: 'Draft in Sleeper öffnen', run: () => selectedDraftId && window.open(`https://sleeper.com/draft/nfl/${selectedDraftId}`, '_blank', 'noreferrer') },
    { group: 'Board', label: `Zeilenhöhe: ${boardDensity === 'compact' ? 'normal' : 'kompakt'}`, run: () => setBoardDensity(boardDensity === 'compact' ? 'normal' : 'compact') },
    { group: 'Board', label: 'Ranking importieren / Setup öffnen', run: () => navigate('/setup', { state: { mode: 'edit' } }) },
    ...(pageProps.draftFinished ? [{ group: 'AI', label: 'AI-Draft-Review öffnen', run: () => pageProps.onOpenDraftReview?.() }] : []),
    { group: 'Gehe zu', label: 'Board', keys: 'G B', run: () => navigate('/board') },
    { group: 'Gehe zu', label: 'Dashboard', keys: 'G D', run: () => navigate('/dashboard') },
    { group: 'Gehe zu', label: 'Roster & Analyse', keys: 'G R', run: () => navigate('/roster') },
    { group: 'Gehe zu', label: 'Trade-Analyse', keys: 'G T', run: () => navigate('/trade') },
    { group: 'Gehe zu', label: 'Liga/Mock-Setup', run: () => navigate('/setup', { state: { mode: 'edit' } }) },
    { group: 'Gehe zu', label: 'Profile verwalten', run: () => navigate('/profiles') },
    { group: 'Ansicht', label: 'Tipps ein/aus', keys: 'T', run: () => setTipsOpen((v) => !v) },
    { group: 'Ansicht', label: 'Theme wählen', run: () => setThemeOpen(true) },
    { group: 'Ansicht', label: 'Zurück zum alten Design', run: backToClassic },
  ], [autoRefreshEnabled, boardDensity, selectedDraftId, themeId, pageProps.onOpenDraftReview]) // eslint-disable-line

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setCmdOpen((v) => !v); return }
      if (cmdOpen) return
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return
      const k = e.key.toLowerCase()
      if (k === 't') { setTipsOpen((v) => !v); return }
      if (k === 'r') { sync(); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cmdOpen, selectedDraftId]) // eslint-disable-line

  const nick = cardNicknames?.[selectedLeague?.league_id] || cardNicknames?.[selectedDraftId]
  const leagueName = nick || selectedLeague?.name || (selectedDraft ? 'Mock Draft' : 'Kein Draft')
  const draftName = selectedDraft
    ? `${selectedDraft.metadata?.name || (draftMode === 'rookie' ? 'Rookie Draft' : 'Draft')} ${selectedDraft.season || ''}`.trim()
    : '—'
  const live = !!selectedDraft && !pageProps.draftFinished

  return (
    <div className="ns-root">
      <nav className="ns-rail" aria-label="Bereiche">
        {RAIL.map((r) => (
          <button
            key={r.path}
            className={cx('ns-rail-btn', pathname === r.path && 'is-active')}
            data-tip={r.tip}
            aria-label={r.tip}
            onClick={() => navigate(r.path)}
          >
            <Icon name={r.icon} size={17} />
          </button>
        ))}
        <div className="ns-rail-spacer" />
        {/* Ein Review ergibt erst Sinn, wenn der Draft durch ist — vorher
            waere es eine Bewertung halber Kader. */}
        <button
          className="ns-rail-btn"
          data-tip={pageProps.draftFinished ? 'AI-Draft-Review' : 'AI-Draft-Review (erst nach Draft-Ende)'}
          aria-label="AI-Draft-Review"
          disabled={!pageProps.draftFinished}
          onClick={() => pageProps.onOpenDraftReview?.()}
        >
          <Icon name="bot" size={17} />
        </button>
        <div className="ns-rail-menuhost">
          <button
            className={cx('ns-rail-btn', themeOpen && 'is-active')}
            data-tip="Theme wählen"
            aria-label="Theme wählen"
            aria-expanded={themeOpen}
            onClick={() => setThemeOpen((v) => !v)}
          >
            <Icon name="palette" size={17} />
          </button>
          {themeOpen && (
            <ThemeMenu themeId={themeId} onPick={(id) => { setTheme(id); setThemeOpen(false) }} onClose={() => setThemeOpen(false)} />
          )}
        </div>
        <button
          className={cx('ns-rail-btn', (pathname === '/setup' || pathname === '/profiles') && 'is-active')}
          data-tip="Setup & Profile"
          aria-label="Setup und Profile"
          onClick={() => navigate('/setup', { state: { mode: 'edit' } })}
        >
          <Icon name="settings" size={17} />
        </button>
      </nav>

      <div className="ns-work">
        <header className="ns-context">
          <div className="ns-crumb-host">
            <button
              className="ns-crumb ns-crumb-btn"
              onClick={() => setSwitcherOpen((v) => !v)}
              aria-expanded={switcherOpen}
              title="Draft wechseln"
            >
              <span>{leagueName}</span>
              <span className="ns-crumb-sep">/</span>
              <b>{draftName}</b>
              <Icon name={switcherOpen ? 'chevron-up' : 'chevron-down'} size={13} />
            </button>
            {switcherOpen && (
              <DraftSwitcher
                drafts={availableDrafts}
                leagues={availableLeagues}
                selectedDraftId={selectedDraftId}
                nicknames={cardNicknames}
                onPick={(d) => {
                  // Der Draft bestimmt die Liga mit: ein Mock hat league_id null,
                  // sonst bliebe die zuletzt gewaehlte Liga faelschlich stehen.
                  setSelectedLeagueId(d.league_id ? String(d.league_id) : null)
                  setSelectedDraftId(String(d.draft_id))
                  setSwitcherOpen(false)
                }}
                onClose={() => setSwitcherOpen(false)}
              />
            )}
          </div>
          {live && <span className="ns-pill ns-pill--live"><span className="ns-dot" />Live</span>}
          {selectedDraft && (
            <span className="ns-pill">
              {teams} Teams
              {pageProps.isSuperflex ? ' · SF' : ''}
              {pageProps.effScoringType ? ` · ${String(pageProps.effScoringType).toUpperCase()}` : ''}
            </span>
          )}
          <div className="ns-ctx-spacer" />
          <button className="ns-kbar" onClick={() => setCmdOpen(true)}>
            <Icon name="search" size={13} />
            <span>Suchen oder Befehl …</span>
            <span className="ns-ctx-spacer" />
            <kbd className="ns-kbd">{MOD_K}</kbd>
          </button>
          <button
            className="ns-icon-btn"
            title="Ranking importieren"
            aria-label="Ranking importieren"
            onClick={() => navigate('/setup', { state: { mode: 'edit' } })}
          >
            <Icon name="upload" size={15} />
          </button>
          <button
            className="ns-icon-btn"
            title="Picks synchronisieren (R)"
            aria-label="Picks synchronisieren"
            onClick={sync}
            disabled={!selectedDraftId}
          >
            <Icon name="refresh" size={15} className={picksLoading ? 'ns-spin' : undefined} />
          </button>
          {selectedDraftId && (
            <a
              className="ns-icon-btn"
              href={`https://sleeper.com/draft/nfl/${selectedDraftId}`}
              target="_blank"
              rel="noreferrer"
              title="Draft in Sleeper öffnen"
              aria-label="Draft in Sleeper öffnen"
            >
              <span className="ns-brandico ns-brandico--sleeper" />
            </a>
          )}
          <button className="ns-icon-btn" onClick={backToClassic} title="Zurück zum alten Design" aria-label="Zurück zum alten Design">
            <Icon name="shuffle" size={15} />
          </button>
        </header>

        <div className="ns-content">{children}</div>
      </div>

      {/* Statusleiste im Stil einer IDE: kurze Segmente, Details im Tooltip.
          Waehrend eines Drafts zaehlen nur zwei Zahlen — wo stehen wir, und
          wann bin ich dran. Alles andere ist Nachschlagewerk. */}
      <footer className="ns-status">
        {selectedDraft ? (
          <>
            <span className="ns-st" title={`Runde ${round} von ${rounds || '?'} · Pick ${upcoming}`}>
              <b>{onClockLabel}</b>
              <span className="ns-st-dim">#{upcoming}</span>
              <span className="ns-st-dim">R{round}{rounds ? `/${rounds}` : ''}</span>
            </span>
            {untilMine != null && (
              <span className={cx('ns-st', untilMine === 0 && 'is-now')} title="Bis zu deinem nächsten Pick">
                <Icon name="zap" size={11} />
                {untilMine === 0 ? 'Du bist dran' : `Du in ${untilMine}`}
              </span>
            )}
          </>
        ) : (
          <span className="ns-st">Kein Draft</span>
        )}

        <button
          className="ns-st ns-st-btn"
          onClick={sync}
          disabled={!selectedDraftId}
          title={
            (autoRefreshEnabled ? `Auto-Sync alle ${refreshIntervalSeconds}s` : 'Auto-Sync aus') +
            (lastSyncAt ? ` · zuletzt ${new Date(lastSyncAt).toLocaleTimeString('de-DE')}` : '') +
            ' · Klick synchronisiert jetzt (R)'
          }
        >
          <span className={cx('ns-st-dot', autoRefreshEnabled && 'is-on', picksLoading && 'is-busy')} />
          {lastSyncAt ? new Date(lastSyncAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : '—'}
        </button>

        <div className="ns-status-spacer" />

        <span
          className="ns-st ns-st-dim"
          title={`Rangliste: ${rankingSource || 'unbekannt'}${marketMeta?.source ? ` · ADP: ${marketMeta.source}` : ''} · ${boardPlayers.length} Spieler im Board`}
        >
          {boardPlayers.length} Spieler
        </span>
        <button className="ns-st ns-st-btn" onClick={() => setCmdOpen(true)} title="Alle Befehle und Tastenkürzel">
          <kbd className="ns-kbd">{MOD_K}</kbd>
        </button>
      </footer>

      <TipsBubble tips={tipList} open={tipsOpen} onToggle={() => setTipsOpen((v) => !v)} />
      {cmdOpen && <CommandPalette commands={commands} onClose={() => setCmdOpen(false)} />}
    </div>
  )
}

function ThemeMenu({ themeId, onPick, onClose }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <>
      <div className="ns-menu-backdrop" onClick={onClose} />
      <div className="ns-menu ns-menu--rail" role="menu">
        <div className="ns-menu-group">Theme</div>
        {THEMES.map((t) => (
          <button
            key={t.id}
            role="menuitem"
            className={cx('ns-menu-item', t.id === themeId && 'is-active')}
            onClick={() => onPick(t.id)}
          >
            <span className="ns-menu-main">{t.label || t.name || t.id}</span>
            {t.id === themeId && <Icon name="check" size={13} />}
          </button>
        ))}
      </div>
    </>
  )
}

/* Draft-Umschalter direkt im Breadcrumb: waehrend eines Draft-Abends wechselt
   man staendig zwischen Liga-Draft und Mocks — dafuer soll man nicht ins
   Setup muessen. */
function DraftSwitcher({ drafts, leagues, nicknames, selectedDraftId, onPick, onClose }) {
  const groups = useMemo(() => groupDrafts(drafts), [drafts])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      <div className="ns-menu-backdrop" onClick={onClose} />
      <div className="ns-menu" role="menu">
        {groups.length === 0 && <div className="ns-menu-empty">Keine Drafts geladen.</div>}
        {groups.map((g) => (
          <div key={g.title}>
            <div className="ns-menu-group">{g.title}</div>
            {g.items.map((d) => {
              const active = String(d.draft_id) === String(selectedDraftId)
              const sub = draftSubtitle(d, leagues, nicknames)
              return (
                <button
                  key={d.draft_id}
                  role="menuitem"
                  className={cx('ns-menu-item', active && 'is-active')}
                  onClick={() => onPick(d)}
                >
                  <span className="ns-menu-text">
                    <span className="ns-menu-main">{draftLabel(d, leagues, nicknames)}</span>
                    {sub && <span className="ns-menu-sub">{sub}</span>}
                  </span>
                  {d.status === 'drafting' && <span className="ns-menu-live">Live</span>}
                  {active && <Icon name="check" size={13} />}
                </button>
              )
            })}
          </div>
        ))}
      </div>
    </>
  )
}

/* Tipps bleiben eine schwebende Blase wie im alten TipsDock — sie gehoeren
   keinem Panel, sondern dem ganzen Draft, und duerfen nichts blockieren. */
function TipsBubble({ tips, open, onToggle }) {
  return (
    <div className={cx('ns-tips', open && 'is-open')}>
      {open && (
        <div className="ns-tips-panel">
          <div className="ns-tips-head">
            <span>Live-Tipps</span>
            <button className="ns-tips-x" onClick={onToggle} aria-label="Tipps schließen"><Icon name="x" size={13} /></button>
          </div>
          {tips.length === 0 && <div className="ns-news-empty">Keine Tipps aktuell.</div>}
          {tips.map((t, i) => (
            <div key={t.id || i} className={cx('ns-tip', t.tone && `ns-tip--${t.tone}`)}>
              <span className="ns-tip-mark" />
              <span>{t.title ? <><b>{t.title}</b> {t.text || t.body || ''}</> : (t.text || t.body || String(t))}</span>
            </div>
          ))}
        </div>
      )}
      <button className="ns-tips-btn" onClick={onToggle} aria-expanded={open} title="Live-Tipps (T)">
        <Icon name="zap" size={14} />
        <span>Tipps</span>
        {tips.length > 0 && <span className="ns-tips-count">{tips.length}</span>}
      </button>
    </div>
  )
}

function CommandPalette({ commands, onClose }) {
  const [q, setQ] = useState('')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef(null)
  const { boardPlayers, setSearchQuery } = useBoardStore()

  useEffect(() => { inputRef.current?.focus() }, [])

  const hits = useMemo(() => {
    const s = q.trim().toLowerCase()
    const cmds = commands.filter((c) => !s || c.label.toLowerCase().includes(s) || c.group.toLowerCase().includes(s))
    const players = s
      ? boardPlayers
          .filter((p) => String(p.name || '').toLowerCase().includes(s))
          .slice(0, 5)
          .map((p) => ({ group: 'Spieler', label: p.name, keys: p.pos, run: () => setSearchQuery(p.name) }))
      : []
    return [...cmds, ...players]
  }, [q, commands, boardPlayers]) // eslint-disable-line

  useEffect(() => { setCursor(0) }, [q])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(hits.length - 1, c + 1)) }
      if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(0, c - 1)) }
      if (e.key === 'Enter') { e.preventDefault(); hits[cursor]?.run?.(); onClose() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [hits, cursor, onClose])

  let lastGroup = null

  return (
    <div className="ns-cmdk-backdrop" onClick={onClose}>
      <div className="ns-cmdk" role="dialog" aria-label="Befehle" onClick={(e) => e.stopPropagation()}>
        <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Befehl oder Spieler …" />
        <div className="ns-cmdk-list">
          {hits.length === 0 && <div className="ns-empty">Nichts gefunden.</div>}
          {hits.map((h, i) => {
            const head = h.group !== lastGroup ? h.group : null
            lastGroup = h.group
            return (
              <div key={`${h.group}-${h.label}`}>
                {head && <div className="ns-cmdk-group">{head}</div>}
                <div
                  className={cx('ns-cmdk-item', i === cursor && 'is-cursor')}
                  onMouseEnter={() => setCursor(i)}
                  onClick={() => { h.run?.(); onClose() }}
                >
                  <span>{h.label}</span>
                  {h.keys && <kbd className="ns-kbd">{h.keys}</kbd>}
                </div>
              </div>
            )
          })}
        </div>
        <div className="ns-cmdk-foot">
          <span>↑↓ Navigieren</span>
          <span>↵ Ausführen</span>
          <span>Esc Schließen</span>
        </div>
      </div>
    </div>
  )
}
