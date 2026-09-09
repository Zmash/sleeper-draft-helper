import { useEffect, useMemo } from 'react';
import { createTapCounter, EGG_TAP_COUNT, EGG_TAP_WINDOW_MS, openFootballEgg } from '../utils/easterEgg.js';

// Easter Egg: Das Field-Goal-Spiel unter /football.html.
// Desktop: "football" tippen. Mobil (keine Tastatur): Footer 5x antippen
// (bzw. das Brand-Logo in der Topbar — siehe Topbar.jsx).
export default function Footer() {
  const handleTap = useMemo(
    () => createTapCounter(EGG_TAP_COUNT, EGG_TAP_WINDOW_MS, openFootballEgg),
    [],
  );

  useEffect(() => {
    let buffer = '';

    const handleKeyPress = (e) => {
      if (e.key.length !== 1) return;
      buffer += e.key.toLowerCase();

      // Wenn buffer länger als "football" ist, vorne abschneiden
      if (buffer.length > 8) {
        buffer = buffer.slice(-8);
      }

      if (buffer === 'football') {
        buffer = '';
        openFootballEgg();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <footer className="muted text-xs mt-6" onClick={handleTap} style={{ cursor: 'pointer' }}>
      SleeperDraftHelper by Zmash
    </footer>
  );
}
