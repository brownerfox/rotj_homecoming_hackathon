// Used only by mock mode. The real FastAPI server runs the assessment-generation agent defined in
// app/agents/assessment-question-generator.md. This module mirrors that agent's output format so the
// demo produces the same structured questions before the server exists.
import { REQUIREMENT_GROUPS, levelLabel } from "./constants";
import { matchesRequirement } from "./resume-analyzer";
import {
  AS_OF, cachingMaterials, detectDomain, importMaterials, restMaterials, retrievalMaterials, slowPathMaterials,
  sqlMaterials, sqlTasks, type Domain,
} from "./scenarios";
import type { Assessment, CandidateLevel, Difficulty, Language } from "./types";

export interface GeneratedQuestion {
  id: string;
  title: string;
  requirements: string[];
  statement: string;
  explicit_requirements: string[];
  edge_cases: string[];
  constraints: string[];
  tests_required: boolean;
  test_framework: string;
  evaluation_guidance: string[];
  personalization: string | null;
  follow_ups: string[];
  materials: string | null; // schema, sample data and expected output the candidate works from
}

interface Ctx {
  company: string;
  domain: string;
  lang: Language;
  level: CandidateLevel;
  d: Domain;
}

interface Template {
  title: string | ((c: Ctx) => string);
  task: (c: Ctx) => string;
  materials?: (c: Ctx) => string;
  must: string[];
  edge: string[];
}

const titleOf = (t: Template, c: Ctx) => (typeof t.title === "function" ? t.title(c) : t.title);

const TEST_FRAMEWORK: Record<Language, string> = {
  Python: "pytest",
  Java: "JUnit 5",
  JavaScript: "Jest",
  TypeScript: "Vitest",
  "C++": "GoogleTest",
  C: "assert-based test harness",
};

const SCALE: Record<CandidateLevel, string> = {
  intern: "Inputs are small (under 1,000 records). A function signature is provided; clarity and correctness matter more than optimization.",
  entry: "Inputs are moderate (up to 10,000 records). State the time complexity of your approach in a comment.",
  mid: "Inputs may reach 100,000 records. Justify the chosen data structures and state time and space complexity.",
  senior: "Design for 10 million records and concurrent callers. Include a short design note covering trade-offs and what changes at 100x scale.",
};

const DIFFICULTY_NOTE: Record<Exclude<Difficulty, "custom">, string> = {
  easy: "Cover the main path and the listed edge cases.",
  medium: "Cover the main path, the listed edge cases, and explicit error handling.",
  hard: "Cover the main path, edge cases, error handling, and the trade-offs between at least two viable designs.",
};

// Each template maps one company requirement to a concrete problem. Written around a shared domain
// so the problems read as work the company would actually do, not generic trivia.
const TEMPLATES: Record<string, Template> = {
  "Database retrieval": {
    title: (c) => `Recent ${c.d.record} check for a ${c.d.subject}`,
    task: (c) => `${c.company} needs to answer one question quickly: has a ${c.d.subject} placed a completed ${c.d.record} recently? Using the schema below and a repository interface \`db.query(sql, params)\` that returns rows as dictionaries, implement in ${c.lang}: (1) \`has_recent_${c.d.record}(${c.d.fk}, days, as_of)\` returning true or false, and (2) \`list_${c.d.records}(${c.d.fk}, page, page_size)\` returning that ${c.d.subject}'s ${c.d.records}, newest first. Do not load every ${c.d.record} into memory to answer.`,
    materials: (c) => retrievalMaterials(c.d),
    must: ["Answer with a single query that uses a parameter for the id, never string concatenation", "Return results in a stable, documented order", "Support page size and offset or cursor", "Run against the sample data and produce the expected results"],
    edge: ["A subject with no records at all", "A cancelled record inside the window must not count", "Page size of zero or above a sane maximum"],
  },
  SQL: {
    title: (c) => `SQL: find ${c.d.subjects} with recent ${c.d.records}`,
    task: (c) => `${c.company}'s product team asks questions about ${c.d.subjects} and their ${c.d.records} all the time. Write SQL for the tasks below against the schema and sample data provided (any mainstream dialect; say which). Each task must return exactly the expected output.\n\n${sqlTasks(c.d, c.level).tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")}`,
    materials: (c) => sqlMaterials(c.d, c.level),
    must: ["Each query returns exactly the expected rows and columns for the sample data", "Use a join, EXISTS, or a window function appropriately; explain the choice in one sentence", "Only completed records count unless a task says otherwise", `Treat "last 30 days" as the 30 days up to and including ${AS_OF}`],
    edge: ["Someone with no records at all (they must still show up where a task asks for them)", "A cancelled record inside the window", "A record exactly on the first or last day of the window"],
  },
  "REST APIs": {
    title: (c) => `Endpoint: did this ${c.d.subject} ${c.d.record} recently?`,
    task: (c) => `Build the handler for \`GET /${c.d.subjects}/{id}/${c.d.records}/recent?days=30\` at ${c.company}, in ${c.lang} (use the framework named in the starter files, or plain functions if none is named). It reports whether the ${c.d.subject} has a completed ${c.d.record} in the last \`days\` days and returns the most recent one. \`days\` defaults to 30.`,
    materials: (c) => restMaterials(c.d),
    must: ["Return exactly the responses shown in the examples, including the 404 and 422 bodies", "Validate days (1 to 365) and the id; return structured error bodies", "Use GET with no side effects and correct status codes"],
    edge: ["Unknown id", "days of 0, 366, or not a number", "A subject whose only recent record is cancelled"],
  },
  "API design": {
    title: "API design and versioning",
    task: (c) => `Design the public interface for a ${c.domain} capability at ${c.company}: define the resources, request and response shapes, and error model, then implement one endpoint end to end in ${c.lang}.`,
    must: ["Document the contract in a short README or docstring", "Choose consistent naming and pagination conventions", "Explain how a breaking change would be introduced"],
    edge: ["Unknown fields in requests", "Partial updates", "Large collections"],
  },
  Authentication: {
    title: "Token-based authentication",
    task: (c) => `Implement token issuing and verification for ${c.company}'s API in ${c.lang}. Protect a resource so that only an authenticated caller with the right role can read it.`,
    must: ["Never store or log plaintext secrets", "Reject expired and tampered tokens", "Distinguish unauthenticated (401) from unauthorized (403)"],
    edge: ["Missing or malformed Authorization header", "Expired token", "Token for a deleted user"],
  },
  "Data processing": {
    title: "Streaming data cleaning and transformation",
    task: (c) => `${c.company} receives messy ${c.domain} records. Write a ${c.lang} pipeline step that parses, validates, deduplicates, and normalizes the input, and reports what it rejected and why.`,
    must: ["Process input incrementally without loading it all at once", "Produce a reject report with reasons", "Keep the transformation deterministic and re-runnable"],
    edge: ["Malformed rows", "Duplicate keys with conflicting values", "Empty input"],
  },
  "Data modeling": {
    title: "Domain data model",
    task: (c) => `Model the core entities for ${c.company}'s ${c.domain} domain in ${c.lang}, including relationships and invariants, and implement the operations that must keep those invariants true.`,
    must: ["Make invalid states unrepresentable or rejected", "Separate the model from persistence", "Justify one modeling trade-off in a comment"],
    edge: ["Orphaned references", "Concurrent updates to the same entity", "Optional versus required fields"],
  },
  Caching: {
    title: (c) => `Cache the recent-${c.d.record} check`,
    task: (c) => `The \`GET /${c.d.subjects}/{id}/${c.d.records}/recent\` endpoint at ${c.company} is called on every page load, often repeatedly for the same ${c.d.subject}, and is hurting the database. Add a cache in ${c.lang}: results cached per ${c.d.subject} for 60 seconds, bounded in size with an eviction policy, and invalidated immediately when a new ${c.d.record} is created for that ${c.d.subject}.`,
    materials: (c) => cachingMaterials(c.d),
    must: ["Follow the five-step behavior exactly, using a fake clock in tests rather than sleeping", "Bound memory use and name the eviction policy", "Invalidate only the affected key, not the whole cache", "Expose hit and miss counts"],
    edge: ["Many concurrent requests for the same cold key", "A write that arrives while a read is filling the cache", "Eviction of a key that is being read"],
  },
  "Performance optimization": {
    title: (c) => `Speed up the recent-${c.d.records} report`,
    task: (c) => `A job at ${c.company} lists every ${c.d.subject} with a recent completed ${c.d.record}. It works but is far too slow in production. Find the bottleneck, fix it in ${c.lang}, and show with a measurement or complexity argument that the change helped, without changing the results.`,
    materials: (c) => slowPathMaterials(c.d),
    must: ["Explain the bottleneck before changing code", "Keep the output identical for the sample data", "Report before and after query counts or timings", "Say what index, if any, the fix relies on"],
    edge: ["A subject with no records", "A very large subject with many records", "Cancelled records inside the window"],
  },
  "Machine learning": {
    title: "Model evaluation pipeline",
    task: (c) => `Implement a train, evaluate, and report pipeline for a simple model on ${c.domain} data in ${c.lang}, with a proper split and a metric suited to the problem.`,
    must: ["Prevent data leakage between train and test", "Choose and justify an appropriate metric", "Make the run reproducible with a fixed seed"],
    edge: ["Class imbalance", "Missing values", "Tiny datasets"],
  },
  "Natural language processing": {
    title: "Text normalization and matching",
    task: (c) => `Build a ${c.lang} component that normalizes free text from ${c.domain} sources and matches it to a controlled vocabulary, with a confidence score.`,
    must: ["Handle casing, punctuation, and Unicode", "Return a confidence with each match", "Provide a fallback for unmatched text"],
    edge: ["Empty or whitespace-only text", "Ambiguous matches", "Very long input"],
  },
  "Retrieval-Augmented Generation": {
    title: "Retrieval step for a RAG system",
    task: (c) => `Implement the retrieval half of a RAG system for ${c.company} in ${c.lang}: chunk documents, index them, retrieve the top results for a query, and assemble a grounded prompt context within a token budget.`,
    must: ["Chunk with overlap and keep source metadata", "Respect the token budget when assembling context", "Return citations for each retrieved chunk"],
    edge: ["No relevant chunks found", "Duplicate or near-duplicate chunks", "Query longer than the budget"],
  },
  "Vector databases": {
    title: "Similarity search with filtering",
    task: (c) => `Implement similarity search over stored embeddings in ${c.lang}, with a metadata filter and top-k results, using the supplied vector-store interface.`,
    must: ["Apply the metadata filter before or during search, not after truncation", "Handle k larger than the collection", "Document the distance metric used"],
    edge: ["Zero vectors", "Dimension mismatch", "Empty collection"],
  },
  Embeddings: {
    title: "Embedding batching and reuse",
    task: (c) => `Write a ${c.lang} component that embeds a corpus for ${c.company} through a rate-limited provider interface, batching requests and avoiding re-embedding unchanged text.`,
    must: ["Batch within the provider limit", "Skip unchanged inputs using a content hash", "Retry transient failures with backoff"],
    edge: ["Provider returns partial failures", "Empty strings", "Over-length input"],
  },
  "Model integration": {
    title: "Resilient model client",
    task: (c) => `Wrap a hosted model API for ${c.company} in a ${c.lang} client with timeouts, retries, structured output validation, and a clear failure mode for callers.`,
    must: ["Validate model output against a schema", "Retry only retryable errors", "Never leak provider errors to end users"],
    edge: ["Malformed model output", "Timeout mid-response", "Rate limiting"],
  },
  "AI agents": {
    title: "Tool-using agent loop",
    task: (c) => `Implement a minimal agent loop in ${c.lang} that lets a model call two tools to answer a ${c.domain} question, with a step limit and a trace of every decision.`,
    must: ["Enforce a maximum number of steps", "Validate tool arguments before executing", "Return the full trace with the answer"],
    edge: ["Model requests an unknown tool", "Tool raises an error", "Loop without progress"],
  },
  "Data preprocessing": {
    title: "Feature preprocessing",
    task: (c) => `Implement preprocessing for ${c.domain} data in ${c.lang}: imputation, scaling, and encoding, fit on training data only and applied identically at inference time.`,
    must: ["Fit on training data only", "Persist and reload the fitted parameters", "Handle unseen categories at inference"],
    edge: ["All-null columns", "Constant columns", "Unseen category"],
  },
  "Object-oriented programming": {
    title: "Extensible class design",
    task: (c) => `Design and implement a small class hierarchy in ${c.lang} for a ${c.domain} concept at ${c.company} so that adding a new variant requires no changes to existing classes.`,
    must: ["Program to an interface or abstract type", "Avoid type-checking conditionals in client code", "Demonstrate extension with one new variant"],
    edge: ["Invalid construction arguments", "Variants with shared behavior", "Equality and copy semantics"],
  },
  "Functional programming": {
    title: "Pure transformation pipeline",
    task: (c) => `Implement a composable pipeline of pure functions in ${c.lang} that transforms ${c.domain} data without mutating its input.`,
    must: ["Do not mutate inputs", "Compose steps so each is independently testable", "Make side effects explicit at the edges"],
    edge: ["Empty input", "A step that fails", "Large inputs"],
  },
  Algorithms: {
    title: "Algorithm under constraints",
    task: (c) => `Solve a scheduling or ranking problem drawn from ${c.company}'s ${c.domain} work in ${c.lang}, choosing an algorithm that meets the stated bounds.`,
    must: ["State and justify time and space complexity", "Compare against a brute-force baseline in a test", "Handle ties deterministically"],
    edge: ["Empty input", "All elements equal", "Maximum-size input"],
  },
  "Data structures": {
    title: "Custom data structure",
    task: (c) => `Implement a data structure in ${c.lang} that supports the operations ${c.company}'s ${c.domain} workload needs in the stated time bounds, without relying on a library that already provides it.`,
    must: ["Document the complexity of each operation", "Keep internal invariants documented and tested", "Expose a minimal public interface"],
    edge: ["Operations on an empty structure", "Duplicate keys", "Growth beyond initial capacity"],
  },
  "Error handling": {
    title: (c) => `Import partner ${c.d.records} without losing good rows`,
    task: (c) => `${c.company} receives a nightly CSV of ${c.d.records} from a partner. Some rows are bad. Write the import in ${c.lang} so that valid rows are saved, invalid rows are quarantined with a clear reason, a bad row never aborts the whole run, and no row is half-written. Finish with a one-line summary of how many were imported and quarantined.`,
    materials: (c) => importMaterials(c.d),
    must: ["Produce exactly the expected result for the sample file", "Use structured errors with a reason per quarantined row, not bare strings", "Make the import re-runnable without creating duplicates", "Write each row atomically"],
    edge: ["An empty file or a header-only file", "A database failure partway through", "The same file imported twice"],
  },
  Testing: {
    title: "Test a flawed implementation",
    task: (c) => `You are given an implementation with hidden defects. Write a ${c.lang} test suite that exposes them, then fix the code and show the suite passes.`,
    must: ["Tests are independent and deterministic", "Cover boundary values and failure paths", "Each test name states the behavior it checks"],
    edge: ["Time- or randomness-dependent code", "External dependencies that need stubbing", "Off-by-one boundaries"],
  },
  Debugging: {
    title: "Find and fix a defect",
    task: (c) => `A failing scenario is described in the problem files for a ${c.company} service written in ${c.lang}. Reproduce it, find the root cause, fix it, and write a regression test.`,
    must: ["Write the failing test first", "Fix the root cause, not the symptom", "Summarize the cause in two or three sentences"],
    edge: ["Intermittent failure", "Fix that alters a neighboring behavior", "Misleading log output"],
  },
  "Code architecture": {
    title: "Modular refactor",
    task: (c) => `Refactor the tangled ${c.lang} module in the starter files into clear layers (interface, logic, persistence) without changing behavior.`,
    must: ["Existing tests keep passing", "Dependencies point in one direction", "Write a short note explaining the new structure"],
    edge: ["Circular dependencies", "Hidden global state", "Behavior that depended on call order"],
  },
  "Design patterns": {
    title: "Applying a design pattern",
    task: (c) => `Choose and apply a suitable design pattern to a ${c.domain} problem at ${c.company} in ${c.lang}, and explain why it fits better than the simplest alternative.`,
    must: ["Name the pattern and the problem it solves", "Show the simpler alternative and why it falls short", "Avoid pattern use that adds no value"],
    edge: ["Adding a second variant", "Removing the pattern's need entirely", "Testing in isolation"],
  },
  "Cloud computing": {
    title: "Cloud-ready service configuration",
    task: (c) => `Prepare a ${c.lang} service for ${c.company} to run on cloud infrastructure: configuration from the environment, health checks, graceful shutdown, and structured logging.`,
    must: ["No secrets in code or images", "Expose liveness and readiness checks", "Handle termination signals cleanly"],
    edge: ["Missing required configuration", "Dependency down at startup", "In-flight requests during shutdown"],
  },
  "Distributed systems": {
    title: "Idempotent distributed processing",
    task: (c) => `Implement a consumer in ${c.lang} that processes ${c.domain} events delivered at least once, so that duplicates and out-of-order delivery do not corrupt state.`,
    must: ["Deduplicate using an idempotency key", "Handle out-of-order events explicitly", "Document the delivery guarantees assumed"],
    edge: ["Duplicate delivery", "Out-of-order events", "Crash after processing but before acknowledging"],
  },
  Docker: {
    title: "Container build and runtime",
    task: (c) => `Write a Dockerfile and supporting files for the ${c.lang} service in the starter code: small image, non-root user, reproducible build, and a working health check.`,
    must: ["Use a multi-stage or otherwise minimal build", "Run as a non-root user", "Pin dependency and base image versions"],
    edge: ["Build cache invalidation", "Missing environment variables", "Large build context"],
  },
  "CI/CD": {
    title: "Continuous integration pipeline",
    task: (c) => `Define a CI pipeline for the ${c.lang} project that lints, tests, builds, and gates deployment, with caching and clear failure output.`,
    must: ["Fail fast on lint and tests", "Cache dependencies safely", "Separate build from deploy steps"],
    edge: ["Flaky test handling", "Secrets in pull requests from forks", "Rollback path"],
  },
  Networking: {
    title: "Resilient network client",
    task: (c) => `Implement a ${c.lang} client for a flaky upstream service used by ${c.company} with timeouts, bounded retries with jitter, and connection reuse.`,
    must: ["Set connect and read timeouts", "Retry only idempotent requests", "Cap total time spent retrying"],
    edge: ["Slow response", "Connection reset mid-response", "Redirect loops"],
  },
  Scalability: {
    title: "Scale a hot path",
    task: (c) => `A ${c.domain} endpoint at ${c.company} must handle 100x traffic. Propose and implement in ${c.lang} the changes to its hot path, and state the new bottleneck.`,
    must: ["Identify the current bottleneck with reasoning", "Implement at least one concrete change", "State what breaks next and how you would detect it"],
    edge: ["Traffic bursts", "Hot keys", "Dependency slower than the service"],
  },
  "UI development": {
    title: "Interactive UI component",
    task: (c) => `Build an accessible, keyboard-navigable UI component for ${c.company}'s ${c.domain} product in ${c.lang}, including loading, empty, and error states.`,
    must: ["Support keyboard and screen-reader use", "Render loading, empty, and error states", "Keep rendering logic separate from data fetching"],
    edge: ["Very long text", "Slow or failed data load", "Rapid repeated interaction"],
  },
  "State management": {
    title: "Predictable state management",
    task: (c) => `Implement client state for a multi-step ${c.domain} flow in ${c.lang}, with derived values, undo, and no impossible states.`,
    must: ["Model state transitions explicitly", "Derive values instead of duplicating them", "Test transitions without rendering"],
    edge: ["Out-of-order async responses", "Undo past the first state", "Concurrent updates"],
  },
  "API integration": {
    title: "Client-side API integration",
    task: (c) => `Integrate a paginated, occasionally failing API into a ${c.company} ${c.lang} client with caching, cancellation, and retry on user request.`,
    must: ["Cancel stale requests", "Surface errors with a retry action", "Cache results sensibly"],
    edge: ["Slow responses arriving out of order", "Empty pages", "Network offline"],
  },
  "Client-side performance": {
    title: "Client performance fix",
    task: (c) => `The ${c.lang} client in the starter files renders a large ${c.domain} list slowly. Find the causes and fix them, showing measurements before and after.`,
    must: ["Measure before changing anything", "Avoid unnecessary re-renders or recomputation", "Handle large lists incrementally"],
    edge: ["Very large lists", "Rapid filter input", "Low-powered devices"],
  },
  "Component architecture": {
    title: "Reusable component API",
    task: (c) => `Design the public API of a reusable component for ${c.company}'s ${c.domain} product in ${c.lang}, and implement two variants that share it without duplication.`,
    must: ["Keep the component API small and composable", "Document props and defaults", "Avoid coupling to one page's data shape"],
    edge: ["Missing optional props", "Unexpected content size", "Nested usage"],
  },
};

const FALLBACK = (req: string): Template => ({
  title: `${req} in practice`,
  task: (c) => `Implement a focused ${c.lang} solution for ${c.company} that demonstrates "${req}" on a realistic ${c.domain} problem described in the problem files.`,
  must: [`Make the use of "${req}" explicit and justified`, "State assumptions about inputs and constraints", "Keep the solution small enough to review in ten minutes"],
  edge: ["Empty or minimal input", "Invalid input", "Largest expected input"],
});

const GENERAL: Record<CandidateLevel, Template> = {
  intern: {
    title: "Foundational programming exercise",
    task: (c) => `Using ${c.lang}, implement a function that groups and summarizes a list of ${c.domain} records by a key, then returns the top entries.`,
    must: ["Use appropriate built-in collections", "Write clear names and one docstring or comment per function", "Return a new structure instead of mutating the input"],
    edge: ["Empty list", "Ties in the top entries", "Missing key"],
  },
  entry: {
    title: "Foundational programming exercise",
    task: (c) => `Using ${c.lang}, implement a text or record parser for ${c.domain} data with validation, and a function that summarizes the parsed result.`,
    must: ["Separate parsing from summarizing", "Raise or return clear errors for invalid input", "Use idiomatic language features"],
    edge: ["Malformed lines", "Empty input", "Duplicate entries"],
  },
  mid: {
    title: "Foundational programming exercise",
    task: (c) => `Using ${c.lang}, implement a bounded-memory processor for a large stream of ${c.domain} records that maintains running statistics and supports querying them at any time.`,
    must: ["Choose data structures with justified complexity", "Keep memory bounded", "Make the public interface small and testable"],
    edge: ["Empty stream", "Interleaved updates and queries", "Very large values"],
  },
  senior: {
    title: "Foundational programming exercise",
    task: (c) => `Using ${c.lang}, design and implement a thread-safe, bounded-memory component for ${c.domain} data with a clear concurrency model, and document the trade-offs you made.`,
    must: ["State the concurrency model and its guarantees", "Avoid shared mutable state where possible", "Document trade-offs and the rejected alternatives"],
    edge: ["Concurrent readers and writers", "Shutdown while work is in flight", "Back-pressure when the consumer is slow"],
  },
};

const splitCustom = (s: string) =>
  s.split(/[\n;]|,(?![^()]*\))/).map((x) => x.replace(/^[-*\d.)\s]+/, "").trim()).filter(Boolean);

export function allRequirements(a: Pick<Assessment, "technical_requirements" | "custom_technical_requirements">): string[] {
  return [...a.technical_requirements, ...splitCustom(a.custom_technical_requirements)];
}

// One question per requirement up to a cap, so each requirement gets a problem that fits it.
// Ticked requirements beyond the cap are folded into the question closest to them (same group).
// Custom requirements were typed on purpose, so each always gets its own question.
const QUESTION_CAP: Record<Difficulty, number> = { easy: 4, medium: 6, hard: 8, custom: 6 };

function groupRequirements(reqs: string[], custom: string[], difficulty: Difficulty): string[][] {
  const cap = Math.max(1, Math.min(QUESTION_CAP[difficulty], reqs.length));
  const groups = reqs.slice(0, cap).map((r) => [r]);
  const groupOf = (r: string) => REQUIREMENT_GROUPS.find((g) => g.items.includes(r))?.group;
  for (const extra of reqs.slice(cap)) {
    const home = groups.find((g) => groupOf(g[0]) !== undefined && groupOf(g[0]) === groupOf(extra));
    (home ?? groups[groups.length - 1]).push(extra);
  }
  return [...groups, ...custom.map((c) => [c])];
}

function domainOf(a: Assessment): string {
  const focus = [...a.engineering_focus.filter((f) => f !== "Other"), a.engineering_focus_other].filter(Boolean);
  return (focus.join(" / ") || a.position).toLowerCase();
}

// Resume tailoring. Only resume content that overlaps the covered requirements is used; claimed
// experience is probed, never assumed.
function tailorFromResume(a: Assessment, ctx: Ctx, covered: string[]) {
  const none = { stackSentence: "", guidance: [] as string[], note: null as string | null, followUps: [] as string[] };
  const r = a.resume;
  if (!r) return none;
  const stack = r.technologies.filter(
    (t) => t.toLowerCase() !== a.programming_language.toLowerCase() && covered.some((req) => matchesRequirement(t, req)),
  );
  const experience = r.relevant_experience
    .filter((e, i, all) => covered.includes(e.related_requirement) && all.findIndex((x) => x.experience === e.experience && covered.includes(x.related_requirement)) === i)
    .slice(0, 2);
  const stackSentence = stack.length
    ? ` The candidate's resume lists ${stack.slice(0, 2).join(" and ")}: use ${stack.slice(0, 2).join(" or ")} wherever an external system is needed, or explain the equivalent you chose.`
    : "";
  const followUps = experience.map(
    (e) => `Your resume says: "${e.experience}". What trade-offs did you make there, and what would you change for ${ctx.company}'s ${ctx.domain} workload?`,
  );
  const unproven = covered.filter((req) => !r.relevant_experience.some((e) => e.related_requirement === req));
  if (unproven.length) {
    followUps.push(`Your resume does not show ${unproven.join(", ")}. How would you approach it from scratch, and what would you want to learn first?`);
  }
  const guidance = [
    ...(experience.length ? ["Compare the depth of the solution with the experience claimed on the resume; note any gap"] : []),
    ...(unproven.length ? [`No resume evidence for ${unproven.join(", ")}: judge fundamentals, not familiarity`] : []),
  ];
  const note = experience.length
    ? `Candidate reports: ${experience.map((e) => `"${e.experience}"`).join("; ")}. Ask them to explain the decisions they made and how this solution differs from that work. Do not assume expertise from the resume.`
    : null;
  return { stackSentence, guidance, note, followUps };
}

export function generateQuestions(a: Assessment): GeneratedQuestion[] {
  const ctx: Ctx = {
    company: a.company_name || "the company", domain: domainOf(a), lang: a.programming_language, level: a.candidate_level,
    d: detectDomain([a.company_purpose, a.position, a.engineering_focus.join(" "), a.engineering_focus_other, a.custom_instructions, a.custom_technical_requirements].join(" ")),
  };
  const reqs = allRequirements(a);
  const testFramework = TEST_FRAMEWORK[a.programming_language];
  const testsRequired = a.difficulty !== "easy";
  const guidanceBase = [
    "Correctness against the explicit requirements and edge cases",
    "Code quality and readability",
    "Algorithmic efficiency relative to the stated scale",
    "Edge-case handling",
    `Tests (${testsRequired ? "required" : "optional"})`,
    "Maintainability",
  ];
  const managerFocus = a.custom_instructions.trim();
  const calibration = a.difficulty === "custom"
    ? `Custom difficulty requested: ${a.custom_difficulty}.`
    : DIFFICULTY_NOTE[a.difficulty];

  const build = (id: string, t: Template, covered: string[], title: string, extra: string[] = []): GeneratedQuestion => {
    const tailoring = tailorFromResume(a, ctx, covered);
    return {
      id,
      title,
      requirements: covered,
      statement: t.task(ctx) + tailoring.stackSentence,
      materials: t.materials ? t.materials(ctx) : null,
      explicit_requirements: [...t.must, ...extra],
      edge_cases: t.edge,
      constraints: [SCALE[a.candidate_level], calibration, `Solve in ${a.programming_language} without a proprietary environment.`],
      tests_required: testsRequired,
      test_framework: testFramework,
      evaluation_guidance: [
        ...guidanceBase,
        ...(managerFocus ? [`Hiring manager emphasis: ${managerFocus}`] : []),
        ...tailoring.guidance,
      ],
      personalization: tailoring.note,
      follow_ups: tailoring.followUps,
    };
  };

  const questions: GeneratedQuestion[] = [];
  if (reqs.length) {
    const groups = groupRequirements(a.technical_requirements, splitCustom(a.custom_technical_requirements), a.difficulty);
    groups.forEach((covered, i) => {
      const primary = TEMPLATES[covered[0]] ?? FALLBACK(covered[0]);
      const secondary = covered.slice(1).map((r) => `Also demonstrate "${r}" in the same solution`);
      const title = covered.length > 1 ? `${titleOf(primary, ctx)} (with ${covered.slice(1).join(", ")})` : titleOf(primary, ctx);
      questions.push(build(`Q${i + 1}`, primary, covered, title, secondary));
    });
  }
  if (a.general_programming_questions) {
    const g = GENERAL[a.candidate_level];
    // The general question is not tied to the resume, so it carries no tailoring.
    questions.push({ ...build(`Q${questions.length + 1}`, g, reqs.slice(0, 1), `${titleOf(g, ctx)} (${a.programming_language})`), follow_ups: [], personalization: null });
  }
  return questions;
}

export function renderQuestionsMarkdown(a: Assessment): string {
  const qs = generateQuestions(a);
  if (!qs.length) return "_No questions could be generated. Add at least one technical requirement._";
  const bullets = (xs: string[]) => xs.map((x) => `- ${x}`).join("\n");
  const matrix = allRequirements(a).map((r) => `| ${r} | ${qs.filter((q) => q.requirements.includes(r)).map((q) => q.id).join(", ") || "-"} |`);
  const body = qs.map((q) => `### ${q.id} - ${q.title}

**Maps to:** ${q.requirements.join(", ") || "General programming"}
**Tests required:** ${q.tests_required ? `Yes (${q.test_framework})` : "No (optional)"}

**Problem statement**

${q.statement}
${q.materials ? `
**Sample data and expected behavior**

${q.materials}
` : ""}
**Explicit requirements**

${bullets(q.explicit_requirements)}

**Edge cases to handle**

${bullets(q.edge_cases)}

**Constraints**

${bullets(q.constraints)}

**Evaluation guidance**

${bullets(q.evaluation_guidance)}
${q.follow_ups.length ? `\n**Resume-tailored follow-up questions**\n\n${bullets(q.follow_ups)}\n` : ""}${q.personalization ? `\n**Personalization note:** ${q.personalization}\n` : ""}`).join("\n");
  return `Level: ${levelLabel(a.candidate_level)}. Language: ${a.programming_language}. ${qs.length} question${qs.length === 1 ? "" : "s"}.

### Requirement coverage

| Company requirement | Covered by |
| --- | --- |
${matrix.join("\n")}

${body}`;
}

// Consolidated section for the interviewer, placed beside the hiring manager's context in the spec.
export function renderFollowUpsMarkdown(a: Assessment): string {
  if (!a.resume) return "No resume was provided, so no resume-tailored questions were generated.";
  const qs = generateQuestions(a).filter((q) => q.follow_ups.length);
  if (!qs.length) return "The resume has no overlap with the selected requirements, so no resume-tailored questions were generated.";
  // One resume bullet can back several requirements; ask about it once, under the first question it fits.
  const quoted = new Set<string>();
  const blocks = qs
    .map((q) => ({
      q,
      asks: q.follow_ups.filter((f) => {
        const quote = /^Your resume says: "(.*?)"\./.exec(f)?.[1];
        if (!quote) return true;
        if (quoted.has(quote)) return false;
        quoted.add(quote);
        return true;
      }),
    }))
    .filter(({ asks }) => asks.length)
    .map(({ q, asks }) => `**${q.id} - ${q.title}**\n\n${asks.map((f, n) => `${n + 1}. ${f}`).join("\n")}`);
  return [
    "Ask these after the candidate submits. Each quotes the resume and probes the decisions behind it. Do not assume expertise from the resume.",
    ...blocks,
    "**For any question:** Which part of your solution is closest to work you have done before, and which part was new to you?",
  ].join("\n\n");
}
