import React, { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import TopNav from "@/components/TopNav";
import DimensionNav from "@/components/assessment/DimensionNav";
import ReadinessPulse from "@/components/assessment/ReadinessPulse";
import DimensionPanel from "@/components/assessment/DimensionPanel";
import { useAssessment } from "@/hooks/useAssessment";
import {
  countAnsweredIndicators,
  countTotalIndicators,
  completionPercent,
  MIN_COMPLETION_TO_GENERATE,
} from "@/lib/assessmentUtils";
import { api } from "@/lib/api";
import { log } from "@/lib/logger";

export default function Assessment() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const { ontology, assessment, scoreSnapshot, scoring, savingHint, setIndicator } =
    useAssessment(sessionId);

  const [activeIdx, setActiveIdx] = useState(0);
  const [generating, setGenerating] = useState(false);

  const dimensions = useMemo(
    () => ontology?.domain?.dimensions || [],
    [ontology]
  );
  const activeDim = dimensions[activeIdx];

  const totalIndicators = useMemo(() => countTotalIndicators(dimensions), [dimensions]);
  const answeredIndicators = useMemo(
    () => countAnsweredIndicators(assessment?.evidence),
    [assessment]
  );
  const completePct = completionPercent(answeredIndicators, totalIndicators);
  const canGenerate = completePct >= MIN_COMPLETION_TO_GENERATE;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      await api.generateReport(sessionId);
      navigate(`/report/${sessionId}`);
    } catch (e) {
      log.error(e);
      setGenerating(false);
    }
  };

  if (!ontology || !assessment) {
    return (
      <div className="App">
        <TopNav />
        <div className="max-w-screen-2xl mx-auto px-12 py-16 eyebrow">Loading…</div>
      </div>
    );
  }

  return (
    <div className="App">
      <TopNav
        crumb={
          <>
            <span>Step 02</span> · <span className="text-ink">Evidence Assessment</span>
          </>
        }
        right={
          <div className="flex items-center gap-4">
            <span className="eyebrow">{savingHint ? "Saving…" : "Autosaved"}</span>
            <span className="eyebrow text-ink">{completePct}% complete</span>
          </div>
        }
      />

      <main className="max-w-screen-2xl mx-auto px-6 md:px-12 pt-10 pb-32 grid grid-cols-12 gap-8">
        <DimensionNav
          dimensions={dimensions}
          activeIdx={activeIdx}
          onSelect={setActiveIdx}
          dimensionScores={scoreSnapshot?.dimensions || []}
          completePct={completePct}
          answeredCount={answeredIndicators}
          totalCount={totalIndicators}
        />

        <DimensionPanel
          dimension={activeDim}
          index={activeIdx}
          total={dimensions.length}
          evidence={assessment.evidence}
          scale={ontology.maturity_scale}
          onIndicatorChange={setIndicator}
          onPrev={() => setActiveIdx(Math.max(0, activeIdx - 1))}
          onNext={() => setActiveIdx(Math.min(dimensions.length - 1, activeIdx + 1))}
          onGenerate={handleGenerate}
          canGenerate={canGenerate}
          completePct={completePct}
          generating={generating}
        />

        <ReadinessPulse scoreSnapshot={scoreSnapshot} scoring={scoring} />
      </main>
    </div>
  );
}
