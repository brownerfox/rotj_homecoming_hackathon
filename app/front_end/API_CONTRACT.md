# API Contract

One contract for the frontend and the FastAPI backend (`app/back_end`). It describes the API as built.

Exact field shapes live in `src/lib/types.ts`, which mirrors the backend's Pydantic models in
`app/back_end/app/schemas.py`. Change both together. `src/lib/mock-api.ts` implements the same
contract in the browser for demo mode.

> `Page_WorkFlow.md` has not been updated for the decisions below. Where the two disagree, this
> file and the code are current. In particular: resumes are uploaded in bulk, the starter-code
> choice is made once per job rather than per candidate, there is no separate text-extraction
> endpoint, and the submission upload and candidate analysis (Page 4, LLM Call #2) are not built yet.

## Conventions

- Base URL comes from `VITE_API_BASE_URL`, default `http://localhost:8000`.
- `VITE_USE_MOCKS=false` switches the frontend from mock data to the real server.
- IDs are integers. Field names are snake_case. Timestamps are UTC ISO strings ending in `Z`.
- Errors return `{ "detail": "<short user-safe message>" }`. Validation errors (422) return FastAPI's
  list form, which the UI replaces with a generic message.
- CORS allows the frontend origin, `http://localhost:8080`.
- There is no sign-in on the server for the hackathon. The frontend's sign-in screen is local only.
- The frontend never calls an LLM. Generation runs on the server, in the background.
- PATCH changes only the fields sent. `null` clears an optional field and is rejected for a required one.

## Question types

`debugging`, `behavioral`, `situational`, `technical`, `system_design`, `resume_deep_dive`,
`code_review`, `data_modeling`, `testing_strategy`, `motivation`, `leadership`. That is also the display
order: questions are always listed by type, in this order. The coding challenge is not a type; every
candidate gets one. `GET /question-types` returns the list with descriptions.

## Page 1: Job Setup

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/jobs` | `JobInput` | `Job` (201) |
| GET | `/jobs` | - | `Job[]` |
| GET | `/jobs/{job_id}` | - | `Job` |
| PATCH | `/jobs/{job_id}` | partial `JobInput` | `Job` |
| DELETE | `/jobs/{job_id}` | - | 204. Deletes its candidates too |
| GET | `/jobs/{job_id}/existing-questions` | - | `ExistingQuestionFile[]` |
| POST | `/jobs/{job_id}/existing-questions` | multipart `files` (PDFs) | `ExistingQuestionFile[]` (201) |
| DELETE | `/jobs/{job_id}/existing-questions/{file_id}` | - | 204 |

- `questions` is a list of `{type, count}`: one entry per type, each count 1 to 10. A PATCH replaces
  the whole list. It is returned in type order.
- Existing interview questions are optional, and can be typed (`existing_questions`), uploaded as
  PDFs, or both. Generated questions avoid repeating any of them.
- `coding_brief` is the hiring manager's notes on the coding challenge. The challenge is based mainly on it.
- `starter_code` decides whether coding challenges come with starter code and tests. No starter code
  means no tests.
- Editing a job only affects resumes uploaded afterwards.

## Page 2: Candidates

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/jobs/{job_id}/candidates` | multipart `files` (resume PDFs, any number) | `Candidate[]` (202) |
| GET | `/jobs/{job_id}/candidates` | - | `Candidate[]` |
| GET | `/candidates` | - | `Candidate[]`, all jobs |
| POST | `/candidates/{candidate_id}/retry` | - | `Candidate` (202). Failed candidates only, else 409 |
| DELETE | `/candidates/{candidate_id}` | - | 204 |

- Each resume becomes a candidate with status `pending`, and the request returns. The server then
  reads each resume and generates its questions and coding challenge in the background, a few at a time.
- The UI polls the candidate list every 2 seconds while any candidate is `pending` or `generating`.
- `name` is read from the resume during generation, so it is `null` until then (and if the resume
  has none). The UI shows `resume_file_name` in its place.
- Uploads are PDFs up to 10 MB each. One bad file rejects the whole upload (400) before anything is created.

| Status | Meaning |
| --- | --- |
| `pending` | Uploaded, waiting for a generation slot |
| `generating` | Claude is writing the interview |
| `ready` | Questions and coding challenge are ready |
| `failed` | See `error` for why. Retry, or delete and upload again |

## Page 3: Interview

| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| GET | `/candidates/{candidate_id}` | - | `CandidateDetail` |
| PATCH | `/candidates/{candidate_id}` | `{name}` | `CandidateDetail` |
| PATCH | `/candidate-questions/{question_id}` | `{prompt}` | `CandidateQuestion` |
| PATCH | `/candidates/{candidate_id}/coding-challenge` | partial `{prompt, starter_code, tests, solution_code}` | `CodingChallenge` |

- `CandidateDetail` is the candidate plus `resume_text`, `questions` (in type order), and `coding_challenge`.
- Generated material is frozen: later job edits never change it. Users can edit any of it by hand.
- Starter code and tests are set or cleared together (400 otherwise).

## Not built yet

- Uploading the candidate's finished work, and the candidate analysis (LLM Call #2, Page 4).
- Regenerating a candidate who already has an interview.
