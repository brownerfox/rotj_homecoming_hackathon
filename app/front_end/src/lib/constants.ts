import type { CandidateStatus, QuestionType } from "./types";

// Options for the Page 1 key priorities dropdown, in display order. The order and descriptions
// mirror QuestionType in app/back_end/app/models.py. The coding challenge is not a type: every
// candidate gets one.
export const QUESTION_TYPES: { value: QuestionType; label: string; description: string }[] = [
  { value: "debugging", label: "Debugging", description: "Talk through finding the cause of a bug or production problem. May include a short code snippet." },
  { value: "behavioral", label: "Behavioral", description: "Past experience: \"Tell me about a time you...\"" },
  { value: "situational", label: "Situational", description: "A hypothetical scenario: \"What would you do if...\"" },
  { value: "technical", label: "Technical", description: "Conceptual knowledge, answered out loud." },
  { value: "system_design", label: "System design", description: "Open-ended architecture and trade-off discussion." },
  { value: "resume_deep_dive", label: "Resume deep dive", description: "Probing specific projects and claims on the resume." },
  { value: "code_review", label: "Code review", description: "What the candidate looks for and says when reviewing code." },
  { value: "data_modeling", label: "Data modeling", description: "Designing tables, schemas, and relationships." },
  { value: "testing_strategy", label: "Testing strategy", description: "How the candidate would test a feature or system." },
  { value: "motivation", label: "Motivation", description: "Why this role, this company, and this kind of work." },
  { value: "leadership", label: "Leadership", description: "Leading people or projects, and taking ownership." },
];

export const QUESTION_TYPE_LABELS = Object.fromEntries(QUESTION_TYPES.map((t) => [t.value, t.label])) as Record<QuestionType, string>;

// The server allows 1 to 10 questions of each type, because every question is generated (and
// paid for) once per candidate.
export const MAX_PER_TYPE = 10;

// Resume and existing-question uploads: PDFs only, up to 10 MB each (the server's limits).
export const MAX_PDF_MB = 10;

// Where each candidate's generation stands. `busy` means the server is still working on it.
export const CANDIDATE_STATUS: Record<CandidateStatus, { label: string; busy: boolean }> = {
  pending: { label: "Waiting to generate", busy: true },
  generating: { label: "Generating", busy: true },
  ready: { label: "Interview ready", busy: false },
  failed: { label: "Generation failed", busy: false },
};
