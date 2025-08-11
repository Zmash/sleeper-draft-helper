import React from 'react';
import PropTypes from 'prop-types';
import RosterList from '../components/RosterList';
import styles from '../styles/RosterPage.module.css';

/**
 * RosterPage
 * ----------
 * Thin wrapper for the current user's roster.
 * Pass picks (array) and me (user id). No business logic inside.
 */
export default function RosterPage({ picks, me }) {
  return (
    <section className="card">
      <div className={styles.headerRow}>
        <h2>My Roster</h2>
      </div>
      <RosterList picks={picks} me={me} />
    </section>
  );
}

RosterPage.propTypes = {
  picks: PropTypes.arrayOf(PropTypes.object),
  me: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
