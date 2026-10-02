import { describe, expect, it } from "vitest";
import { allRequirements, generateQuestions, renderQuestionsMarkdown } from "@/lib/question-generator";
import { analyzeResumeText } from "@/lib/resume-analyzer";
import { buildSpecification } from "@/lib/spec-template";
import type { Assessment } from "@/lib/types";

const base: Assessment = {
  id: "t1", name: "Test", company_name: "Acme", company_purpose: "Acme builds logistics software.",
  engineering_focus: ["Backend"], engineering_focus_other: "", position: "Backend Engineer",
  candidate_level: "mid", programming_language: "Python",
  technical_requirements: ["Database retrieval", "REST APIs", "Caching", "Error handling"],
  custom_technical_requirements: "Event sourcing; Rate limiting", general_programming_questions: true,
  difficulty: "medium", custom_difficulty: "", custom_instructions: "Explain reasoning.", candidate_name: "",
  status: "draft", markdown_specification: null, spec_manually_edited: false,
  resume: {
    file_name: "r.pdf", technologies: ["Python"],
    relevant_experience: [{ experience: "Built FastAPI endpoints", related_requirement: "REST APIs" }],
  },
  questions: [], candidates_evaluated: 0, created_at: new Date().toISOString(),
};

describe("question generator", () => {
  it("covers every requirement, including custom ones", () => {
    const qs = generateQuestions(base);
    for (const r of allRequirements(base)) expect(qs.some((q) => q.requirements.includes(r))).toBe(true);
    expect(allRequirements(base)).toContain("Rate limiting");
  });

  it("adds a general question only when enabled", () => {
    expect(generateQuestions(base)).toHaveLength(7);
    expect(generateQuestions({ ...base, general_programming_questions: false })).toHaveLength(6);
  });

  it("scales count and tests with difficulty", () => {
    const easy = generateQuestions({ ...base, difficulty: "easy", general_programming_questions: false });
    expect(easy).toHaveLength(6);
    expect(easy.every((q) => !q.tests_required)).toBe(true);
    expect(generateQuestions({ ...base, difficulty: "hard", general_programming_questions: false })).toHaveLength(6);
  });

  it("personalizes only where the resume overlaps a requirement", () => {
    const qs = generateQuestions(base);
    const personalized = qs.filter((q) => q.personalization);
    expect(personalized.length).toBeGreaterThan(0);
    expect(personalized.every((q) => q.requirements.includes("REST APIs"))).toBe(true);
    expect(generateQuestions({ ...base, resume: null }).every((q) => q.personalization === null)).toBe(true);
  });

  it("embeds the questions in the Markdown specification", () => {
    const md = buildSpecification(base);
    expect(md).toContain("## Generated Assessment Questions");
    expect(md).toContain("### Q1 - ");
    expect(md).toContain("Hiring manager emphasis: Explain reasoning.");
    expect(renderQuestionsMarkdown({ ...base, technical_requirements: [], custom_technical_requirements: "", general_programming_questions: false })).toContain("No questions");
  });

  it("tailors questions from a real resume", () => {
    const resume = analyzeResumeText(
      "r.txt",
      [
        "Jordan Patel",
        "- Designed REST endpoints with FastAPI serving 2M requests per day",
        "- Added a Redis cache that cut p95 latency by 60%",
        "- Tuned PostgreSQL queries for a reporting dashboard",
      ].join("\n"),
      allRequirements(base),
    );
    expect(resume.technologies).toEqual(expect.arrayContaining(["FastAPI", "Redis", "PostgreSQL"]));
    const qs = generateQuestions({ ...base, resume });
    const cache = qs.find((q) => q.requirements.includes("Caching"))!;
    expect(cache.statement).toContain("Redis");
    expect(cache.follow_ups.join(" ")).toContain("Redis cache");
    const gap = qs.find((q) => q.requirements.includes("Error handling"))!;
    expect(gap.follow_ups.join(" ")).toContain("does not show");
    expect(gap.requirements).toEqual(["Error handling"]);
    const md = buildSpecification({ ...base, resume });
    expect(md).toContain("## Resume-Tailored Interview Questions");
    expect(md).toContain("Your resume does not show Error handling");
  });

  it("writes concrete, checkable SQL questions in the company's domain", () => {
    const a = { ...base, company_purpose: "Acme runs an online store where customers place orders.", technical_requirements: ["SQL"], custom_technical_requirements: "", general_programming_questions: false };
    const q = generateQuestions(a)[0];
    expect(q.title).toBe("SQL: find customers with recent orders");
    expect(q.statement).toContain("in the 30 days up to and including 2025-06-30");
    expect(q.materials).toContain("CREATE TABLE customers");
    // Sample data: customers 1, 2 and 4 have a completed order in the window; customer 5 never ordered.
    expect(q.materials).toMatch(/Task 1[\s\S]*\| 1 \| Ava Chen \|[\s\S]*\| 2 \| Ben Ortiz \|[\s\S]*\| 4 \| Dev Patel \|/);
    expect(q.materials).toMatch(/Task 2[\s\S]*\| 5 \| Eli Brown \|/);
    expect(q.materials).toMatch(/Task 3[\s\S]*\| 1 \| Ava Chen \| 2 \| 200\.00 \|/);
  });

  it("scales the SQL tasks with the candidate level and switches domain from the company text", () => {
    const sql = { ...base, technical_requirements: ["SQL"], custom_technical_requirements: "", general_programming_questions: false };
    expect(generateQuestions({ ...sql, candidate_level: "intern" })[0].statement).not.toContain("never placed");
    expect(generateQuestions({ ...sql, candidate_level: "senior" })[0].statement).toContain("window function");
    const ship = generateQuestions({ ...sql, company_purpose: "We track freight shipments for carriers." })[0];
    expect(ship.title).toBe("SQL: find shippers with recent shipments");
  });
});
