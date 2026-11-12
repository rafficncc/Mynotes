import { useEffect, useState } from 'react';
import { useStore } from './useStore';

/**
 * True once persisted data has been loaded from device storage. Falls back to true after
 * a short wait so the app still opens if storage is unavailable (e.g. a locked-down browser).
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(useStore.persist.hasHydrated());
  useEffect(() => {
    const unsub = useStore.persist.onFinishHydration(() => setHydrated(true));
    // Hydration may have finished between render and this effect.
    const check = setTimeout(() => useStore.persist.hasHydrated() && setHydrated(true), 0);
    const fallback = setTimeout(() => setHydrated(true), 1500);
    return () => {
      unsub();
      clearTimeout(check);
      clearTimeout(fallback);
    };
  }, []);
  return hydrated;
}
