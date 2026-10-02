// Mock of the FastAPI server (API_CONTRACT.md) so the whole demo works without it. Data is kept
// in the browser's localStorage. Sign-in always uses this file, even when the real server is on,
// because the server has no auth for the hackathon.
import { ApiError } from "./api-error";
import { nameFromResume } from "./candidate-name";
import { MAX_PER_TYPE, QUESTION_TYPES, QUESTION_TYPE_LABELS } from "./constants";
import type {
  AuthResponse, Candidate, CandidateDetail, CandidateQuestion, CodingChallenge, CodingChallengeUpdate,
  ExistingQuestionFile, Job, JobInput, JobQuestionCount, QuestionType, Role, User,
} from "./types";
import { pdfProblem } from "./utils";

interface Db {
  users: (User & { password: string })[];
  currentUserId: string | null;
  jobs: Job[];
  files: ExistingQuestionFile[];
  candidates: CandidateDetail[];
  lastId: number; // one counter for every record, so ids never repeat
}

// The settings a generation run uses, copied at upload time like the server does.
type JobSnapshot = Pick<Job, "questions" | "starter_code">;

const KEY = "tap_mock_db_v6";
const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const newId = (db: Db) => ++db.lastId;
const TYPE_ORDER = new Map(QUESTION_TYPES.map((t, i) => [t.value, i]));
const byType = <T extends { type: QuestionType }>(rows: T[]) =>
  [...rows].sort((a, b) => (TYPE_ORDER.get(a.type) ?? 0) - (TYPE_ORDER.get(b.type) ?? 0));

// ---------------------------------------------------------------- Sample job

const SAMPLE_POSTING = `Northwind Analytics builds a data platform that lets logistics companies query shipment telemetry in real time.

Qualifications
- 3+ years building backend services in Python
- Strong SQL and experience with PostgreSQL
- Experience designing and operating REST APIs

Description
You will join the Query API team. The team owns the endpoints customers use to look up shipment events, and the caching and indexing behind them.

Preferences
- Experience with Redis or another cache
- Experience tuning slow queries on large tables

About the team
The Query API team is six engineers across three time zones. Most of our pain is slow queries for our largest tenants. We rely on written reasoning in pull requests because we are rarely online at the same time.`;

const SAMPLE_CODING_BRIEF = `The new hire spends their first quarter on pagination and caching for the shipment lookup endpoints. A small version of that would be ideal. Past hires struggled to explain the trade-offs behind their code, so ask them to write down their reasoning.`;

const SAMPLE_EXISTING_QUESTIONS = `1. Tell me about yourself and why you want this role.
2. Describe a project you are proud of and your part in it.
3. How do you decide what to work on when everything is urgent?
4. What is the difference between a process and a thread?`;

// ---------------------------------------------------------------- Sample questions

// Written for the two sample candidates' resumes.
const QUESTIONS_JORDAN: Partial<Record<QuestionType, string[]>> = {
  debugging: ["A customer reports that a shipment lookup shows stale results after an update. Your resume says you added Redis caching at Brightline. Walk me through how you would find out whether the cache is the cause."],
  behavioral: ["Tell me about a pull request where a reviewer disagreed with your approach. What did you write to explain your reasoning?"],
  situational: ["Our largest tenant's lookup is timing out, and the teammate who owns it is offline for the next eight hours. What do you do, and what do you write down for them?"],
  system_design: ["You built a retrieval pipeline on a vector database. How would you design pagination and caching for shipment lookups on a tenant with 50 million rows?"],
};

const QUESTIONS_RILEY: Partial<Record<QuestionType, string[]>> = {
  debugging: ["During your internship you wrote reporting queries on PostgreSQL. Tell me about a query that returned the wrong numbers and how you tracked down why."],
  behavioral: ["Describe a time you had to explain a technical decision in writing to someone who was not online with you."],
  situational: ["You are asked to speed up a slow query on a table far larger than any you have worked with. What are your first three steps?"],
  system_design: ["Your course scheduler API returned full lists. How would you redesign one endpoint so a client can page through thousands of results?"],
};

// Demo mode cannot read a resume, so new candidates get these general samples, three per type.
// Beyond that, numbered stand-ins keep the count right. The real server writes every question
// from the candidate's resume and the job.
const SAMPLE_QUESTIONS: Record<QuestionType, string[]> = {
  debugging: [
    "A request that normally takes 200 ms now takes 5 seconds for one customer only. Walk me through how you would find the cause.",
    "You deploy a change and error rates rise slowly over an hour. What do you check first, and in what order?",
    "Tell me about the hardest bug you have tracked down. How did you narrow it?",
  ],
  behavioral: [
    "Tell me about a time a reviewer disagreed with your approach. What did you do?",
    "Describe a project that did not go to plan. What did you change afterward?",
    "Tell me about a time you had to learn something quickly to finish a task.",
  ],
  situational: [
    "A teammate who owns a failing service is offline for eight hours. What do you do, and what do you write down for them?",
    "You are given a task with unclear requirements and a deadline this week. How do you start?",
    "You find a serious problem in code that has already shipped. What are your first three steps?",
  ],
  technical: [
    "What happens, step by step, when a database query uses an index?",
    "Explain optimistic and pessimistic locking, and when you would use each.",
    "How does HTTP caching with ETags work, and what problem does it solve?",
  ],
  system_design: [
    "How would you design pagination and caching for a lookup that serves very large customers?",
    "Design a service that accepts file uploads and makes them searchable. What are the main parts?",
    "How would you add rate limiting to a public API without hurting your largest users?",
  ],
  resume_deep_dive: [
    "Pick the project on your resume you know best. What was the hardest decision in it, and what did you choose?",
    "Your resume lists several technologies. Which one have you used most deeply, and what limit of it did you run into?",
    "Take one result claimed on your resume. How was it measured, and what was your part in it?",
  ],
  code_review: [
    "You are reviewing a change that works but has no tests and one very long function. What feedback do you give, and how do you word it?",
    "A teammate fixes a bug by adding a special case. What do you ask before approving it?",
    "What do you look for first when reviewing code that touches a database query?",
  ],
  data_modeling: [
    "How would you model customers, orders, and shipments so that a shipment's history can be queried quickly?",
    "A table has grown to hundreds of millions of rows. What would you change in its design, and what would you leave alone?",
    "When would you store data in a JSON column instead of separate tables? Give an example of each.",
  ],
  testing_strategy: [
    "How would you test a paginated lookup endpoint? Name the cases you would cover first.",
    "A feature depends on an outside service that is slow and sometimes fails. How do you test it reliably?",
    "What would you automate before a weekly release, and what would you still check by hand?",
  ],
  motivation: [
    "What about this role made you apply, and what do you hope to be doing in it after six months?",
    "What kind of work gives you the most energy, and what kind drains it?",
    "Why this company's problem space, compared with others you could work in?",
  ],
  leadership: [
    "Tell me about a time you led a piece of work without being the manager. How did you get people aligned?",
    "Describe a time you gave a teammate difficult feedback. What happened next?",
    "How do you decide what your team should not work on?",
  ],
};

// For each type the job asks for, as many questions as it asks for, in type order.
// A candidate's own sample questions are used first, then the general samples.
function sampleQuestions(counts: JobQuestionCount[], own: Partial<Record<QuestionType, string[]>> = {}) {
  return byType(counts).flatMap(({ type, count }) => {
    const pool = [...(own[type] ?? []), ...SAMPLE_QUESTIONS[type]];
    return Array.from({ length: count }, (_, i) => ({
      type,
      prompt: pool[i] ?? `Demo stand-in for ${QUESTION_TYPE_LABELS[type].toLowerCase()} question ${i + 1}. The real server writes this one from the resume.`,
    }));
  });
}

// ---------------------------------------------------------------- Sample coding challenge

const problemStatement = (withStarter: boolean) => `# Paginated shipment lookup

Northwind customers page through shipment events for their own account. Build the function behind that lookup.

${withStarter
  ? "Starter code is provided in `solution.py`. Complete `list_shipments`."
  : "No starter code is provided. Create `solution.py` with a `ShipmentEvent` dataclass (`id`, `tenant_id`, `status`), a `MAX_LIMIT` of 100, and a `list_shipments` function. The design is up to you."}

## Requirements

- \`list_shipments(events, tenant_id, cursor=None, limit=50)\` returns \`(page, next_cursor)\`.
- Only events for \`tenant_id\` are returned, ordered by \`id\` ascending.
- \`cursor\` is the \`id\` of the last event on the previous page. Results start after it.
- \`next_cursor\` is \`None\` when there are no more results.
- A \`limit\` below 1 or above \`MAX_LIMIT\` raises \`ValueError\`.
${withStarter ? "\n## Running the tests\n\nPut `test_solution.py` next to `solution.py` and run `pytest`.\n" : ""}
## Document your work

Write down your implementation plan before you start, note any change of direction while you work, and describe your final approach when you finish.`;

const SKELETON_CODE = `from dataclasses import dataclass

MAX_LIMIT = 100


@dataclass(frozen=True)
class ShipmentEvent:
    id: int
    tenant_id: str
    status: str


def list_shipments(events, tenant_id, cursor=None, limit=50):
    """Return (page, next_cursor) for one tenant, ordered by id ascending."""
    raise NotImplementedError
`;

const TEST_CODE = `import pytest

from solution import ShipmentEvent, list_shipments

EVENTS = [ShipmentEvent(i, "acme" if i % 2 else "globex", "in_transit") for i in range(1, 21)]


def test_returns_only_the_tenants_events():
    page, _ = list_shipments(EVENTS, "acme", limit=100)
    assert {e.tenant_id for e in page} == {"acme"}
    assert len(page) == 10


def test_pages_do_not_overlap():
    first, cursor = list_shipments(EVENTS, "acme", limit=4)
    second, _ = list_shipments(EVENTS, "acme", cursor=cursor, limit=4)
    assert [e.id for e in first] == [1, 3, 5, 7]
    assert [e.id for e in second] == [9, 11, 13, 15]


def test_last_page_has_no_cursor():
    _, cursor = list_shipments(EVENTS, "acme", limit=100)
    assert cursor is None


def test_limit_is_capped():
    with pytest.raises(ValueError):
        list_shipments(EVENTS, "acme", limit=101)
`;

const REFERENCE_SOLUTION = `from dataclasses import dataclass

MAX_LIMIT = 100


@dataclass(frozen=True)
class ShipmentEvent:
    id: int
    tenant_id: str
    status: str


def list_shipments(events, tenant_id, cursor=None, limit=50):
    """Return (page, next_cursor) for one tenant, ordered by id ascending."""
    if not 1 <= limit <= MAX_LIMIT:
        raise ValueError(f"limit must be between 1 and {MAX_LIMIT}")
    matching = sorted(
        (e for e in events if e.tenant_id == tenant_id and (cursor is None or e.id > cursor)),
        key=lambda e: e.id,
    )
    page = matching[:limit]
    next_cursor = page[-1].id if len(matching) > limit else None
    return page, next_cursor
`;

// ---------------------------------------------------------------- Generation stand-in

// What the server's generation writes for one candidate, using the sample content above.
function fillInterview(db: Db, c: CandidateDetail, job: JobSnapshot, own: Partial<Record<QuestionType, string[]>> = {}) {
  const stamp = { created_at: now(), updated_at: now() };
  c.name = c.name ?? nameFromResume("", c.resume_file_name);
  c.questions = sampleQuestions(job.questions, own).map((q) => ({ ...q, id: newId(db), ...stamp }));
  c.coding_challenge = {
    id: newId(db), ...stamp, language: "python",
    prompt: problemStatement(job.starter_code),
    starter_code: job.starter_code ? SKELETON_CODE : null,
    tests: job.starter_code ? TEST_CODE : null,
    solution_code: REFERENCE_SOLUTION,
  };
  c.status = "ready";
  c.error = null;
}

// Stands in for the server's background generation: each candidate goes pending, then generating,
// then ready, a few seconds apart. On upload, a resume whose file name contains "fail" fails
// instead, so the failed state and Retry can be tried in demo mode.
function simulateGeneration(ids: number[], job: JobSnapshot, { allowFailure }: { allowFailure: boolean }) {
  ids.forEach((id, i) => {
    setTimeout(() => change(id, (c) => { c.status = "generating"; }), 600 + i * 500);
    setTimeout(() => change(id, (c, db) => {
      if (allowFailure && /fail/i.test(c.resume_file_name)) {
        c.status = "failed";
        c.error = "Demo mode: this file name contains \"fail\", so generation was made to fail. Retry it.";
      } else {
        fillInterview(db, c, job);
      }
    }), 2500 + i * 1200);
  });
}

function change(id: number, fn: (c: CandidateDetail, db: Db) => void) {
  const db = load();
  const c = db.candidates.find((x) => x.id === id);
  if (!c) return; // deleted while waiting
  fn(c, db);
  c.updated_at = now();
  save(db);
}

// ---------------------------------------------------------------- Seed data

function seed(): Db {
  const db: Db = { users: [], currentUserId: null, jobs: [], files: [], candidates: [], lastId: 0 };
  const created = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString();
  const job: Job = {
    id: newId(db),
    title: "Backend Software Engineer",
    description: SAMPLE_POSTING,
    skills: ["Python", "PostgreSQL", "REST APIs", "Caching", "Written communication"],
    existing_questions: SAMPLE_EXISTING_QUESTIONS,
    coding_brief: SAMPLE_CODING_BRIEF,
    starter_code: true,
    questions: [
      { type: "debugging", count: 1 }, { type: "behavioral", count: 1 },
      { type: "situational", count: 1 }, { type: "system_design", count: 1 },
    ],
    created_at: created,
    updated_at: created,
  };
  db.jobs.push(job);

  const candidate = (name: string | null, file: string, resume: string): CandidateDetail => ({
    id: newId(db), job_id: job.id, name, resume_file_name: file, resume_text: resume, status: "pending",
    error: null, questions: [], coding_challenge: null, created_at: created, updated_at: created,
  });
  const jordan = candidate("Jordan Patel", "jordan_patel_resume.pdf",
    "Jordan Patel. Backend engineer, 4 years. Brightline: built FastAPI services on PostgreSQL, cut p95 latency 40% with Redis caching. Side project: retrieval pipeline on a vector database.");
  fillInterview(db, jordan, job, QUESTIONS_JORDAN);
  const riley = candidate("Riley Chen", "riley_chen_cv.pdf",
    "Riley Chen. New graduate, B.S. Computer Science. Internship: reporting queries on PostgreSQL. Course project: REST API for a university course scheduler in Python.");
  // Generated while the job had starter code turned off, so Riley's challenge has none (and no tests).
  fillInterview(db, riley, { ...job, starter_code: false }, QUESTIONS_RILEY);
  const failed = candidate(null, "scan_0042.pdf", "J. Smith. Data engineer. Built Airflow pipelines feeding a Snowflake warehouse.");
  failed.status = "failed";
  failed.error = "Claude's rate limit was hit. Retry in a minute.";
  db.candidates.push(jordan, riley, failed);
  return db;
}

// ---------------------------------------------------------------- Storage helpers

function load(): Db {
  const raw = window.localStorage.getItem(KEY);
  if (raw) { try { return JSON.parse(raw) as Db; } catch { /* reseed */ } }
  const db = seed();
  save(db);
  return db;
}
const save = (db: Db) => window.localStorage.setItem(KEY, JSON.stringify(db));

const publicUser = (u: User & { password: string }): User => {
  const { password: _p, ...rest } = u;
  return rest;
};

// The list endpoints return candidates without their resume text, questions, or challenge.
const summary = ({ resume_text: _r, questions: _q, coding_challenge: _c, ...rest }: CandidateDetail): Candidate => rest;

function requireUser(db: Db) {
  const u = db.users.find((x) => x.id === db.currentUserId);
  if (!u) throw new ApiError(401, "Your session has expired. Please sign in again.");
  return u;
}

function findJob(db: Db, id: number) {
  const j = db.jobs.find((x) => x.id === id);
  if (!j) throw new ApiError(404, "This job could not be found.");
  return j;
}

function findCandidate(db: Db, id: number) {
  const c = db.candidates.find((x) => x.id === id);
  if (!c) throw new ApiError(404, "This candidate could not be found.");
  return c;
}

// The same rules the server applies to a job.
function checkJob(d: JobInput) {
  if (!d.title.trim() || !d.description.trim()) throw new ApiError(422, "Role and job description are required.");
  const types = d.questions.map((q) => q.type);
  if (new Set(types).size !== types.length) throw new ApiError(422, "Each question type can be listed only once.");
  if (d.questions.some((q) => q.count < 1 || q.count > MAX_PER_TYPE))
    throw new ApiError(422, `Each question type takes 1 to ${MAX_PER_TYPE} questions.`);
}

// ---------------------------------------------------------------- Mock API

export const mockApi = {
  async register(d: { name: string; email: string; password: string; role: Role; company_name: string }): Promise<AuthResponse> {
    await delay();
    const db = load();
    if (db.users.some((u) => u.email.toLowerCase() === d.email.toLowerCase()))
      throw new ApiError(409, "An account with this email already exists.");
    const user = { id: uid(), ...d };
    db.users.push(user);
    db.currentUserId = user.id;
    save(db);
    return { access_token: `mock.${user.id}`, user: publicUser(user) };
  },
  async login(d: { email: string; password: string }): Promise<AuthResponse> {
    await delay();
    const db = load();
    const u = db.users.find((x) => x.email.toLowerCase() === d.email.toLowerCase() && x.password === d.password);
    if (!u) throw new ApiError(401, "Incorrect email or password.");
    db.currentUserId = u.id;
    save(db);
    return { access_token: `mock.${u.id}`, user: publicUser(u) };
  },
  // Demo mode only: signs in as a built-in sample user, so no account is needed.
  async demoLogin(): Promise<AuthResponse> {
    await delay(150);
    const db = load();
    let u = db.users.find((x) => x.id === "demo");
    if (!u) {
      // The password is random and never shown, so this user cannot be reached through the form.
      u = { id: "demo", name: "Demo User", email: "demo@fit2hire.test", role: "hiring_manager", company_name: "Northwind Analytics", password: uid() };
      db.users.push(u);
    }
    db.currentUserId = u.id;
    save(db);
    return { access_token: `mock.${u.id}`, user: publicUser(u) };
  },
  async me(): Promise<User> {
    await delay(100);
    return publicUser(requireUser(load()));
  },

  async listJobs(): Promise<Job[]> {
    await delay();
    return load().jobs;
  },
  async getJob(id: number): Promise<Job> {
    await delay(150);
    return findJob(load(), id);
  },
  async createJob(d: JobInput): Promise<Job> {
    await delay();
    checkJob(d);
    const db = load();
    const job: Job = { ...d, questions: byType(d.questions), id: newId(db), created_at: now(), updated_at: now() };
    db.jobs.push(job);
    save(db);
    return job;
  },
  async updateJob(id: number, d: Partial<JobInput>): Promise<Job> {
    await delay();
    const db = load();
    const job = findJob(db, id);
    checkJob({ ...job, ...d });
    Object.assign(job, d, { questions: byType(d.questions ?? job.questions), updated_at: now() });
    save(db);
    return job;
  },

  async listExistingQuestionFiles(jobId: number): Promise<ExistingQuestionFile[]> {
    await delay(150);
    const db = load();
    findJob(db, jobId);
    return db.files.filter((f) => f.job_id === jobId);
  },
  // Demo mode cannot read PDFs, so each file gets a placeholder instead of its text.
  async uploadExistingQuestionFiles(jobId: number, files: File[]): Promise<ExistingQuestionFile[]> {
    await delay(600);
    const db = load();
    findJob(db, jobId);
    const problem = pdfProblem(files);
    if (problem) throw new ApiError(400, problem);
    const rows = files.map((f) => ({
      id: newId(db), job_id: jobId, file_name: f.name, created_at: now(), updated_at: now(),
      text: `[Demo mode] The server would store the text of ${f.name} here.`,
    }));
    db.files.push(...rows);
    save(db);
    return rows;
  },
  async deleteExistingQuestionFile(jobId: number, fileId: number): Promise<void> {
    await delay(150);
    const db = load();
    if (!db.files.some((f) => f.id === fileId && f.job_id === jobId)) throw new ApiError(404, "This file could not be found.");
    db.files = db.files.filter((f) => f.id !== fileId);
    save(db);
  },

  async uploadResumes(jobId: number, files: File[]): Promise<Candidate[]> {
    await delay(600);
    const db = load();
    const job = findJob(db, jobId);
    const problem = pdfProblem(files);
    if (problem) throw new ApiError(400, problem);
    const created: CandidateDetail[] = files.map((f) => ({
      id: newId(db), job_id: jobId, name: null, resume_file_name: f.name, status: "pending", error: null,
      resume_text: `[Demo mode] The server would extract the text of ${f.name} here.`,
      questions: [], coding_challenge: null, created_at: now(), updated_at: now(),
    }));
    db.candidates.push(...created);
    save(db);
    simulateGeneration(created.map((c) => c.id), { questions: job.questions, starter_code: job.starter_code }, { allowFailure: true });
    return created.map(summary);
  },
  async listJobCandidates(jobId: number): Promise<Candidate[]> {
    await delay(150);
    const db = load();
    findJob(db, jobId);
    return db.candidates.filter((c) => c.job_id === jobId).map(summary);
  },
  async listCandidates(): Promise<Candidate[]> {
    await delay();
    return load().candidates.map(summary);
  },
  async retryCandidate(id: number): Promise<Candidate> {
    await delay();
    const db = load();
    const c = findCandidate(db, id);
    if (c.status !== "failed") throw new ApiError(409, "Only candidates whose generation failed can be retried.");
    const job = findJob(db, c.job_id);
    c.status = "pending";
    c.error = null;
    c.updated_at = now();
    save(db);
    simulateGeneration([id], { questions: job.questions, starter_code: job.starter_code }, { allowFailure: false });
    return summary(c);
  },
  async deleteCandidate(id: number): Promise<void> {
    await delay(150);
    const db = load();
    findCandidate(db, id);
    db.candidates = db.candidates.filter((c) => c.id !== id);
    save(db);
  },

  async getCandidate(id: number): Promise<CandidateDetail> {
    await delay(150);
    return findCandidate(load(), id);
  },
  async updateCandidate(id: number, d: { name: string }): Promise<CandidateDetail> {
    await delay();
    if (!d.name.trim()) throw new ApiError(422, "The name can't be empty.");
    const db = load();
    const c = findCandidate(db, id);
    c.name = d.name.trim();
    c.updated_at = now();
    save(db);
    return c;
  },
  async editCandidateQuestion(questionId: number, prompt: string): Promise<CandidateQuestion> {
    await delay();
    if (!prompt.trim()) throw new ApiError(422, "The question can't be empty.");
    const db = load();
    const q = db.candidates.flatMap((c) => c.questions).find((x) => x.id === questionId);
    if (!q) throw new ApiError(404, "This question could not be found.");
    q.prompt = prompt.trim();
    q.updated_at = now();
    save(db);
    return q;
  },
  async editCodingChallenge(candidateId: number, d: CodingChallengeUpdate): Promise<CodingChallenge> {
    await delay();
    const db = load();
    const challenge = findCandidate(db, candidateId).coding_challenge;
    if (!challenge) throw new ApiError(404, "This candidate has no coding challenge yet.");
    const next = { ...challenge, ...d };
    if ((next.starter_code === null) !== (next.tests === null))
      throw new ApiError(400, "Starter code and tests go together: set both or clear both.");
    Object.assign(challenge, d, { updated_at: now() });
    save(db);
    return challenge;
  },
};
