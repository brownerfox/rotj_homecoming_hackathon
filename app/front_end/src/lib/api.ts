import type {
  Assessment, AssessmentInput, AuthResponse, Candidate, Evaluation, EvaluationListItem,
  ResumeInsights, Role, Submission, User,
} from "./types";
import { mockApi } from "./mock-api";
import { ApiError } from "./api-error";
export { ApiError };

export const API_BASE_URL: string =
  (import.meta.env['VITE_API_BASE_URL'] as string | undefined) ?? "http://localhost:8000";
export const USE_MOCKS: boolean = (import.meta.env['VITE_USE_MOCKS'] ?? "true") !== "false";

const TOKEN_KEY = "tap_token";

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : window.localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => window.localStorage.setItem(TOKEN_KEY, t),
  clear: () => window.localStorage.removeItem(TOKEN_KEY),
};


const FRIENDLY: Record<number, string> = {
  400: "The request could not be processed. Please check the information and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "You do not have access to this item.",
  404: "The requested item could not be found.",
  413: "The file is too large.",
  415: "This file type is not supported.",
  422: "Some fields are missing or invalid.",
};

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "The assessment server could not be reached. Please try again shortly.");
  }
  if (!res.ok) {
    if (res.status === 401) onUnauthorized?.();
    let message = FRIENDLY[res.status] ?? "Something went wrong on the server. Please try again.";
    try {
      const body = await res.json();
      // Only accept short, user-safe string messages from the server.
      if (typeof body?.detail === "string" && body.detail.length < 200) message = body.detail;
    } catch { /* ignore */ }
    throw new ApiError(res.status, message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const json = (body: unknown) => JSON.stringify(body);

const realApi = {
  register: (d: { name: string; email: string; password: string; role: Role; company_name: string }) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: json(d) }),
  login: (d: { email: string; password: string }) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: json(d) }),
  me: () => request<User>("/auth/me"),

  listAssessments: () => request<Assessment[]>("/assessments"),
  getAssessment: (id: string) => request<Assessment>(`/assessments/${id}`),
  createAssessment: (d: AssessmentInput) =>
    request<Assessment>("/assessments", { method: "POST", body: json(d) }),
  updateAssessment: (id: string, d: Partial<AssessmentInput> & { status?: Assessment["status"] }) =>
    request<Assessment>(`/assessments/${id}`, { method: "PATCH", body: json(d) }),
  uploadResume: (id: string, file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<ResumeInsights>(`/assessments/${id}/resume`, { method: "POST", body: fd });
  },
  generateSpecification: (id: string) =>
    request<Assessment>(`/assessments/${id}/specification/generate`, { method: "POST" }),
  saveSpecification: (id: string, markdown: string) =>
    request<Assessment>(`/assessments/${id}/specification`, { method: "PUT", body: json({ markdown }) }),

  listCandidates: () => request<Candidate[]>("/candidates"),
  listSubmissions: (assessmentId?: string) =>
    request<Submission[]>(`/submissions${assessmentId ? `?assessment_id=${assessmentId}` : ""}`),
  createSubmission: (d: { assessment_id: string; candidate_name: string; candidate_identifier: string; question_id: string | null; file: File }) => {
    const fd = new FormData();
    fd.append("assessment_id", d.assessment_id);
    fd.append("candidate_name", d.candidate_name);
    fd.append("candidate_identifier", d.candidate_identifier);
    if (d.question_id) fd.append("question_id", d.question_id);
    fd.append("file", d.file);
    return request<Submission>("/submissions", { method: "POST", body: fd });
  },
  getSubmission: (id: string) => request<Submission>(`/submissions/${id}`),
  getEvaluation: (submissionId: string) => request<Evaluation>(`/submissions/${submissionId}/evaluation`),
  listEvaluations: () => request<EvaluationListItem[]>("/evaluations"),
};

export type Api = typeof realApi;
export const api: Api = USE_MOCKS ? mockApi : realApi;

export const errorMessage = (e: unknown) =>
  e instanceof ApiError ? e.message : "Something went wrong. Please try again.";
