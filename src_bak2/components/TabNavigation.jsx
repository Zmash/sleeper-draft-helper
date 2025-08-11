import React from 'react';
import PropTypes from 'prop-types';
import styles from './TabNavigation.module.css';

export default function TabNavigation({ activeTab, onChange, tabs = DEFAULT_TABS }) {
  return (
    <nav className={styles.tabs} role="tablist" aria-label="Primary tabs">
      {tabs.map(t => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={activeTab === t.id}
          className={`${styles.tab} ${activeTab === t.id ? styles.active : ''}`}
          onClick={() => onChange && onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
const DEFAULT_TABS = [
  { id: 'setup', label: 'Setup' },
  { id: 'board', label: 'Board' },
  { id: 'roster', label: 'Roster' },
];
TabNavigation.propTypes = {
  activeTab: PropTypes.string.isRequired,
  onChange: PropTypes.func,
  tabs: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
  })),
};
