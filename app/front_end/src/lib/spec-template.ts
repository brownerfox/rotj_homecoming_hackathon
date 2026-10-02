import { difficultyLabel, levelLabel } from "./constants";
import type { Assessment } from "./types";

// Used only by mock mode. The real FastAPI server generates the specification.
export function buildSpecification(a: Assessment): string {
  const focus = [...a.engineering_focus.filter((f) => f !== "Other"), a.engineering_focus_other].filter(Boolean);
  const list = (items: string[]) => (items.length ? items.map((i) => `- ${i}`).join("\n") : "- None specified");
  const r = a.resume;
  return `# Coding Assessment Specification

## Company Context

**Company:** ${a.company_name}

${a.company_purpose || "_No company purpose provided._"}

**Primary engineering application:** ${focus.join(", ") || "Not specified"}

## Position

- **Position:** ${a.position}
- **Candidate level:** ${levelLabel(a.candidate_level)}

## Programming Language

All solutions must be written in **${a.programming_language}**.

## Difficulty

- **Desired difficulty:** ${difficultyLabel(a.difficulty, a.custom_difficulty)}
- **Calibration:** Difficulty must be interpreted relative to a ${levelLabel(a.candidate_level)} candidate. A "Hard" assessment for an intern is not equivalent to a "Hard" assessment for a senior engineer.

## Company Technical Requirements

${list(a.technical_requirements)}
${a.custom_technical_requirements ? `\n**Additional technical requirements:**\n\n${a.custom_technical_requirements}\n` : ""}
## General Programming Requirements

${a.general_programming_questions
    ? `Include general programming questions appropriate for a ${levelLabel(a.candidate_level)} candidate using ${a.programming_language}. These must test foundational ability while still supporting the company's technical requirements. Do not produce unrelated programming trivia.`
    : "Do not include general programming questions. Focus only on the company's technical requirements."}

## Candidate Background

${r ? `Resume provided (${r.file_name}).\n\n**Technologies identified:** ${r.technologies.join(", ") || "None"}` : "No resume was provided. Do not personalize questions."}

## Candidate-to-Requirement Relevance

${r && r.relevant_experience.length
    ? "| Candidate experience | Related company requirement |\n| --- | --- |\n" +
      r.relevant_experience.map((e) => `| ${e.experience} | ${e.related_requirement} |`).join("\n")
    : "No relevant overlap identified."}

## Personalization Instructions

- Use overlapping experience only to frame questions around the company's requirements.
- Do not create questions based on unrelated resume information.
- Do not assume expertise simply because a technology appears on the resume.
- Design questions that let the candidate demonstrate whether claimed experience reflects real technical understanding.

## Custom Hiring Manager Instructions

${a.custom_instructions || "_None provided._"}

## Assessment Design Requirements

- Each question must map to one or more of the company technical requirements above.
- Each question must state explicit, verifiable requirements.
- State clearly whether tests are required for each question.
- Problems must be solvable in ${a.programming_language} without a proprietary environment.

## Evaluation Requirements

The resulting assessment must allow evaluation of:

1. Correctness
2. Code quality
3. Algorithmic efficiency
4. Edge-case handling
5. Testing
6. Maintainability
7. Requirements coverage
8. Overall score per question (0-100)

## Instructions to Assessment-Generation LLM

Use this specification to create a set of coding problems. Produce problem statements, input/output expectations, constraints, explicit requirements, and evaluation guidance for each question. Do not create an interactive coding or testing environment. Assign each question a stable identifier (Q1, Q2, ...).
`;
}
