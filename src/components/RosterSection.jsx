import RosterList from './RosterList'

export default function RosterSection({ picks, me, boardPlayers = [] }) {
  return (
    <section className="card">
      <h2>Mein Roster</h2>
      <RosterList picks={picks} me={me} boardPlayers={boardPlayers} />
    </section>
  )
}
