import { useMemo } from 'react';
import { createTapCounter, EGG_TAP_COUNT, EGG_TAP_WINDOW_MS, openFootballEgg } from '../utils/easterEgg.js';
import { useFootballEgg } from '../hooks/useFootballEgg.js';

// Easter Egg: Das Field-Goal-Spiel unter /football.html.
// Desktop: "football" tippen (Hook, auch in NextShell aktiv). Mobil
// (keine Tastatur): Footer 5x antippen (bzw. Brand-Logo — siehe
// Topbar.jsx / NextShell.jsx).
export default function Footer() {
  useFootballEgg();
  const handleTap = useMemo(
    () => createTapCounter(EGG_TAP_COUNT, EGG_TAP_WINDOW_MS, openFootballEgg),
    [],
  );

  return (
    <footer className="muted text-xs mt-6" onClick={handleTap} style={{ cursor: 'pointer' }}>
      SleeperDraftHelper by Zmash
    </footer>
  );
}
