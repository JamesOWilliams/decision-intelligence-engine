import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * Passive share-link telemetry. Side-effect-free GET — never increments view_count.
 * `refreshTrigger` is a dependency you can bump to force a re-read (e.g. when the
 * share dialog closes after a new link is created).
 */
export function useShareTelemetry(assessmentId, refreshTrigger = 0) {
  const [telemetry, setTelemetry] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const t = await api.getShareLink(assessmentId);
      setTelemetry(t);
    } catch {
      setTelemetry(null);
    }
  }, [assessmentId]);

  useEffect(() => {
    refresh();
  }, [refresh, refreshTrigger]);

  return { telemetry, refresh };
}
