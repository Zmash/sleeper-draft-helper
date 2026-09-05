import Icon from './Icon'
import { cx, normalizePos, fantasyProsSlug } from '../utils/formatting'
import { usePlayerNews } from '../hooks/usePlayerNews'

// Spieler-Detail als Bottom-Sheet: mobiles Gegenstueck zur Detailspalte der
// Desktop-Shell. Oeffnet sich bei kurzem Tippen auf eine Board-Zeile — der
// lange Druck bleibt dem Verschieben vorbehalten.
export default function PlayerDetailSheet({ player, onClose }) {
  const { items: news, state } = usePlayerNews(player?.name)
  const open = !!player

  const pos = player?.pos ? normalizePos(player.pos) : null
  const fpUrl = player?.name
    ? `https://www.fantasypros.com/nfl/players/${fantasyProsSlug(player.name)}.php`
    : null

  return (
    <>
      <div className={cx('board-sheet-scrim pds-scrim', open && 'is-open')} onClick={onClose} />
      <div className={cx('board-sheet pds-sheet', open && 'is-open')} role="dialog" aria-label="Spieler-Details">
        <div className="board-sheet-head">
          <strong>{player?.name || 'Spieler'}</strong>
          <button type="button" className="board-sheet-close" onClick={onClose} aria-label="Schließen">
            <Icon name="x" size={18} />
          </button>
        </div>

        {player && (
          <>
            <div className="pds-meta">
              {pos && (
                <span className="pds-pos" style={{ background: `var(--pos-${pos.toLowerCase()})` }}>{pos}</span>
              )}
              <span>{player.team || '—'}</span>
              {player.bye ? <span className="pds-dim">Bye {player.bye}</span> : null}
              {player.adp != null ? <span className="pds-dim">ADP {Math.round(player.adp * 10) / 10}</span> : null}
              {player.rk ? <span className="pds-dim">Rang {player.rk}</span> : null}
            </div>

            {player.injury_status && (
              <div className={cx('pds-status', player.injury_status !== 'Questionable' && 'is-out')}>
                <Icon name="warning" size={13} />
                <span>
                  {player.injury_status === 'Questionable' ? 'Fraglich' : player.injury_status}
                  {player.injury_body_part ? ` · ${player.injury_body_part}` : ''}
                </span>
              </div>
            )}
            {player.status && (
              <div className="pds-status">
                <Icon name="check" size={13} />
                <span>Bereits gedraftet{player.pick_no ? ` — Pick ${player.pick_no}` : ''}</span>
              </div>
            )}

            <div className="pds-newshead">
              <span>Aus dem Netz</span>
              <span className="pds-dim">
                {state === 'loading' ? 'lädt …' : state === 'error' ? 'nicht erreichbar' : news?.length ? 'FantasyPros' : 'keine Treffer'}
              </span>
            </div>

            {state === 'loading' ? (
              <>
                <div className="pds-sk" style={{ width: '92%' }} />
                <div className="pds-sk" style={{ width: '78%' }} />
                <div className="pds-sk" style={{ width: '85%' }} />
              </>
            ) : news?.length ? (
              news.map((n, i) => (
                <article key={i} className="pds-news">
                  <div className="pds-dim pds-newsmeta">{n.date || 'unbekannt'}{n.author ? ` · ${n.author}` : ''}</div>
                  <div className="pds-newstext">
                    {n.url
                      ? <a href={n.url} target="_blank" rel="noreferrer">{n.headline}</a>
                      : <b>{n.headline}</b>}
                    {n.body ? <> — {n.body}</> : null}
                  </div>
                  {n.impact && <div className="pds-impact"><b>Fantasy Impact</b> {n.impact}</div>}
                </article>
              ))
            ) : (
              <div className="pds-empty">
                {state === 'error'
                  ? 'News-Dienst nicht erreichbar.'
                  : `Keine aktuellen Meldungen zu ${String(player.name).split(' ')[0]}.`}
              </div>
            )}

            {fpUrl && (
              <a className="btn btn-secondary pds-link" href={fpUrl} target="_blank" rel="noreferrer">
                Auf FantasyPros öffnen
              </a>
            )}
          </>
        )}
      </div>
    </>
  )
}
