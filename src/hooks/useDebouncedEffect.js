import { useEffect, useRef } from 'react'

// Debounced effect (use to avoid focus flicker on inputs while persisting)
const useDebouncedEffect = (fn, deps, delay = 200) => {
  const timeoutRef = useRef()
  useEffect(() => {
    clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(fn, delay)
    return () => clearTimeout(timeoutRef.current)
  }, deps) // eslint-disable-line react-hooks/exhaustive-deps
}

export default useDebouncedEffect
