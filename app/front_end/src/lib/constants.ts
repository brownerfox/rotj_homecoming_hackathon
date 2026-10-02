import type { AssessmentStatus, CandidateLevel, Difficulty, Language } from "./types";

export const ENGINEERING_AREAS = [
  "Backend", "Frontend", "Full-stack", "Machine Learning / AI", "Data Engineering",
  "DevOps / Cloud", "Mobile", "Systems", "Other",
];

export const LEVELS: { value: CandidateLevel; label: string }[] = [
  { value: "intern", label: "Intern" },
  { value: "entry", label: "Entry-level" },
  { value: "mid", label: "Mid-level" },
  { value: "senior", label: "Senior" },
];

export const LANGUAGES: Language[] = ["Python", "Java", "JavaScript", "TypeScript", "C++", "C"];

export const LANGUAGE_EXTENSIONS: Record<Language, string[]> = {
  Python: [".py"],
  Java: [".java"],
  JavaScript: [".js"],
  TypeScript: [".ts"],
  "C++": [".cpp", ".hpp", ".h"],
  C: [".c", ".h"],
};

export const DIFFICULTIES: { value: Difficulty; label: string }[] = [
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

export const STATUS_LABELS: Record<AssessmentStatus, string> = {
  draft: "Draft",
  specification_generated: "Specification Generated",
  ready_for_candidate: "Ready for Candidate",
  candidate_submitted: "Candidate Submitted",
  evaluation_complete: "Evaluation Complete",
};

export const levelLabel = (l: CandidateLevel) => LEVELS.find((x) => x.value === l)?.label ?? l;
export const difficultyLabel = (d: Difficulty, custom?: string) =>
  d === "custom" ? `Custom${custom ? `: ${custom}` : ""}` : DIFFICULTIES.find((x) => x.value === d)?.label ?? d;

export const CRITERIA = [
  { key: "correctness", label: "Correctness" },
  { key: "code_quality", label: "Code Quality" },
  { key: "algorithmic_efficiency", label: "Algorithmic Efficiency" },
  { key: "edge_case_handling", label: "Edge-Case Handling" },
  { key: "testing", label: "Testing" },
  { key: "maintainability", label: "Maintainability" },
  { key: "requirements_coverage", label: "Requirements Coverage" },
] as const;
