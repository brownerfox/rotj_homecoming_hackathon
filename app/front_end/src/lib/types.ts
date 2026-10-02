// Field shapes for the API contract (API_CONTRACT.md). The backend's Pydantic
// models must match these. Page behavior is defined in Page_WorkFlow.md.

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
export type QuestionType =
  | "debugging" | "behavioral" | "situational" | "system_design" | "resume_deep_dive" | "code_review"
  | "data_modeling" | "testing_strategy" | "motivation" | "leadership" | "technical" | "coding";
export type ProgrammingLanguage = "python" | "java" | "javascript" | "typescript" | "cpp" | "c";
export type InterviewStyle = "broad_prompt" | "company_specific";
export type CandidateStatus = "setup" | "interview_generated" | "submitted" | "analyzed";

// ---- File upload ----
export interface ExtractedText {
  file_name: string;
  text: string;
}

// ---- Page 1: Job Setup ----
export interface JobInput {
  title: string; // Role
  posting_text: string; // Public posting: qualifications, description, preferences
  question_types: QuestionType[]; // Key priorities dropdown. Always includes "coding".
  // How many questions to generate for each selected type. Coding is not counted here,
  // because it is always the one technical problem.
  question_counts: Partial<Record<QuestionType, number>>;
  // Questions the team already asks every candidate. May be empty. LLM Call #1 must not repeat them.
  existing_questions: string;
  context: string; // Hiring manager context
}

export interface Job extends JobInput {
  id: number;
  created_at: string;
  updated_at: string;
}

// ---- Page 2: Candidate Setup ----
export interface CandidateInput {
  name: string;
  resume_text: string;
  interview_style: InterviewStyle;
}

export interface Candidate extends CandidateInput {
  id: number;
  job_id: number;
  status: CandidateStatus;
  created_at: string;
  updated_at: string;
}

// ---- LLM Call #1 output, shown on Page 3 ----
export interface PersonalizedQuestion {
  question_id: number;
  type: QuestionType; // one of the job's selected question types
  text: string;
  rationale: string; // the resume item and the requirement or priority it targets
}

export interface TechnicalProblem {
  question_id: number;
  language: ProgrammingLanguage;
  // Markdown, handed to the candidate unchanged. Includes how to run the tests and the
  // documentation requirement.
  problem_statement: string;
  skeleton_code: string | null; // Starter code. Null for the broad technical prompt.
  test_code: string; // Ready-to-run test cases
  reference_solution: string; // For the hiring team and LLM Call #2 only. Never given to the candidate.
  rationale: string; // Why this problem fits the job and the candidate
}

export interface Interview {
  candidate_id: number;
  candidate_name: string;
  position: string; // The job's title
  personalized_questions: PersonalizedQuestion[];
  technical_problem: TechnicalProblem;
  created_at: string;
}

// ---- Page 3: Submission ----
export interface Submission {
  candidate_id: number;
  solution_file_names: string[];
  process_file_names: string[];
  created_at: string;
}

// ---- LLM Call #2 output, shown on Page 4 ----
export interface Finding {
  assessment: string;
  evidence: string[];
}

export interface FollowUp {
  observation: string;
  evidence: string;
  suggested_question: string;
}

export interface Analysis {
  candidate_id: number;
  created_at: string;
  technical_analysis: {
    solution_correctness: Finding;
    code_quality: Finding;
    documentation: Finding;
    reusability: Finding;
    maintainability: Finding;
    technical_decisions: Finding;
  };
  problem_solving_analysis: {
    implementation_plan: Finding;
    planning_efficiency: Finding;
    approach_to_problems: Finding;
    plan_vs_final_changes: Finding;
    decision_reasoning: Finding;
  };
  role_specific_insights: {
    priority_findings: { priority: string; finding: string; evidence: string[] }[];
    relevant_work_evidence: string[];
    strengths: string[];
    areas_to_investigate: string[];
  };
  collaboration_insights: {
    understandability: Finding;
    documentation_and_communication: Finding;
    strengths: string[];
    areas_to_investigate: string[];
  };
  follow_ups: {
    unexplained_or_inconsistent_decisions: FollowUp[];
    weak_reasoning_or_documentation: FollowUp[];
    needs_more_evidence: FollowUp[];
    ai_reliance_signals: FollowUp[];
  };
}
