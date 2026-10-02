// Mock implementation of API_CONTRACT.md so the full demo works without the server.
// Data is kept in the browser's localStorage. Sign-in always uses this file, even when
// the real server is on, because the server has no auth for the hackathon.
import { ApiError } from "./api-error";
import type {
  Analysis, AuthResponse, Candidate, CandidateInput, ExtractedText, Interview, InterviewStyle,
  Job, JobInput, PersonalizedQuestion, QuestionType, Role, Submission, User,
} from "./types";

interface Db {
  users: (User & { password: string })[];
  currentUserId: string | null;
  jobs: Job[];
  candidates: Candidate[];
  interviews: Interview[];
  submissions: Submission[];
  analyses: Analysis[];
}

const KEY = "tap_mock_db_v5";
const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);
const now = () => new Date().toISOString();
const nextId = (rows: { id: number }[]) => rows.reduce((max, r) => Math.max(max, r.id), 0) + 1;

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
- Experience tuning slow queries on large tables`;

const SAMPLE_CONTEXT = `The Query API team is six engineers across three time zones. The new hire will spend their first quarter on pagination and caching for the shipment lookup endpoints.

Most of our pain is slow queries for our largest tenants, which the public posting does not mention.

We rely on written reasoning in pull requests because we are rarely online at the same time. Past hires struggled when they could not explain the trade-offs behind their code.`;

const SAMPLE_EXISTING_QUESTIONS = `1. Tell me about yourself and why you want this role.
2. Describe a project you are proud of and your part in it.
3. How do you decide what to work on when everything is urgent?
4. What is the difference between a process and a thread?`;

// ---------------------------------------------------------------- Sample interview

const QUESTIONS_JORDAN: Omit<PersonalizedQuestion, "question_id">[] = [
  {
    type: "debugging",
    text: "A customer reports that a shipment lookup shows stale results after an update. Your resume says you added Redis caching at Brightline. Walk me through how you would find out whether the cache is the cause.",
    rationale: "Resume: Redis caching work at Brightline. Job: caching for the shipment lookup endpoints.",
  },
  {
    type: "behavioral",
    text: "Tell me about a pull request where a reviewer disagreed with your approach. What did you write to explain your reasoning?",
    rationale: "Hiring manager notes: the team works across time zones and relies on written reasoning.",
  },
  {
    type: "situational",
    text: "Our largest tenant's lookup is timing out, and the teammate who owns it is offline for the next eight hours. What do you do, and what do you write down for them?",
    rationale: "Hiring manager notes: slow queries for the largest tenants, and a team that is rarely online at the same time.",
  },
  {
    type: "system_design",
    text: "You built a retrieval pipeline on a vector database. How would you design pagination and caching for shipment lookups on a tenant with 50 million rows?",
    rationale: "Resume: retrieval pipeline project. Hiring manager notes: first-quarter work on pagination and caching.",
  },
];

const QUESTIONS_RILEY: Omit<PersonalizedQuestion, "question_id">[] = [
  {
    type: "debugging",
    text: "During your internship you wrote reporting queries on PostgreSQL. Tell me about a query that returned the wrong numbers and how you tracked down why.",
    rationale: "Resume: PostgreSQL internship. Job: strong SQL.",
  },
  {
    type: "behavioral",
    text: "Describe a time you had to explain a technical decision in writing to someone who was not online with you.",
    rationale: "Hiring manager notes: the team works across time zones and relies on written reasoning.",
  },
  {
    type: "situational",
    text: "You are asked to speed up a slow query on a table far larger than any you have worked with. What are your first three steps?",
    rationale: "Resume: the largest stated experience is internship reporting queries. Hiring manager notes: slow queries for the largest tenants.",
  },
  {
    type: "system_design",
    text: "Your course scheduler API returned full lists. How would you redesign one endpoint so a client can page through thousands of results?",
    rationale: "Resume: course scheduler API project. Job: pagination for the shipment lookup endpoints.",
  },
];

// Demo mode cannot read a resume, so new candidates get these general samples. Each type has
// three written samples. Beyond that, plain numbered stand-ins keep the count correct.
// The real server writes every question from the candidate's resume and the job.
const DEMO_NOTE = "Sample question for demo mode. The real interview ties this to the candidate's resume and the job.";
const SAMPLE_QUESTIONS: Partial<Record<QuestionType, string[]>> = {
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

// Builds the question list for one candidate: for each selected type, as many questions as the
// job asks for. A candidate's own sample questions are used first, then the general samples.
function pickQuestions(job: Job, own: Omit<PersonalizedQuestion, "question_id">[]): Omit<PersonalizedQuestion, "question_id">[] {
  const picked: Omit<PersonalizedQuestion, "question_id">[] = [];
  for (const type of Object.keys(SAMPLE_QUESTIONS) as QuestionType[]) {
    if (!job.question_types.includes(type)) continue;
    const wanted = job.question_counts?.[type] ?? 1;
    const general = (SAMPLE_QUESTIONS[type] ?? []).map((text) => ({ type, text, rationale: DEMO_NOTE }));
    const pool = [...own.filter((q) => q.type === type), ...general];
    // There is no per-type limit, so fill any shortfall with numbered stand-ins.
    for (let n = pool.length + 1; n <= wanted; n++) {
      pool.push({ type, text: `Demo stand-in for ${type.replace(/_/g, " ")} question ${n}. The real server writes this one.`, rationale: DEMO_NOTE });
    }
    picked.push(...pool.slice(0, wanted));
  }
  return picked;
}

const problemStatement = (style: InterviewStyle) => `# Paginated shipment lookup

Northwind customers page through shipment events for their own account. Build the function behind that lookup.

${style === "company_specific"
  ? "Starter code is provided in \`solution.py\`. Complete \`list_shipments\`."
  : "No starter code is provided. Create \`solution.py\` with a \`ShipmentEvent\` dataclass (\`id\`, \`tenant_id\`, \`status\`), a \`MAX_LIMIT\` of 100, and a \`list_shipments\` function. The design is up to you."}

## Requirements

- \`list_shipments(events, tenant_id, cursor=None, limit=50)\` returns \`(page, next_cursor)\`.
- Only events for \`tenant_id\` are returned, ordered by \`id\` ascending.
- \`cursor\` is the \`id\` of the last event on the previous page. Results start after it.
- \`next_cursor\` is \`None\` when there are no more results.
- A \`limit\` below 1 or above \`MAX_LIMIT\` raises \`ValueError\`.

## Running the tests

Put \`test_solution.py\` next to \`solution.py\` and run \`pytest\`.

## Document your work

Your notes are reviewed together with your solution. Use any format you like.

1. Before you write code, write your implementation plan.
2. While you work, note your thought process and any change of direction.
3. When you finish, describe your final approach and why you chose it.`;

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

function sampleInterview(
  candidate: Candidate,
  job: Job,
  own: Omit<PersonalizedQuestion, "question_id">[] = [],
): Interview {
  // Only the question types selected on Page 1 are used, in the quantities chosen there.
  const allowed = pickQuestions(job, own);
  return {
    candidate_id: candidate.id,
    candidate_name: candidate.name,
    position: job.title,
    personalized_questions: allowed.map((q, i) => ({ ...q, question_id: candidate.id * 100 + i + 1 })),
    technical_problem: {
      question_id: candidate.id * 100 + 99,
      language: "python",
      problem_statement: problemStatement(candidate.interview_style),
      skeleton_code: candidate.interview_style === "company_specific" ? SKELETON_CODE : null,
      test_code: TEST_CODE,
      reference_solution: REFERENCE_SOLUTION,
      rationale:
        "Pagination for the shipment lookup endpoints is the new hire's first-quarter work. The problem is a small version of that task and draws on the candidate's API experience.",
    },
    created_at: now(),
  };
}

// ---------------------------------------------------------------- Sample analyses

// A solid submission: the process notes and the code tell the same story.
function solidAnalysis(candidateId: number): Analysis {
  return {
    candidate_id: candidateId,
    created_at: now(),
    technical_analysis: {
      solution_correctness: {
        assessment: "The solution appears to pass all four provided tests. Tenant filtering, ordering, and the cursor logic match the problem statement.",
        evidence: ["`list_shipments` filters on `tenant_id` before slicing the page", "Raises `ValueError` when `limit` is outside 1 to `MAX_LIMIT`"],
      },
      code_quality: {
        assessment: "The code is short and readable, with clear names and no dead code. One helper separates validation from the lookup.",
        evidence: ["`_validate_limit(limit)` is its own function", "Variable names such as `matching` and `next_cursor` describe their contents"],
      },
      documentation: {
        assessment: "Every function has a one-line docstring and the cursor rule is explained in a comment. This is enough for a teammate to pick up.",
        evidence: ["Docstring on `list_shipments` states the return shape", "Comment: \"cursor is exclusive, so start after it\""],
      },
      reusability: {
        assessment: "The lookup takes any iterable of events, so it could be reused for other event types with small changes.",
        evidence: ["`events` is only iterated, never indexed"],
      },
      maintainability: {
        assessment: "A future change such as a new filter would touch one place. The limit rule lives in a single constant.",
        evidence: ["All filtering sits in one generator expression", "`MAX_LIMIT` is referenced, not repeated as a number"],
      },
      technical_decisions: {
        assessment: "The candidate chose cursor pagination over offsets and explained why. That choice matters for large tenants, where offsets get slower with every page.",
        evidence: ["Notes: \"offset pagination rescans skipped rows, so cursor is safer for big tenants\""],
      },
    },
    problem_solving_analysis: {
      implementation_plan: {
        assessment: "The plan was written before coding and lists the steps in the order they were built.",
        evidence: ["Plan: \"1. validate limit 2. filter by tenant 3. sort by id 4. slice and compute next cursor\""],
      },
      planning_efficiency: {
        assessment: "The plan is brief and covers every requirement. Nothing in it went unused.",
        evidence: ["All four plan steps map to lines in the final function"],
      },
      approach_to_problems: {
        assessment: "The candidate worked test by test and noted each failure before fixing it.",
        evidence: ["Notes: \"test_last_page failed, I returned a cursor on the final page, fixed by checking len(matching) > limit\""],
      },
      plan_vs_final_changes: {
        assessment: "One change from the plan: the limit check moved into a helper. The notes record the reason.",
        evidence: ["Notes: \"moved validation out so the main function reads top to bottom\""],
      },
      decision_reasoning: {
        assessment: "Major decisions come with a stated reason, including one trade-off the candidate chose not to solve.",
        evidence: ["Notes: \"sorting every call is O(n log n); in production this would be an indexed query\""],
      },
    },
    role_specific_insights: {
      priority_findings: [
        {
          priority: "Pagination and caching for shipment lookups",
          finding: "The candidate completed the pagination task and named its production limits without being asked.",
          evidence: ["Notes mention replacing the in-memory sort with an indexed query"],
        },
        {
          priority: "Slow queries for the largest tenants",
          finding: "The choice of cursor pagination shows awareness of how page depth affects query cost.",
          evidence: ["Notes: \"offset pagination rescans skipped rows\""],
        },
        {
          priority: "Written reasoning in pull requests",
          finding: "The process notes read like a clear pull request description.",
          evidence: ["Final approach section states what was built, why, and what was left out"],
        },
      ],
      relevant_work_evidence: [
        "Built the same kind of lookup the team will assign in the first quarter",
        "Raised indexing as the next step, which is the team's current pain point",
      ],
      strengths: ["Explains trade-offs in writing", "Keeps solutions small and readable"],
      areas_to_investigate: ["Caching was not part of this problem, so cache invalidation skill is untested here"],
    },
    collaboration_insights: {
      understandability: {
        assessment: "Another developer could follow this code in a few minutes without asking questions.",
        evidence: ["Single function under 15 lines", "Comment explains the one non-obvious rule"],
      },
      documentation_and_communication: {
        assessment: "Notes are dated in sequence and written in full sentences. They would work as an asynchronous handoff.",
        evidence: ["Plan, running notes, and final approach are separate labeled sections"],
      },
      strengths: ["Writes for a reader who was not there", "Records why a change was made, not only what changed"],
      areas_to_investigate: ["How they handle disagreement in review, which a solo exercise cannot show"],
    },
    follow_ups: {
      unexplained_or_inconsistent_decisions: [],
      weak_reasoning_or_documentation: [
        {
          observation: "The notes do not say why events are sorted on every call.",
          evidence: "`sorted(...)` runs each time `list_shipments` is called.",
          suggested_question: "If the input were already ordered by id, what would you change?",
        },
      ],
      needs_more_evidence: [
        {
          observation: "The problem did not cover caching, which is half of the first-quarter work.",
          evidence: "No cache appears in the solution or the notes.",
          suggested_question: "Where would you add a cache to this lookup, and when would you invalidate it?",
        },
      ],
      ai_reliance_signals: [],
    },
  };
}

// A mismatched submission: the code works, but the process notes describe something else.
function mismatchAnalysis(candidateId: number): Analysis {
  return {
    candidate_id: candidateId,
    created_at: now(),
    technical_analysis: {
      solution_correctness: {
        assessment: "The solution appears to pass all four provided tests. The cursor and limit rules are implemented as specified.",
        evidence: ["`bisect_right(ids, cursor)` finds the start position", "`ValueError` raised for limits outside the allowed range"],
      },
      code_quality: {
        assessment: "The code is compact and uses standard library tools well. It is denser than it needs to be for this problem.",
        evidence: ["Uses `bisect_right` and `itertools.islice` in a single expression", "Three operations are chained on one line"],
      },
      documentation: {
        assessment: "There are no docstrings or comments. A reader has to work out the cursor logic alone.",
        evidence: ["`list_shipments` has no docstring", "No comment explains the binary search"],
      },
      reusability: {
        assessment: "The function assumes events arrive sorted by id. That assumption is not stated, which limits safe reuse.",
        evidence: ["`bisect_right` is called on the id list without sorting first"],
      },
      maintainability: {
        assessment: "A teammate changing this would first need to learn why a binary search is used. Nothing in the code or notes explains it.",
        evidence: ["No comment near `bisect_right`", "Notes never mention it"],
      },
      technical_decisions: {
        assessment: "Binary search on a sorted id list is a reasonable choice for speed. The submission gives no reason for choosing it.",
        evidence: ["Decision is visible only in the code"],
      },
    },
    problem_solving_analysis: {
      implementation_plan: {
        assessment: "The plan describes page-number pagination with a simple loop. That is a different design from the one submitted.",
        evidence: ["Plan: \"skip (page - 1) * limit items, then return the next limit items\""],
      },
      planning_efficiency: {
        assessment: "The plan is three lines and does not mention the cursor, the limit cap, or ordering.",
        evidence: ["Plan has no step for validating `limit`"],
      },
      approach_to_problems: {
        assessment: "The notes do not show how problems were worked through. No test failures or fixes are recorded.",
        evidence: ["Thought process section: \"wrote the function and ran the tests, all passed\""],
      },
      plan_vs_final_changes: {
        assessment: "The final code uses a cursor and a binary search. The notes never record moving away from page numbers.",
        evidence: ["Plan uses `page`", "Code signature uses `cursor` and never uses `page`"],
      },
      decision_reasoning: {
        assessment: "No major decision comes with a reason. This matters because the team depends on written reasoning.",
        evidence: ["Final approach section is two sentences and names no trade-off"],
      },
    },
    role_specific_insights: {
      priority_findings: [
        {
          priority: "Pagination and caching for shipment lookups",
          finding: "The submitted code solves the pagination task correctly.",
          evidence: ["All requirements in the problem statement are met in code"],
        },
        {
          priority: "Slow queries for the largest tenants",
          finding: "The code is efficient, but the submission does not show whether the candidate understands why.",
          evidence: ["No mention of performance in the notes"],
        },
        {
          priority: "Written reasoning in pull requests",
          finding: "The written process is thin and does not match the code. This is the team's stated priority and the weakest part of the submission.",
          evidence: ["Plan and code describe different designs"],
        },
      ],
      relevant_work_evidence: ["The final function would work as a starting point for the team's lookup endpoint"],
      strengths: ["Working, efficient solution", "Comfortable with the standard library, if the code is their own"],
      areas_to_investigate: ["Whether the candidate can explain the submitted design", "How they write up decisions for teammates"],
    },
    collaboration_insights: {
      understandability: {
        assessment: "Another developer could run this code but would struggle to change it safely without the missing explanation.",
        evidence: ["Dense one-line expression", "Unstated assumption that input is sorted"],
      },
      documentation_and_communication: {
        assessment: "The notes are brief and generic. They would not work as a handoff to a teammate in another time zone.",
        evidence: ["Notes: \"implemented pagination as required\""],
      },
      strengths: ["Submitted all required documents"],
      areas_to_investigate: ["Written communication habits on real work"],
    },
    follow_ups: {
      unexplained_or_inconsistent_decisions: [
        {
          observation: "The plan uses page numbers and the code uses a cursor.",
          evidence: "Plan: \"skip (page - 1) * limit items\". Code: `list_shipments(events, tenant_id, cursor=None, limit=50)`.",
          suggested_question: "What made you move from page numbers to a cursor?",
        },
      ],
      weak_reasoning_or_documentation: [
        {
          observation: "The final approach section does not mention the limit check or the ordering rule.",
          evidence: "Final approach: \"The function returns a page of results and a cursor. It passes the tests.\"",
          suggested_question: "Walk me through what happens when someone asks for 500 results.",
        },
      ],
      needs_more_evidence: [
        {
          observation: "Nothing shows how the candidate would handle unsorted input.",
          evidence: "`bisect_right` assumes sorted ids and the notes do not address it.",
          suggested_question: "What does your function return if the events arrive out of order?",
        },
      ],
      ai_reliance_signals: [
        {
          observation: "The code relies on a binary search that the process notes never mention.",
          evidence: "Notes: \"loop through the events and count\". Code: `bisect_right(ids, cursor)`.",
          suggested_question: "Can you explain what `bisect_right` does here and why you chose it over a loop?",
        },
        {
          observation: "The thought process notes are generic and could describe any pagination task.",
          evidence: "Notes: \"wrote the function and ran the tests, all passed\".",
          suggested_question: "Which test failed first while you were working, and how did you fix it?",
        },
      ],
    },
  };
}

// ---------------------------------------------------------------- Seed data

function seed(): Db {
  const created = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString();
  const job: Job = {
    id: 1,
    title: "Backend Software Engineer",
    posting_text: SAMPLE_POSTING,
    existing_questions: SAMPLE_EXISTING_QUESTIONS,
    question_types: ["debugging", "behavioral", "system_design", "coding"],
    question_counts: { debugging: 1, behavioral: 1, system_design: 1 },
    context: SAMPLE_CONTEXT,
    created_at: created,
    updated_at: created,
  };
  const jordan: Candidate = {
    id: 1,
    job_id: 1,
    name: "Jordan Patel",
    resume_text:
      "Jordan Patel. Backend engineer, 4 years. Brightline: built FastAPI services on PostgreSQL, cut p95 latency 40% with Redis caching. Side project: retrieval pipeline on a vector database.",
    interview_style: "company_specific",
    status: "analyzed",
    created_at: created,
    updated_at: created,
  };
  const riley: Candidate = {
    id: 2,
    job_id: 1,
    name: "Riley Chen",
    resume_text:
      "Riley Chen. New graduate, B.S. Computer Science. Internship: reporting queries on PostgreSQL. Course project: REST API for a university course scheduler in Python.",
    interview_style: "broad_prompt",
    status: "analyzed",
    created_at: created,
    updated_at: created,
  };
  return {
    users: [],
    currentUserId: null,
    jobs: [job],
    candidates: [jordan, riley],
    interviews: [sampleInterview(jordan, job, QUESTIONS_JORDAN), sampleInterview(riley, job, QUESTIONS_RILEY)],
    submissions: [
      { candidate_id: 1, solution_file_names: ["solution.py"], process_file_names: ["process_notes.md"], created_at: created },
      { candidate_id: 2, solution_file_names: ["solution.py"], process_file_names: ["plan_and_process.txt"], created_at: created },
    ],
    analyses: [solidAnalysis(1), mismatchAnalysis(2)],
  };
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

// Replaces the row for this candidate, so generating or uploading again overwrites.
function upsert<T extends { candidate_id: number }>(rows: T[], row: T) {
  const i = rows.findIndex((r) => r.candidate_id === row.candidate_id);
  if (i >= 0) rows[i] = row; else rows.push(row);
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

  // Plain text files are read for real. Other file types get a placeholder, because
  // reading PDFs is the server's job.
  async extractText(file: File): Promise<ExtractedText> {
    await delay(600);
    const isText = /\.(txt|md)$/i.test(file.name);
    const text = isText
      ? await file.text()
      : `[Demo mode] The server would extract the text of ${file.name} here.`;
    return { file_name: file.name, text };
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
    const db = load();
    const job: Job = { ...d, id: nextId(db.jobs), created_at: now(), updated_at: now() };
    db.jobs.push(job);
    save(db);
    return job;
  },
  async updateJob(id: number, d: Partial<JobInput>): Promise<Job> {
    await delay();
    const db = load();
    const job = findJob(db, id);
    Object.assign(job, d, { updated_at: now() });
    save(db);
    return job;
  },

  async listCandidates(): Promise<Candidate[]> {
    await delay();
    return load().candidates;
  },
  async getCandidate(id: number): Promise<Candidate> {
    await delay(150);
    return findCandidate(load(), id);
  },
  async createCandidate(jobId: number, d: CandidateInput): Promise<Candidate> {
    await delay();
    const db = load();
    findJob(db, jobId);
    const candidate: Candidate = {
      ...d, id: nextId(db.candidates), job_id: jobId, status: "setup", created_at: now(), updated_at: now(),
    };
    db.candidates.push(candidate);
    save(db);
    return candidate;
  },
  async updateCandidate(id: number, d: Partial<CandidateInput>): Promise<Candidate> {
    await delay();
    const db = load();
    const candidate = findCandidate(db, id);
    Object.assign(candidate, d, { updated_at: now() });
    save(db);
    return candidate;
  },

  // Stands in for LLM Call #1. Returns the sample interview with this candidate's details.
  async generateInterview(candidateId: number): Promise<Interview> {
    await delay(2500);
    const db = load();
    const candidate = findCandidate(db, candidateId);
    const interview = sampleInterview(candidate, findJob(db, candidate.job_id));
    upsert(db.interviews, interview);
    candidate.status = "interview_generated";
    save(db);
    return interview;
  },
  async getInterview(candidateId: number): Promise<Interview | null> {
    await delay(150);
    return load().interviews.find((x) => x.candidate_id === candidateId) ?? null;
  },

  async createSubmission(candidateId: number, d: { solutionFiles: File[]; processFiles: File[] }): Promise<Submission> {
    await delay(700);
    const db = load();
    const candidate = findCandidate(db, candidateId);
    const submission: Submission = {
      candidate_id: candidateId,
      solution_file_names: d.solutionFiles.map((f) => f.name),
      process_file_names: d.processFiles.map((f) => f.name),
      created_at: now(),
    };
    upsert(db.submissions, submission);
    candidate.status = "submitted";
    save(db);
    return submission;
  },
  async getSubmission(candidateId: number): Promise<Submission | null> {
    await delay(150);
    return load().submissions.find((x) => x.candidate_id === candidateId) ?? null;
  },

  // Stands in for LLM Call #2. Returns the solid sample analysis for new candidates.
  async generateAnalysis(candidateId: number): Promise<Analysis> {
    await delay(3000);
    const db = load();
    const candidate = findCandidate(db, candidateId);
    if (!db.interviews.some((x) => x.candidate_id === candidateId) || !db.submissions.some((x) => x.candidate_id === candidateId))
      throw new ApiError(400, "Generate the interview and upload the submission first.");
    const analysis = solidAnalysis(candidateId);
    upsert(db.analyses, analysis);
    candidate.status = "analyzed";
    save(db);
    return analysis;
  },
  async getAnalysis(candidateId: number): Promise<Analysis | null> {
    await delay(150);
    return load().analyses.find((x) => x.candidate_id === candidateId) ?? null;
  },
};
