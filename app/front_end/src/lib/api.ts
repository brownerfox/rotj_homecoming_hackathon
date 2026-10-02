import type {
  Analysis, AuthResponse, Candidate, CandidateInput, ExtractedText, Interview, Job, JobInput,
  Role, Submission, User,
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

// The interview, submission, and analysis do not exist until they are created.
// The server answers 404 for those, which the pages treat as "not yet" instead of an error.
async function orNull<T>(p: Promise<T>): Promise<T | null> {
  try {
    return await p;
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }
}

const realApi = {
  // Sign-in is local only for the hackathon, so it uses the mock even with the real server on.
  register: (d: { name: string; email: string; password: string; role: Role; company_name: string }): Promise<AuthResponse> =>
    mockApi.register(d),
  login: (d: { email: string; password: string }): Promise<AuthResponse> => mockApi.login(d),
  me: (): Promise<User> => mockApi.me(),
  demoLogin: (): Promise<AuthResponse> => mockApi.demoLogin(),

  // Pages 1 and 2: turn an uploaded posting or resume into text.
  extractText: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<ExtractedText>("/files/extract-text", { method: "POST", body: fd });
  },

  // Page 1: Job Setup
  listJobs: () => request<Job[]>("/jobs"),
  getJob: (id: number) => request<Job>(`/jobs/${id}`),
  createJob: (d: JobInput) => request<Job>("/jobs", { method: "POST", body: json(d) }),
  updateJob: (id: number, d: Partial<JobInput>) =>
    request<Job>(`/jobs/${id}`, { method: "PATCH", body: json(d) }),

  // Page 2: Candidate Setup
  listCandidates: () => request<Candidate[]>("/candidates"),
  getCandidate: (id: number) => request<Candidate>(`/candidates/${id}`),
  createCandidate: (jobId: number, d: CandidateInput) =>
    request<Candidate>(`/jobs/${jobId}/candidates`, { method: "POST", body: json(d) }),
  updateCandidate: (id: number, d: Partial<CandidateInput>) =>
    request<Candidate>(`/candidates/${id}`, { method: "PATCH", body: json(d) }),

  // LLM Call #1 and Page 3
  generateInterview: (candidateId: number) =>
    request<Interview>(`/candidates/${candidateId}/interview/generate`, { method: "POST" }),
  getInterview: (candidateId: number) =>
    orNull(request<Interview>(`/candidates/${candidateId}/interview`)),
  createSubmission: (candidateId: number, d: { solutionFiles: File[]; processFiles: File[] }) => {
    const fd = new FormData();
    d.solutionFiles.forEach((f) => fd.append("solution_files", f));
    d.processFiles.forEach((f) => fd.append("process_files", f));
    return request<Submission>(`/candidates/${candidateId}/submission`, { method: "POST", body: fd });
  },
  getSubmission: (candidateId: number) =>
    orNull(request<Submission>(`/candidates/${candidateId}/submission`)),

  // LLM Call #2 and Page 4
  generateAnalysis: (candidateId: number) =>
    request<Analysis>(`/candidates/${candidateId}/analysis/generate`, { method: "POST" }),
  getAnalysis: (candidateId: number) =>
    orNull(request<Analysis>(`/candidates/${candidateId}/analysis`)),
};

export type Api = typeof realApi;
export const api: Api = USE_MOCKS ? mockApi : realApi;

export const errorMessage = (e: unknown) =>
  e instanceof ApiError ? e.message : "Something went wrong. Please try again.";
