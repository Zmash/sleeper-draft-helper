import React from 'react';
import PropTypes from 'prop-types';
import styles from './TopBar.module.css';

export default function TopBar({ title = 'Sleeper Draft Helper', themeMode, onToggleTheme, right }) {
  return (
    <header className={styles.topbar}>
      <div className={styles.left}>
        <h1 className={styles.title}>{title}</h1>
      </div>
      <div className={styles.right}>
        {typeof themeMode !== 'undefined' && typeof onToggleTheme === 'function' && (
          <button
            type="button"
            className={styles.ghostBtn}
            onClick={onToggleTheme}
            title={themeMode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {themeMode === 'dark' ? '☀️ Light' : '🌙 Dark'}
          </button>
        )}
        {right}
      </div>
    </header>
  );
}
TopBar.propTypes = {
  title: PropTypes.string,
  themeMode: PropTypes.oneOf(['light', 'dark']),
  onToggleTheme: PropTypes.func,
  right: PropTypes.node,
};
