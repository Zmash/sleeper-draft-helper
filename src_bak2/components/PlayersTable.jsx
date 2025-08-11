import React from 'react';
import PropTypes from 'prop-types';
import styles from '../styles/BoardPage.module.css';
import { cx } from '../services/utils';

/**
 * PlayersTable
 * ------------
 * Pure table renderer for player rows.
 * Expects a normalized array of player objects with fields commonly used by the app:
 * - rk, name, team, pos, bye, sos, ecrVsAdp, pick_no, status ('me' | 'other' | undefined)
 */
export default function PlayersTable({ players = [], isCsvLoaded = true }) {
  if (!players?.length) {
    return (
      <div className={styles.emptyState}>
        {isCsvLoaded ? 'No players match your filters.' : 'No CSV loaded yet.'}
      </div>
    );
  }

  return (
    <table className={cx(styles.table, 'nowrap')}>
      <thead>
        <tr>
          <th title="Rank">RK</th>
          <th>Player</th>
          <th>Team</th>
          <th>Pos</th>
          <th>Bye</th>
          <th title="Strength of Schedule">SoS</th>
          <th title="ECR vs ADP">ECR–ADP</th>
          <th title="Pick number">Pick</th>
        </tr>
      </thead>
      <tbody>
        {players.map((p) => {
          const key = p.id ?? `${p.rk}-${p.name}`;
          const pillClass = p.status === 'me'
            ? styles.pillMe
            : p.status === 'other'
              ? styles.pillOther
              : styles.pillNeutral;

          return (
            <tr key={key} className={cx(
              p.status === 'me' && styles.rowMe,
              p.status === 'other' && styles.rowOther
            )}>
              <td>{p.rk ?? ''}</td>
              <td>
                <span className={cx(styles.pill, pillClass)}>
                  {p.name ?? '—'}
                </span>
              </td>
              <td>{p.team ?? ''}</td>
              <td>{p.pos ?? ''}</td>
              <td>{p.bye ?? ''}</td>
              <td>{p.sos ?? ''}</td>
              <td>{p.ecrVsAdp ?? ''}</td>
              <td>{p.pick_no ?? ''}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

PlayersTable.propTypes = {
  players: PropTypes.arrayOf(PropTypes.object),
  isCsvLoaded: PropTypes.bool,
};
