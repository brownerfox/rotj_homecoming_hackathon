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

export type CandidateLevel = "intern" | "entry" | "mid" | "senior";
export type Language = "Python" | "Java" | "JavaScript" | "TypeScript" | "C++" | "C";
export type Difficulty = "easy" | "medium" | "hard" | "custom";
export type AssessmentStatus =
  | "draft"
  | "specification_generated"
  | "ready_for_candidate"
  | "candidate_submitted"
  | "evaluation_complete";

export interface ResumeInsights {
  file_name: string;
  technologies: string[];
  relevant_experience: { experience: string; related_requirement: string }[];
}

export interface AssessmentInput {
  name: string;
  company_name: string;
  company_purpose: string;
  engineering_focus: string[];
  engineering_focus_other: string;
  position: string;
  candidate_level: CandidateLevel;
  programming_language: Language;
  technical_requirements: string[];
  custom_technical_requirements: string;
  general_programming_questions: boolean;
  difficulty: Difficulty;
  custom_difficulty: string;
  custom_instructions: string;
  candidate_name: string;
}

export interface Assessment extends AssessmentInput {
  id: string;
  status: AssessmentStatus;
  markdown_specification: string | null;
  spec_manually_edited: boolean;
  resume: ResumeInsights | null;
  questions: { id: string; title: string }[];
  candidates_evaluated: number;
  created_at: string;
}

export interface Candidate {
  id: string;
  name: string;
  identifier: string;
  submissions: number;
}

export type SubmissionStatus = "uploaded" | "evaluating" | "evaluation_complete" | "failed";

export interface Submission {
  id: string;
  assessment_id: string;
  candidate_id: string;
  candidate_name: string;
  candidate_identifier: string;
  question_id: string | null;
  file_name: string;
  status: SubmissionStatus;
  created_at: string;
}

export type CoverageResult = "met" | "partially_met" | "not_met";

export interface CriterionScore {
  score: number; // 0-10
  explanation: string;
}

export interface QuestionEvaluation {
  question_id: string;
  title: string;
  overall_score: number; // 0-100
  weight: number;
  summary: string;
  correctness: CriterionScore;
  code_quality: CriterionScore;
  algorithmic_efficiency: CriterionScore;
  edge_case_handling: CriterionScore;
  testing: CriterionScore & { tests_required: boolean; tests_provided: boolean };
  maintainability: CriterionScore;
  requirements_coverage: CriterionScore;
  detailed_explanation: string;
}

export interface Evaluation {
  submission_id: string;
  status: "pending" | "complete" | "failed";
  overall_score: number | null;
  summary: string;
  strengths: string[];
  concerns: string[];
  requirements_coverage_summary: string;
  question_performance_summary: string;
  requirements_coverage: { requirement: string; result: CoverageResult; note: string }[];
  questions: QuestionEvaluation[];
}

export interface EvaluationListItem {
  submission_id: string;
  candidate_name: string;
  assessment_name: string;
  position: string;
  overall_score: number | null;
  status: SubmissionStatus;
  created_at: string;
}
