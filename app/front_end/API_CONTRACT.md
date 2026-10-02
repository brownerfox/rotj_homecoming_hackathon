# FastAPI Contract for the Calibrate Frontend

The frontend reads `VITE_API_BASE_URL` (default `http://localhost:8000`). Set `VITE_USE_MOCKS=false` to use the real server instead of in-browser sample data. Exact field shapes live in `src/lib/types.ts`.

## Conventions
- Auth: `Authorization: Bearer <access_token>` on every request except register/login. A `401` signs the user out.
- Errors: return `{ "detail": "<short user-safe message>" }`. Messages over 200 chars are replaced by a generic message.
- Enable CORS for the frontend origin.
- Scope every resource to the caller's company.

## Endpoints
| Method | Path | Body | Returns |
| --- | --- | --- | --- |
| POST | `/auth/register` | `{name,email,password,role,company_name}` (role: `hiring_manager` or `recruiter`) | `AuthResponse` |
| POST | `/auth/login` | `{email,password}` | `AuthResponse` |
| GET | `/auth/me` | - | `User` |
| GET | `/assessments` | - | `Assessment[]` |
| POST | `/assessments` | `AssessmentInput` | `Assessment` (status `draft`) |
| GET | `/assessments/{id}` | - | `Assessment` |
| PATCH | `/assessments/{id}` | partial `AssessmentInput`, optional `status` | `Assessment` |
| POST | `/assessments/{id}/resume` | multipart `file` (pdf/docx/txt) | `ResumeInsights` |
| POST | `/assessments/{id}/specification/generate` | - | `Assessment` with `markdown_specification`, `questions`, status `specification_generated`, `spec_manually_edited=false` |
| PUT | `/assessments/{id}/specification` | `{markdown}` | `Assessment` with `spec_manually_edited=true` |
| GET | `/candidates` | - | `Candidate[]` |
| GET | `/submissions?assessment_id=` | - | `Submission[]` |
| POST | `/submissions` | multipart `assessment_id, candidate_name, candidate_identifier, question_id?, file` | `Submission` |
| GET | `/submissions/{id}` | - | `Submission` |
| GET | `/submissions/{id}/evaluation` | - | `Evaluation`. Return `status:"pending"` while running; the UI polls every 2s. `"failed"` for invalid LLM output. |
| GET | `/evaluations` | - | `EvaluationListItem[]` |

## Evaluation rules the UI relies on
- `overall_score` should equal the sum of `question.overall_score * question.weight`, because the UI shows this breakdown.
- Criterion scores are 0-10; question scores are 0-100.
- `testing.tests_required` / `tests_provided` tell apart "did not provide tests" and "failed required tests".
- `requirements_coverage[].result` is `met`, `partially_met`, or `not_met`.
