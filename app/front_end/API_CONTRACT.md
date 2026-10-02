# API Contract

One contract for the frontend and the FastAPI backend. It follows `Page_WorkFlow.md`.
If the two disagree, the workflow doc wins and this file gets fixed.

Exact field shapes live in `src/lib/types.ts`. The backend's Pydantic models must match them.

## Conventions

- Base URL comes from `VITE_API_BASE_URL`, default `http://localhost:8000`.
- `VITE_USE_MOCKS=false` switches the frontend from mock data to the real server.
- IDs are integers. Field names are snake_case. Timestamps are UTC ISO strings.
- Errors return `{ "detail": "<short user-safe message>" }`. The UI replaces messages over 200 characters with a generic one.
- CORS must allow the frontend origin, `http://localhost:8080`.
- There is no sign-in on the server for the hackathon. The frontend's sign-in screen is local only and sends no auth requests.
- The frontend never calls an LLM. Both LLM calls happen inside the two `generate` endpoints.
- The two `generate` endpoints do not respond until the LLM finishes. Allow up to 90 seconds. The UI shows progress while it waits.

## Page 1: Job Setup

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/files/extract-text` | multipart `file` (pdf, txt, md) | `ExtractedText` |
| POST | `/jobs` | `JobInput` | `Job` |
| GET | `/jobs` | - | `Job[]` |
| GET | `/jobs/{job_id}` | - | `Job` |
| PATCH | `/jobs/{job_id}` | partial `JobInput` | `Job` |

| Workflow field | API field |
| --- | --- |
| Role | `title` |
| Public job posting: qualifications, description, preferences | `posting_text`, typed or filled from `/files/extract-text` |
| Key priorities dropdown | `question_types`, must include `coding` |
| Hiring manager context | `context` |

## Page 2: Candidate Setup

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/files/extract-text` | multipart `file`, the resume | `ExtractedText` |
| POST | `/jobs/{job_id}/candidates` | `CandidateInput` | `Candidate` |
| GET | `/candidates` | - | `Candidate[]` |
| GET | `/candidates/{candidate_id}` | - | `Candidate` |
| PATCH | `/candidates/{candidate_id}` | partial `CandidateInput` | `Candidate` |

## LLM Call #1: Generate the interview

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/candidates/{candidate_id}/interview/generate` | - | `Interview` |

- Builds the Markdown context file from the job and the candidate, calls the LLM, stores the result, and returns it.
- Calling it again replaces the stored interview.
- `400` if the candidate has no `resume_text` or no `interview_style`.
- `502` if the LLM fails or returns output that does not match the shape.

## Page 3: Interview

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/candidates/{candidate_id}/interview` | - | `Interview`, or `404` if not generated |
| POST | `/candidates/{candidate_id}/submission` | multipart `solution_files` (one or more), `process_files` (one or more) | `Submission` |
| GET | `/candidates/{candidate_id}/submission` | - | `Submission`, or `404` if none |

- Uploading again replaces the stored submission.
- The server extracts the text of every file and adds it to the Markdown context file.

## LLM Call #2: Analyze the candidate

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/candidates/{candidate_id}/analysis/generate` | - | `Analysis` |

- Adds the submission to the existing Markdown context file, calls the LLM, stores the result, and returns it.
- `400` if the candidate has no interview or no submission.
- `502` if the LLM fails or returns output that does not match the shape.

## Page 4: Candidate Analysis

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/candidates/{candidate_id}/analysis` | - | `Analysis`, or `404` if not generated |

## Candidate status

The server sets `status` on every `Candidate`. The dashboard and lists use it.

| Status | Meaning |
| --- | --- |
| `setup` | Candidate created, no interview yet |
| `interview_generated` | LLM Call #1 finished |
| `submitted` | Solution and process uploaded |
| `analyzed` | LLM Call #2 finished |

## Backend changes this contract needs

- Job: add `posting_text`.
- Candidate: add `interview_style` and a read-only `status`.
- Coding challenge: make `skeleton_code` optional, for the broad technical prompt.
- New endpoints: text extraction, interview generate and read, submission upload and read, analysis generate and read.
- Storage: generated questions go into the existing question tables, assigned to the candidate with their rationale. The analysis is stored whole as JSON.
- The question, coding challenge, and assignment endpoints stay, but the frontend does not call them.
