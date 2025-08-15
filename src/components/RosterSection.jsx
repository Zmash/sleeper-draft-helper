import RosterList from './RosterList'

export default function RosterSection({ picks, me, boardPlayers = [], league = null, draft = null, teamsCount = null, }) {
  return (
    <section className="card">
      <h2>Mein Roster</h2>
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
