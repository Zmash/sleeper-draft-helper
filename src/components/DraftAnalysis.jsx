// src/components/DraftAnalysis.jsx
import React from 'react'

export default function DraftAnalysis({ scores = [], ownerLabels }) {
  return (
    <section className="card">
      <h2>Team Rankings</h2>
      <div className="table-wrapper">
        <table className="table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Team</th>
              <th>Total</th>
              <th>Value</th>
              <th>Positional</th>
              <th>Balance</th>
              <th>Diversity</th>
              <th>Bye</th>
            </tr>
          </thead>
          <tbody>
            {scores.map((r) => (
              <tr key={r.key}>
                <td>#{r.rank}</td>
                <td>{ownerLabels?.get(r.key) ?? 'unknown'}</td>
                <td>{r.total}</td>
                <td>{r.value}</td>
                <td>{r.positional}</td>
                <td>{r.balance}</td>
                <td>{r.diversity}</td>
                <td>{r.bye}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
