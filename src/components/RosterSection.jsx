import RosterList from './RosterList'

const POS_ORDER = ['QB','RB','WR','TE','K','DEF','OL','DL','LB','DB']
const sortByPos = (a, b) => {
  const ai = POS_ORDER.indexOf(a.pos)
  const bi = POS_ORDER.indexOf(b.pos)
  return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.name.localeCompare(b.name)
}

function DynastyRosterGroup({ label, players }) {
  if (!players.length) return null
  return (
    <div className="dynasty-group">
      <div className="dynasty-group-label muted text-xs">{label}</div>
      <div className="dynasty-group-rows">
        {players.sort(sortByPos).map((p, i) => (
          <div key={p.sleeper_id || i} className="dynasty-row">
            <span className={`slot-pill slot-pill--${p.pos || 'BN'}`}>{p.pos || '?'}</span>
            <span className="dynasty-name">{p.name}</span>
            <span className="dynasty-meta muted">{[p.team, p.age ? `${p.age}y` : null].filter(Boolean).join(' · ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RosterSection({
  picks, me, boardPlayers = [], league = null, draft = null, teamsCount = null,
  draftMode = 'redraft', dynastyRoster = [],
}) {
  const isRookie = draftMode === 'rookie'

  const starters = dynastyRoster.filter(p => p.slot === 'starter')
  const bench    = dynastyRoster.filter(p => p.slot === 'bench')
  const taxi     = dynastyRoster.filter(p => p.slot === 'taxi')
  const ir       = dynastyRoster.filter(p => p.slot === 'ir')

  return (
    <section className="card">
      {isRookie && dynastyRoster.length > 0 && (
        <>
          <h2>Dein Dynasty-Kader</h2>
          <div className="dynasty-roster">
            <DynastyRosterGroup label="Starter" players={starters} />
            <DynastyRosterGroup label="Bank" players={bench} />
            {taxi.length > 0 && <DynastyRosterGroup label="Taxi Squad" players={taxi} />}
            {ir.length > 0 && <DynastyRosterGroup label="IR" players={ir} />}
          </div>
          <h2 style={{ marginTop: '1.5rem' }}>Deine Rookie-Picks</h2>
        </>
      )}

      {!isRookie && <h2>Mein Roster</h2>}

      <RosterList
        picks={picks}
        me={me}
        boardPlayers={boardPlayers}
        league={league}
        draft={draft}
        teamsCount={teamsCount}
      />
    </section>
  )
}
