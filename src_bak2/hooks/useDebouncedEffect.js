import { useEffect, useRef } from 'react';
/**
 * Debounced effect: runs the callback once 'delay' ms after the latest dep change.
 * Usage mirrors useEffect, but delays the callback and cancels on re-run/unmount.
 */
export default function useDebouncedEffect(callback, deps, delay = 200) {
  const timer = useRef();
  useEffect(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      try { callback(); } catch (_) { /* no-op */ }
    }, delay);
    return () => clearTimeout(timer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
