import React from 'react';
import PropTypes from 'prop-types';
import styles from '../styles/BoardPage.module.css';

export default function ProgressBar({ percent = 0 }) {
  const clamped = Math.max(0, Math.min(100, +percent || 0));
  return (
    <div className={styles.progress}>
      <div className={styles.progressFill} style={{ width: `${clamped}%` }} />
    </div>
  );
}
ProgressBar.propTypes = {
  percent: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
