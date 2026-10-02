import type { CandidateStatus, InterviewStyle, QuestionType } from "./types";

// Options for the Page 1 key priorities dropdown. Values match the backend's question types.
export const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: "behavioral", label: "Behavioral", description: "Past experience: \"Tell me about a time you...\"" },
  { value: "situational", label: "Situational", description: "Hypothetical scenario: \"What would you do if...\"" },
  { value: "technical", label: "Technical", description: "Conceptual knowledge, answered verbally." },
  { value: "system_design", label: "System design", description: "Open-ended architecture and trade-off discussion." },
  { value: "coding", label: "Coding", description: "Hands-on technical problem. Always included." },
];

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
