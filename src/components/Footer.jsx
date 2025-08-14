import { useEffect } from 'react';

export default function Footer() {
  useEffect(() => {
    let buffer = '';

    const handleKeyPress = (e) => {
      buffer += e.key.toLowerCase();

      // Wenn buffer länger als "football" ist, vorne abschneiden
      if (buffer.length > 8) {
        buffer = buffer.slice(-8);
      }

      if (buffer === 'football') {
        window.location.href = '/football.html';
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  return (
    <footer className="muted text-xs mt-6">
      SleeperDraftHelper by Zmash
    </footer>
  );
}
