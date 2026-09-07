import { depthChartLabel } from '../utils/formatting'

// Kompaktes Depth-Chart-Label ("RB2") fuer den schnellen Blick: Starter
// (Order 1) heben sich farbig ab, alles dahinter bleibt dezent umrandet.
// Rendert nichts, wenn der Spieler keine Depth-Chart-Daten hat (z.B. K/DEF,
// Free Agents, oder Sleeper kennt die Team-Aufstellung noch nicht).
export default function DepthTag({ player, className = '' }) {
  const label = depthChartLabel(player)
  if (!label) return null
  const isStarter = Number(player?.depth_chart_order) === 1
  return (
    <span
      className={`dc-tag${isStarter ? ' dc-tag--starter' : ''}${className ? ` ${className}` : ''}`}
      title="Depth Chart (Team-interne Positionstiefe, Quelle: Sleeper)"
    >
      {label}
    </span>
  )
}
