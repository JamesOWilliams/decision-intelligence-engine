import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

export const api = {
  // ── Existing assessment endpoints ──
  ontology: () => client.get("/ontology").then((r) => r.data),
  createAssessment: (payload = {}) =>
    client.post("/assessments", payload).then((r) => r.data),
  getAssessment: (id) => client.get(`/assessments/${id}`).then((r) => r.data),
  patchAssessment: (id, patch) =>
    client.patch(`/assessments/${id}`, patch).then((r) => r.data),
  score: (id) => client.post(`/assessments/${id}/score`).then((r) => r.data),
  generateReport: (id) =>
    client.post(`/assessments/${id}/report`).then((r) => r.data),
  getReport: (id) =>
    client.get(`/assessments/${id}/report`).then((r) => r.data),
  demoCurrent: () =>
    client.get("/assessments/demo/current").then((r) => r.data),
  seedDemo: () =>
    client.post("/assessments/seed-demo").then((r) => r.data),
  createShareLink: (assessmentId, body = {}) =>
    client.post(`/assessments/${assessmentId}/share`, body).then((r) => r.data),
  getShareLink: (assessmentId) =>
    client.get(`/assessments/${assessmentId}/share`).then((r) => r.data),
  getShared: (token) =>
    client.get(`/shared/${token}`).then((r) => r.data),

  // ── Initiative endpoints ──
  getInitiative: (initiativeId) =>
    client.get(`/initiatives/${initiativeId}`).then((r) => r.data),
  getInitiativeAssessments: (initiativeId) =>
    client.get(`/initiatives/${initiativeId}/assessments`).then((r) => r.data),
  createReassessment: (initiativeId) =>
    client.post(`/initiatives/${initiativeId}/reassessment`).then((r) => r.data),

  // ── Remediation Plan endpoints ──
  createRemediationPlan: (initiativeId, body) =>
    client.post(`/initiatives/${initiativeId}/remediation-plans`, body).then((r) => r.data),
  getRemediationPlans: (initiativeId) =>
    client.get(`/initiatives/${initiativeId}/remediation-plans`).then((r) => r.data),
  getRemediationPlan: (planId) =>
    client.get(`/remediation-plans/${planId}`).then((r) => r.data),

  // ── Remediation Action endpoints ──
  createAction: (planId, body) =>
    client.post(`/remediation-plans/${planId}/actions`, body).then((r) => r.data),
  updateAction: (actionId, patch) =>
    client.patch(`/remediation-actions/${actionId}`, patch).then((r) => r.data),

  // ── Comparison endpoints ──
  getComparison: (initiativeId, fromId, toId) =>
    client
      .get(`/initiatives/${initiativeId}/comparison`, { params: { from: fromId, to: toId } })
      .then((r) => r.data),
  getComparisonExplanation: (initiativeId, fromAssessmentId, toAssessmentId) =>
    client
      .post(`/initiatives/${initiativeId}/comparison/explanation`, {
        from_assessment_id: fromAssessmentId,
        to_assessment_id: toAssessmentId,
      })
      .then((r) => r.data),
  // ── Decision Record endpoints ──
  createDecisionRecord: (initiativeId, body) =>
    client.post(`/initiatives/${initiativeId}/decision-records`, body).then((r) => r.data),
  getDecisionRecords: (initiativeId) =>
    client.get(`/initiatives/${initiativeId}/decision-records`).then((r) => r.data),
  getDecisionRecord: (recordId) =>
    client.get(`/decision-records/${recordId}`).then((r) => r.data),
};
