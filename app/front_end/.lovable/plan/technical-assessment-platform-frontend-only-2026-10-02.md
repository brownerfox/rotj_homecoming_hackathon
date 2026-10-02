# Technical Assessment Platform — Frontend Only

A professional web app for hiring managers and recruiters. It is only the screens: every save, upload, spec generation, and evaluation request goes to your separate Python FastAPI server. No backend, database, or AI work happens in this project.

## Screens

- **Sign in / Sign up**: email and password, with a role choice (Hiring Manager or Recruiter). The sign-in check happens on the FastAPI side.
- **App layout**: left sidebar (Dashboard, Assessments, Candidates, Evaluations). Top bar shows the current company, the current user, and an account menu with sign-out.
- **Dashboard**: a table of assessments showing name, position, language, difficulty, created date, a status badge, and the number of candidates evaluated. It has a prominent "Create Assessment" button and a short explanation of the two workflows.
- **Create Assessment wizard** (7 steps with a progress indicator):
  1. Company: name, purpose, engineering areas (several can be picked, plus "Other")
  2. Role: position, candidate level, language (Python, Java, JavaScript, TypeScript, C++, C)
  3. Technical requirements: grouped checkboxes, custom requirements, a general-questions toggle, and difficulty (Custom adds a text field)
  4. Candidate: optional resume upload (PDF, DOCX, TXT), then shows the relevant experience your server returns
  5. Additional assessment instructions
  6. Review: full summary, then "Generate Assessment Specification"
  7. Opens the Markdown editor
- **Markdown editor**: editor on the left, live preview on the right. Buttons for Save, Download (`assessment_[position]_[date].md`), and Regenerate. Regenerate warns you first if there are unsaved or manual edits.
- **Assessment details**: the settings, the current spec, and a list of submissions.
- **Candidate submission** (recruiter): pick the assessment, candidate name and ID, and the question. Then upload code; allowed file types depend on the assessment's language, and ZIP files are accepted. Submit for evaluation.
- **Evaluation results**: a header (candidate, position, assessment, language, overall score, status) and a recruiter summary (strengths, concerns, coverage, question performance). Below that:
  - a requirements coverage table with Met, Partially Met, and Not Met badges
  - one card per question with a 0–100 score and 7 criteria scored out of 10, each with an explanation
  - expandable detail sections
  - a breakdown showing how the overall score was built from each question's score
- **Candidates and Evaluations**: simple lists.

## Design

Restrained enterprise look: neutral slate surfaces, one deep-teal accent, IBM Plex Sans with Plex Mono for code and Markdown. No emojis, illustrations, gradients, or decorative animation. Built for desktop first, and works on tablets.

## Errors

Clear messages for missing fields, wrong file types, failed uploads, a server that can't be reached, and missing records. Raw error details from the server are never shown.

## Technical details

- All server calls go through one API client file. The FastAPI base address is set in one place (`VITE_API_BASE_URL`). The sign-in token is attached to every request, and a 401 response sends the user back to sign-in.
- A typed contract (TypeScript types and a written endpoint list in `API_CONTRACT.md`) that your backend team can build against:
  - `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
  - `GET/POST /assessments`, `GET/PATCH /assessments/{id}`
  - `POST /assessments/{id}/resume` (multipart): returns the relevant experience
  - `POST /assessments/{id}/specification/generate`, `PUT /assessments/{id}/specification`
  - `GET/POST /candidates`
  - `POST /submissions` (multipart code file or ZIP), `GET /submissions/{id}`
  - `GET /submissions/{id}/evaluation`: polled until the evaluation is complete
- Mock mode (`VITE_USE_MOCKS=true`, on by default): returns realistic sample data so the whole demo works before the FastAPI server exists. Turn it off to use the real server.
- Data loading uses TanStack Query. Pages that need sign-in sit behind a guard, and some screens appear only for a given role.
- Markdown preview uses `react-markdown` with GitHub-style formatting (`remark-gfm`).
