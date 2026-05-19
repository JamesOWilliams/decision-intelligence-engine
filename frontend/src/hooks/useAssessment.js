import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { log } from "@/lib/logger";

/**
 * Owns assessment + ontology + score snapshot + evidence mutations for one session.
 * Exposes:
 *   - ontology, assessment, scoreSnapshot
 *   - scoring (in-flight score call indicator)
 *   - savingHint (in-flight patch indicator)
 *   - setIndicator(indicatorId, value) — optimistic local update + remote patch + score refresh
 */
export function useAssessment(sessionId) {
  const [ontology, setOntology] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [scoreSnapshot, setScoreSnapshot] = useState(null);
  const [scoring, setScoring] = useState(false);
  const [savingHint, setSavingHint] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [ont, a] = await Promise.all([api.ontology(), api.getAssessment(sessionId)]);
        if (!alive) return;
        setOntology(ont);
        setAssessment(a);
      } catch (e) {
        log.error(e);
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId]);

  const refreshScore = useCallback(async () => {
    try {
      setScoring(true);
      const s = await api.score(sessionId);
      setScoreSnapshot(s);
    } catch (e) {
      log.error(e);
    } finally {
      setScoring(false);
    }
  }, [sessionId]);

  useEffect(() => {
    if (assessment) refreshScore();
  }, [assessment, refreshScore]);

  const setIndicator = useCallback(
    async (indicatorId, value) => {
      setAssessment((prev) =>
        prev
          ? { ...prev, evidence: { ...(prev.evidence || {}), [indicatorId]: value } }
          : prev
      );
      setSavingHint(true);
      try {
        await api.patchAssessment(sessionId, { evidence: { [indicatorId]: value } });
        refreshScore();
      } catch (e) {
        log.error(e);
      } finally {
        setSavingHint(false);
      }
    },
    [sessionId, refreshScore]
  );

  return { ontology, assessment, scoreSnapshot, scoring, savingHint, setIndicator };
}
