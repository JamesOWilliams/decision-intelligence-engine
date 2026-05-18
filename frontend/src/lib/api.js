import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

export const api = {
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
};
