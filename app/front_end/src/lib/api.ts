import type {
  AuthResponse, Candidate, CandidateDetail, CandidateQuestion, CodingChallenge, CodingChallengeUpdate,
  ExistingQuestionFile, Job, JobInput, Role, User,
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
  502: "The AI service could not produce a result. Please try again.",
};

let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

// The server has no sign-in for the hackathon (API_CONTRACT.md), so no auth header is sent.
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body && !(init.body instanceof FormData)) headers.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "The server could not be reached. Please try again shortly.");
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

// Multipart body with every file under the field name the server expects ("files").
function filesForm(files: File[]): FormData {
  const fd = new FormData();
  files.forEach((f) => fd.append("files", f));
  return fd;
}

const realApi = {
  // Sign-in is local only for the hackathon, so it uses the mock even with the real server on.
  register: (d: { name: string; email: string; password: string; role: Role; company_name: string }): Promise<AuthResponse> =>
    mockApi.register(d),
  login: (d: { email: string; password: string }): Promise<AuthResponse> => mockApi.login(d),
  me: (): Promise<User> => mockApi.me(),
  demoLogin: (): Promise<AuthResponse> => mockApi.demoLogin(),

  // Page 1: Job Setup
  listJobs: () => request<Job[]>("/jobs"),
  getJob: (id: number) => request<Job>(`/jobs/${id}`),
  createJob: (d: JobInput) => request<Job>("/jobs", { method: "POST", body: json(d) }),
  updateJob: (id: number, d: Partial<JobInput>) =>
    request<Job>(`/jobs/${id}`, { method: "PATCH", body: json(d) }),

  // Page 1: PDFs of questions the team already asks. Optional, and removable one by one.
  listExistingQuestionFiles: (jobId: number) =>
    request<ExistingQuestionFile[]>(`/jobs/${jobId}/existing-questions`),
  uploadExistingQuestionFiles: (jobId: number, files: File[]) =>
    request<ExistingQuestionFile[]>(`/jobs/${jobId}/existing-questions`, { method: "POST", body: filesForm(files) }),
  deleteExistingQuestionFile: (jobId: number, fileId: number) =>
    request<void>(`/jobs/${jobId}/existing-questions/${fileId}`, { method: "DELETE" }),

  // Page 2: upload resumes. One candidate per PDF; the server generates each interview in the
  // background, so poll the candidate list until every status is "ready" or "failed".
  uploadResumes: (jobId: number, files: File[]) =>
    request<Candidate[]>(`/jobs/${jobId}/candidates`, { method: "POST", body: filesForm(files) }),
  listJobCandidates: (jobId: number) => request<Candidate[]>(`/jobs/${jobId}/candidates`),
  listCandidates: () => request<Candidate[]>("/candidates"),
  retryCandidate: (id: number) => request<Candidate>(`/candidates/${id}/retry`, { method: "POST" }),
  deleteCandidate: (id: number) => request<void>(`/candidates/${id}`, { method: "DELETE" }),

  // Page 3: the candidate's interview, every part of it editable.
  getCandidate: (id: number) => request<CandidateDetail>(`/candidates/${id}`),
  updateCandidate: (id: number, d: { name: string }) =>
    request<CandidateDetail>(`/candidates/${id}`, { method: "PATCH", body: json(d) }),
  editCandidateQuestion: (questionId: number, prompt: string) =>
    request<CandidateQuestion>(`/candidate-questions/${questionId}`, { method: "PATCH", body: json({ prompt }) }),
  editCodingChallenge: (candidateId: number, d: CodingChallengeUpdate) =>
    request<CodingChallenge>(`/candidates/${candidateId}/coding-challenge`, { method: "PATCH", body: json(d) }),
};

export type Api = typeof realApi;
export const api: Api = USE_MOCKS ? mockApi : realApi;

export const errorMessage = (e: unknown) =>
  e instanceof ApiError ? e.message : "Something went wrong. Please try again.";
