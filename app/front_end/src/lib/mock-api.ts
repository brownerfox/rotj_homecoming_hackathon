// Mock implementation of the FastAPI contract so the full demo works before the
// real server exists. Data is kept in the browser's localStorage.
import { ApiError } from "./api-error";
import { buildSpecification } from "./spec-template";
import type {
  Assessment, AssessmentInput, AuthResponse, Candidate, CoverageResult, Evaluation, EvaluationListItem,
  ResumeInsights, Role, Submission, User,
} from "./types";

interface Db {
  users: (User & { password: string })[];
  assessments: Assessment[];
  candidates: Candidate[];
  submissions: Submission[];
  evaluations: Evaluation[];
  currentUserId: string | null;
}

const KEY = "tap_mock_db_v1";
const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms));
const uid = () => Math.random().toString(36).slice(2, 10);

function seed(): Db {
  const created = new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString();
  const a: Assessment = {
    id: "a1",
    name: "Backend Engineer - Data Retrieval",
    company_name: "Northwind Analytics",
    company_purpose: "Northwind builds a data platform that lets logistics companies query shipment telemetry in real time. Engineers work on ingestion pipelines, query APIs, and retrieval performance.",
    engineering_focus: ["Backend", "Data Engineering"],
    engineering_focus_other: "",
    position: "Backend Software Engineer",
    candidate_level: "mid",
    programming_language: "Python",
    technical_requirements: ["Database retrieval", "REST APIs", "Error handling", "Performance optimization"],
    custom_technical_requirements: "",
    general_programming_questions: true,
    difficulty: "medium",
    custom_difficulty: "",
    custom_instructions: "Test whether the candidate can retrieve data efficiently and explain their reasoning, with appropriate error handling.",
    candidate_name: "Jordan Patel",
    status: "evaluation_complete",
    markdown_specification: null,
    spec_manually_edited: false,
    resume: {
      file_name: "jordan_patel_resume.pdf",
      technologies: ["Python", "PostgreSQL", "FastAPI", "Pinecone", "Redis"],
      relevant_experience: [
        { experience: "Built a RAG application using a vector database", related_requirement: "Database retrieval" },
        { experience: "Designed REST endpoints with FastAPI", related_requirement: "REST APIs" },
      ],
    },
    questions: [
      { id: "Q1", title: "Paginated shipment lookup" },
      { id: "Q2", title: "Cached aggregate endpoint" },
    ],
    candidates_evaluated: 1,
    created_at: created,
  };
  a.markdown_specification = buildSpecification(a);
  const sub: Submission = {
    id: "s1", assessment_id: "a1", candidate_id: "c1", candidate_name: "Jordan Patel",
    candidate_identifier: "CAND-1042", question_id: null, file_name: "solution.zip",
    status: "evaluation_complete", created_at: created,
  };
  return {
    users: [],
    assessments: [a],
    candidates: [{ id: "c1", name: "Jordan Patel", identifier: "CAND-1042", submissions: 1 }],
    submissions: [sub],
    evaluations: [sampleEvaluation("s1", a)],
    currentUserId: null,
  };
}

function sampleEvaluation(submissionId: string, a: Assessment): Evaluation {
  const qs = a.questions.length ? a.questions : [{ id: "Q1", title: "Primary problem" }];
  const crit = (score: number, explanation: string) => ({ score, explanation });
  const questions = qs.map((q, i) => {
    const base = i === 0 ? 0 : -1;
    return {
      question_id: q.id,
      title: q.title,
      overall_score: i === 0 ? 84 : 71,
      weight: 1 / qs.length,
      summary: i === 0
        ? "Solid, correct implementation with clear structure; a few boundary cases unhandled."
        : "Works for the main path but caching invalidation is incomplete.",
      correctness: crit(9 + base, "Produces correct results for the specified inputs."),
      code_quality: crit(8, "Clear naming and well-separated functions."),
      algorithmic_efficiency: crit(7 + base, "Uses an indexed query; one unnecessary full scan remains."),
      edge_case_handling: crit(8 + base, "Handles empty results and invalid page numbers; large offsets not bounded."),
      testing: { ...crit(9 + base, "Unit tests cover main and error paths."), tests_required: true, tests_provided: true },
      maintainability: crit(8, "Another engineer could extend this without significant refactoring."),
      requirements_coverage: crit(9 + base, "Most explicit requirements satisfied."),
      detailed_explanation: "The candidate structured the solution around a repository layer and a thin request handler. Error responses use consistent status codes. Query parameters are validated before use. The main gap is the absence of an upper bound on page size, which could allow expensive queries.",
    };
  });
  const overall = Math.round(questions.reduce((s, q) => s + q.overall_score * q.weight, 0));
  const reqs = a.technical_requirements.length ? a.technical_requirements : ["Requirements coverage"];
  const results = ["met", "met", "partially_met", "not_met"] as const;
  return {
    submission_id: submissionId,
    status: "complete",
    overall_score: overall,
    summary: "The candidate demonstrated solid backend fundamentals and clear code organization.",
    strengths: [
      "Efficient indexed database retrieval with parameterized queries",
      "Consistent, well-structured error handling",
      "Meaningful unit tests covering success and failure paths",
    ],
    concerns: [
      "No upper bound on page size for paginated queries",
      "Cache invalidation is incomplete on write operations",
    ],
    requirements_coverage_summary: `The candidate fully demonstrated ${reqs.filter((_, i) => results[i % 4] === "met").length} of ${reqs.length} company requirements.`,
    question_performance_summary: "Stronger on the retrieval question than on the caching question.",
    requirements_coverage: reqs.map((r, i) => {
      const result: CoverageResult = results[i % 4] ?? "met";
      return {
        requirement: r,
        result,
        note: result === "met" ? "Clearly demonstrated." : result === "partially_met" ? "Present but incomplete." : "Not demonstrated in the submission.",
      };
    }),
    questions,
  };
}

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

function findAssessment(db: Db, id: string) {
  const a = db.assessments.find((x) => x.id === id);
  if (!a) throw new ApiError(404, "This assessment could not be found.");
  return a;
}

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
  async me(): Promise<User> {
    await delay(100);
    return publicUser(requireUser(load()));
  },

  async listAssessments(): Promise<Assessment[]> {
    await delay();
    return [...load().assessments].sort((a, b) => b.created_at.localeCompare(a.created_at));
  },
  async getAssessment(id: string): Promise<Assessment> {
    await delay(150);
    return findAssessment(load(), id);
  },
  async createAssessment(d: AssessmentInput): Promise<Assessment> {
    await delay();
    const db = load();
    const a: Assessment = {
      ...d, id: uid(), status: "draft", markdown_specification: null, spec_manually_edited: false,
      resume: null, questions: [], candidates_evaluated: 0, created_at: new Date().toISOString(),
    };
    db.assessments.push(a);
    save(db);
    return a;
  },
  async updateAssessment(id: string, d: Partial<AssessmentInput> & { status?: Assessment["status"] }): Promise<Assessment> {
    await delay();
    const db = load();
    const a = findAssessment(db, id);
    Object.assign(a, d);
    save(db);
    return a;
  },
  async uploadResume(id: string, file: File): Promise<ResumeInsights> {
    await delay(900);
    const db = load();
    const a = findAssessment(db, id);
    const known = ["Python", "PostgreSQL", "Docker", "React", "FastAPI", "Redis", "AWS", "Vector database"];
    const insights: ResumeInsights = {
      file_name: file.name,
      technologies: known.slice(0, 5),
      relevant_experience: a.technical_requirements.slice(0, 3).map((r) => ({
        experience: `Prior project experience related to ${r.toLowerCase()} (sample data)`,
        related_requirement: r,
      })),
    };
    a.resume = insights;
    save(db);
    return insights;
  },
  async generateSpecification(id: string): Promise<Assessment> {
    await delay(1200);
    const db = load();
    const a = findAssessment(db, id);
    a.markdown_specification = buildSpecification(a);
    a.spec_manually_edited = false;
    a.status = "specification_generated";
    if (!a.questions.length) a.questions = [{ id: "Q1", title: "Question 1" }, { id: "Q2", title: "Question 2" }];
    save(db);
    return a;
  },
  async saveSpecification(id: string, markdown: string): Promise<Assessment> {
    await delay();
    const db = load();
    const a = findAssessment(db, id);
    a.markdown_specification = markdown;
    a.spec_manually_edited = true;
    if (a.status === "specification_generated" || a.status === "draft") a.status = "ready_for_candidate";
    save(db);
    return a;
  },

  async listCandidates(): Promise<Candidate[]> {
    await delay();
    return load().candidates;
  },
  async listSubmissions(assessmentId?: string): Promise<Submission[]> {
    await delay();
    return load().submissions.filter((s) => !assessmentId || s.assessment_id === assessmentId);
  },
  async createSubmission(d: { assessment_id: string; candidate_name: string; candidate_identifier: string; question_id: string | null; file: File }): Promise<Submission> {
    await delay(700);
    const db = load();
    const a = findAssessment(db, d.assessment_id);
    let c = db.candidates.find((x) => x.identifier === d.candidate_identifier);
    if (!c) { c = { id: uid(), name: d.candidate_name, identifier: d.candidate_identifier, submissions: 0 }; db.candidates.push(c); }
    c.submissions += 1;
    const s: Submission = {
      id: uid(), assessment_id: a.id, candidate_id: c.id, candidate_name: c.name,
      candidate_identifier: c.identifier, question_id: d.question_id, file_name: d.file.name,
      status: "evaluating", created_at: new Date().toISOString(),
    };
    db.submissions.push(s);
    a.status = "candidate_submitted";
    save(db);
    return s;
  },
  async getSubmission(id: string): Promise<Submission> {
    await delay(100);
    const s = load().submissions.find((x) => x.id === id);
    if (!s) throw new ApiError(404, "This submission could not be found.");
    return s;
  },
  async getEvaluation(submissionId: string): Promise<Evaluation> {
    await delay(200);
    const db = load();
    const s = db.submissions.find((x) => x.id === submissionId);
    if (!s) throw new ApiError(404, "This submission could not be found.");
    let ev = db.evaluations.find((e) => e.submission_id === submissionId);
    if (!ev) {
      // Simulate the external evaluation finishing a few seconds after upload.
      if (Date.now() - new Date(s.created_at).getTime() < 4000) {
        return {
          submission_id: submissionId, status: "pending", overall_score: null, summary: "", strengths: [],
          concerns: [], requirements_coverage_summary: "", question_performance_summary: "",
          requirements_coverage: [], questions: [],
        };
      }
      const a = findAssessment(db, s.assessment_id);
      ev = sampleEvaluation(submissionId, a);
      db.evaluations.push(ev);
      s.status = "evaluation_complete";
      a.status = "evaluation_complete";
      a.candidates_evaluated += 1;
      save(db);
    }
    return ev;
  },
  async listEvaluations(): Promise<EvaluationListItem[]> {
    await delay();
    const db = load();
    return db.submissions.map((s) => {
      const a = db.assessments.find((x) => x.id === s.assessment_id);
      const ev = db.evaluations.find((e) => e.submission_id === s.id);
      return {
        submission_id: s.id, candidate_name: s.candidate_name, assessment_name: a?.name ?? "Unknown",
        position: a?.position ?? "", overall_score: ev?.overall_score ?? null, status: s.status, created_at: s.created_at,
      };
    }).sort((x, y) => y.created_at.localeCompare(x.created_at));
  },
};
