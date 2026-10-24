import { useEffect } from "react";

/** Keep client tab state aligned after `router.refresh()` updates RSC props. */
export function useSyncServerProp<T>(serverValue: T, apply: (value: T) => void) {
  useEffect(() => {
    apply(serverValue);
  }, [serverValue, apply]);
}
