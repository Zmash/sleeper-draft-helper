import React from 'react';
import PropTypes from 'prop-types';
import styles from '../styles/RosterPage.module.css';

/**
 * RosterList
 * ----------
 * Presentational list of the current user's picks.
 * Expects Sleeper-like pick objects:
 *   { user_id, pick_no, round, metadata?: { first_name, last_name, team, position } }
 * No data fetching here; sorting is done locally by pick number.
 */
export default function RosterList({ picks = [], me }) {
  const mine = (picks || []).filter(p => String(p?.user_id) === String(me));
  const sorted = [...mine].sort((a, b) => (a?.pick_no ?? 0) - (b?.pick_no ?? 0));

  if (!sorted.length) {
    return <div className={styles.empty}>No picks yet.</div>;
  }

  return (
    <ul className={styles.list}>
      {sorted.map((p) => {
        const meta = p?.metadata || {};
        const first = meta.first_name || meta.first || '';
        const last = meta.last_name || meta.last || '';
        const name = (first || last) ? `${first} ${last}`.trim() : (p?.player_name || 'Unknown Player');
        const pos = meta.position || meta.pos || '';
        const team = meta.team || meta.pro_team || '';
        const round = p?.round ?? '';
        const key = p?.pick_no ?? `${p?.user_id}-${name}-${round}`;

        return (
          <li key={key} className={styles.item}>
            <div className={styles.main}>
              <span className={styles.name}>{name}</span>
              <span className={styles.meta}>
                {round ? `Round ${round}` : ''}{p?.pick_no ? (round ? ` · Pick ${p.pick_no}` : `Pick ${p.pick_no}`) : ''}
              </span>
            </div>
            <div className={styles.badges}>
              {team ? <span className={styles.badge}>{team}</span> : null}
              {pos ? <span className={styles.badge}>{pos}</span> : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

RosterList.propTypes = {
  picks: PropTypes.arrayOf(PropTypes.object),
  me: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
