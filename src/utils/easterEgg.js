// Verstecktes Easter Egg: Field-Goal-Spiel unter /football.html.
// Desktop: "football" tippen. Mobil (keine Tastatur): 5x schnell hintereinander
// auf das Brand-Logo in der Topbar (oder den Footer-Text) tippen.
export const EGG_TAP_COUNT = 5;
export const EGG_TAP_WINDOW_MS = 3000;

export function openFootballEgg() {
  // Relativ aufloesen statt absolutem Pfad, damit es auch im
  // Capacitor-Build (file://) und unter Nested-Routen funktioniert.
  window.location.href = new URL('football.html', window.location.href).toString();
}

// Zaehlt schnelle Taps; ruft onTrigger, sobald `count` Taps innerhalb
// von `windowMs` liegen. Danach wird der Zaeher zurueckgesetzt.
export function createTapCounter(count, windowMs, onTrigger) {
  let hits = [];
  return () => {
    const now = Date.now();
    hits = [...hits, now].slice(-count);
    if (hits.length === count && now - hits[0] <= windowMs) {
      hits = [];
      onTrigger();
    }
  };
}
