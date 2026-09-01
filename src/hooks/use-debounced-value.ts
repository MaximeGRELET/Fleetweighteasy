import { useEffect, useState } from 'react';

/**
 * Valeur retardée, pour la recherche au fil de la frappe.
 *
 * Sans ce délai, taper « pâte à tartiner » déclencherait seize recherches. Open
 * Food Facts applique un quota par endpoint (PHASES_2_A_5 §4.2), et la
 * recherche est l'endpoint le plus contraint : le debounce est la première
 * ligne de défense, le limiteur de débit la seconde.
 *
 * @param delayMs temps de calme avant de propager la valeur
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);

    // Chaque frappe annule le report précédent : seule la dernière survit.
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
