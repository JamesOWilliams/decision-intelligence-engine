import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { log } from "@/lib/logger";

/**
 * Fetches a generated report. Falls back to POST /report (one-shot generate)
 * if GET returns 404 — preserves the current Report.jsx behavior.
 */
export function useReport(sessionId) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await api.getReport(sessionId);
        if (alive) setReport(r);
      } catch {
        try {
          const r = await api.generateReport(sessionId);
          if (alive) setReport(r);
        } catch (e) {
          log.error(e);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId]);

  return { report, loading };
}
