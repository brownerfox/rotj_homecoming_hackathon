// Field shapes for the API contract (API_CONTRACT.md). They mirror the backend's Pydantic
// models in app/back_end/app/schemas.py; change both together.

// ---- Local demo sign-in (no server auth for the hackathon) ----
export type Role = "hiring_manager" | "recruiter";

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  company_name: string;
}

export interface AuthResponse {
  access_token: string;
  user: User;
}

// ---- Shared enums ----
// In display order: questions are always listed by type, in this order (QuestionType in models.py).
export type QuestionType =
  | "debugging" | "behavioral" | "situational" | "technical" | "system_design" | "resume_deep_dive"
  | "code_review" | "data_modeling" | "testing_strategy" | "motivation" | "leadership";
export type ProgrammingLanguage = "python";
export type CandidateStatus = "pending" | "generating" | "ready" | "failed";

interface Stored {
  id: number;
  created_at: string;
  updated_at: string;
}

// ---- Page 1: Job Setup ----
export interface JobQuestionCount {
  type: QuestionType;
  count: number; // 1 to 10
}

export interface JobInput {
  title: string;
  description: string;
  skills: string[];
  // Questions the team already asks, typed in. PDFs of them are ExistingQuestionFile.
  existing_questions: string | null;
  // The hiring manager's notes on what the coding challenge should be like.
  coding_brief: string | null;
  // Whether coding challenges come with starter code and tests. No starter code means no tests.
  starter_code: boolean;
  questions: JobQuestionCount[]; // one entry per type, returned in type order
}

export interface Job extends JobInput, Stored {}

export interface ExistingQuestionFile extends Stored {
  job_id: number;
  file_name: string;
  text: string;
}

// ---- Page 2: Candidates (one per uploaded resume) ----
export interface Candidate extends Stored {
  job_id: number;
  name: string | null; // read from the resume during generation
  resume_file_name: string;
  status: CandidateStatus;
  error: string | null; // why generation failed
}

// ---- Page 3: Interview ----
export interface CandidateQuestion extends Stored {
  type: QuestionType;
  prompt: string;
}

export interface CodingChallenge extends Stored {
  language: ProgrammingLanguage;
  prompt: string; // the problem statement the candidate reads
  starter_code: string | null; // null together with tests
  tests: string | null;
  solution_code: string; // for the hiring team only
}

export type CodingChallengeUpdate = Partial<Pick<CodingChallenge, "prompt" | "starter_code" | "tests" | "solution_code">>;

export interface CandidateDetail extends Candidate {
  resume_text: string | null;
  questions: CandidateQuestion[]; // in type order
  coding_challenge: CodingChallenge | null;
}
