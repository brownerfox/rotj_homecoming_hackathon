import type { CandidateStatus, InterviewStyle, QuestionType } from "./types";

// Options for the Page 1 key priorities dropdown. Coding is not listed because it is
// always included: every interview has a technical problem.
export const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: "debugging", label: "Debugging", description: "Finding and fixing a problem in existing code." },
  { value: "behavioral", label: "Behavioral", description: "Past experience: \"Tell me about a time you...\"" },
  { value: "situational", label: "Situational", description: "Hypothetical scenario: \"What would you do if...\"" },
  { value: "system_design", label: "System design", description: "Open-ended architecture and trade-off discussion." },
  { value: "resume_deep_dive", label: "Resume deep dive", description: "Probing specific projects and claims on the resume." },
  { value: "code_review", label: "Code review", description: "What the candidate looks for and says when reviewing code." },
  { value: "data_modeling", label: "Data modeling", description: "Designing tables, schemas, and relationships." },
  { value: "testing_strategy", label: "Testing strategy", description: "How the candidate would test a feature or system." },
  { value: "motivation", label: "Motivation", description: "Why this role, this company, and this kind of work." },
  { value: "leadership", label: "Leadership", description: "Leading people or projects, and taking ownership." },
];

// The most questions one interview can have, counting the coding problem. There is no
// separate limit for a single type. The page mentions this only once the user reaches it.
export const MAX_TOTAL_QUESTIONS = 20;

// Display names for every type a generated question can carry.
export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  debugging: "Debugging",
  behavioral: "Behavioral",
  situational: "Situational",
  system_design: "System design",
  resume_deep_dive: "Resume deep dive",
  code_review: "Code review",
  data_modeling: "Data modeling",
  testing_strategy: "Testing strategy",
  motivation: "Motivation",
  leadership: "Leadership",
  technical: "Technical",
  coding: "Coding",
};

// Where each candidate is in the flow, for the Page 0 list.
// `page` is the page the candidate is waiting on.
export const CANDIDATE_STATUS: Record<CandidateStatus, { label: string; page: 3 | 4 }> = {
  setup: { label: "Interview not generated", page: 3 },
  interview_generated: { label: "Waiting for the candidate's work", page: 3 },
  submitted: { label: "Ready to analyze", page: 3 },
  analyzed: { label: "Analysis ready", page: 4 },
};

// The two technical interview styles on Page 2. Both include ready-to-run test cases.
export const INTERVIEW_STYLES: { value: InterviewStyle; label: string; description: string }[] = [
  { value: "broad_prompt", label: "Broad technical prompt", description: "An open technical problem with room for design choices. No starter code." },
  { value: "company_specific", label: "Company-specific problem with starter code", description: "A realistic slice of the company's work, with starter code the candidate extends." },
];

// ---------------------------------------------------------------------------
// Used only by the mock question generator (question-generator.ts and
// spec-template.ts), which was written for the earlier design and is not part
// of the Page_WorkFlow.md flow. Remove these together with those files.
// ---------------------------------------------------------------------------
type LegacyLevel = "intern" | "entry" | "mid" | "senior";
type LegacyDifficulty = "easy" | "medium" | "hard" | "custom";

export const LEVELS: { value: LegacyLevel; label: string }[] = [
  { value: "intern", label: "Intern" },
  { value: "entry", label: "Entry-level" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
];

export const DIFFICULTIES: { value: LegacyDifficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
  { value: "custom", label: "Custom" },
];

export const REQUIREMENT_GROUPS: { group: string; items: string[] }[] = [
  { group: "Backend / Data", items: ["Database retrieval", "SQL", "REST APIs", "API design", "Authentication", "Data processing", "Data modeling", "Caching", "Performance optimization"] },
  { group: "AI / ML", items: ["Machine learning", "Natural language processing", "Retrieval-Augmented Generation", "Vector databases", "Embeddings", "Model integration", "AI agents", "Data preprocessing"] },
  { group: "Software Engineering", items: ["Object-oriented programming", "Functional programming", "Algorithms", "Data structures", "Error handling", "Testing", "Debugging", "Code architecture", "Design patterns"] },
  { group: "Infrastructure", items: ["Cloud computing", "Distributed systems", "Docker", "CI/CD", "Networking", "Scalability"] },
  { group: "Frontend", items: ["UI development", "State management", "API integration", "Client-side performance", "Component architecture"] },
];

export const levelLabel = (l: LegacyLevel) => LEVELS.find((x) => x.value === l)?.label ?? l;
export const difficultyLabel = (d: LegacyDifficulty, custom?: string) =>
  d === "custom" ? `Custom${custom ? `: ${custom}` : ""}` : DIFFICULTIES.find((x) => x.value === d)?.label ?? d;
