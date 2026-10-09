/**
 * useDebounce Hook
 *
 * Returns a debounced version of the value that only updates after
 * `delay` ms of inactivity. Used by the sidebar SearchBar to avoid
 * filtering on every keystroke.
 */

import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
