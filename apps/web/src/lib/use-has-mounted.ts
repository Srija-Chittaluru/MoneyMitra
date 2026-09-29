import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** True only after client-side hydration; false during SSR and the first client render. */
export function useHasMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
