# Page Workflow

This file is the source of truth for the product flow: five pages and two LLM calls.
Teammates use it to stay aligned. AI coding assistants must treat it as rules, not suggestions.

## Who uses the app

- The only users are **recruiters and hiring managers**.
- The **candidate never uses the app**. There is no candidate login and no candidate-facing screen.
- The app produces two outputs: the generated interview and the candidate analysis. Recruiters and hiring managers take those outputs and use them however they want.
- The candidate does the interview outside the app. A recruiter or hiring manager uploads the candidate's work afterward.

## Core pipeline

Job + Key Details + Team Priorities → Resume → AI-Generated Interview → Candidate Works → Solution + Process → AI Analysis → Recruiter Insights

| Step | Name | Takes in | Produces |
| --- | --- | --- | --- |
| Page 0 | Home and Sign In | Email, password, role | A signed-in recruiter or hiring manager |
| Page 1 | Job Setup | Job posting, priorities, existing interview questions, hiring manager context | Job context |
| Page 2 | Candidate Setup | Resume, interview style | Candidate context |
| LLM Call #1 | Generate interview | Page 1 + Page 2 as one Markdown context file | Interview content |
| Page 3 | Interview | Interview content, then the candidate's uploaded work | Solution + process documentation |
| LLM Call #2 | Analyze candidate | Existing Markdown context + Page 3 results | Candidate analysis |
| Page 4 | Candidate Analysis | Analysis from LLM Call #2 | Insights for the recruiter and hiring manager |

## Rules for development

1. **Follow the flow in order.** There are exactly five pages, Page 0 through Page 4, and two LLM calls. Do not add, remove, merge, rename, or reorder them without updating this file first.
2. **Build what is listed.** Every field and section below is required. Do not invent extra fields, pages, or analysis sections.
3. **No candidate-facing features.** Do not build candidate accounts, candidate screens, or an in-app coding environment.
4. **One Markdown context file per interview.** LLM Call #1 creates it from Pages 1 and 2. LLM Call #2 adds Page 3 results to that same file. Never drop earlier context.
5. **Page 1 context reaches both LLM calls.** The hiring manager's input shapes the interview and the final analysis.
6. **The frontend never calls an LLM directly.** Both LLM calls run on the FastAPI server. See `AGENTS.md` and `API_CONTRACT.md`.
7. **Ask when unsure.** If this file is unclear, or conflicts with existing code, stop and ask before building.

## Moving between pages

- Pages 1 to 4 each have a Back button at the bottom that returns to the previous page with its saved information.
- Going back to Page 1 or Page 2 edits the saved job or candidate. It does not create a second one.
- Editing a job does not change interviews that were already generated. Regenerating on Page 2 replaces that candidate's interview.

---

## Page 0: Home and Sign In

**Purpose:** Explain what the product does and let a recruiter or hiring manager sign in.

### Before signing in

- This is the only page visible before signing in.
- It describes the product in terms of the core pipeline.
- The user signs in, or creates an account and picks a role: recruiter or hiring manager.
- After signing in, the user goes to Page 1.
- In demo mode, a "Try the demo" button signs in as a sample user with no account needed.

### After signing in

A signed-in user can come back to this page at any time. It then shows:

- A "Start a new job" button that goes to Page 1.
- A list of candidates in progress. Each one links to the page it is waiting on.

The list exists because the candidate works outside the app. The recruiter or hiring manager leaves after Page 3 and comes back later to upload the candidate's work.

Nothing on this page is sent to either LLM call.

---

## Page 1: Job Setup

**Purpose:** Capture what the job is and what the hiring manager actually cares about.

### Public job posting

The posting comes straight from the company's original public posting. The user pastes it or uploads it in one piece.

- Role, as its own field
- One posting box, or an uploaded file, that covers qualifications, description, and preferences

### Key priorities dropdown

- A limited dropdown of the key things being looked for. The user can select more than one.
- The options are the question types: debugging, behavioral, situational, system design, resume deep dive, code review, data modeling, testing strategy, motivation, leadership.
- Each selected type has a quantity, changed with + and - buttons beside it. It starts at one.
- The page shows the total number of questions that will be generated.
- The total cannot exceed 20, counting the coding problem. A single type has no limit of its own. The page mentions the limit only when the user reaches it.
- Coding is not an option. It is always included, because every interview includes a technical problem.
- The selection decides which types of personalized questions are generated on Page 3, and how many of each.

### Existing interview questions

- An optional box for the questions the team already asks every candidate.
- The user types them or uploads a file.
- LLM Call #1 receives them so that no generated question repeats one of them.

### Hiring manager context

One open text box for everything the hiring manager wants in context:

- Current company and team work
- What the new hire will work on
- Desired working style
- Important skills or qualities
- Anything about culture
- Anything not captured by the public post

### Output

All Page 1 information is used as context for the interview and the final analysis.

---

## Page 2: Candidate Setup

**Purpose:** Add the candidate and choose how they will be tested.

### Candidate

- Upload the candidate's resume.
- The candidate's name is read from the resume and shown on the page. The user types it only if it cannot be read.

### Technical interview style

The user picks one:

| Option | Description |
| --- | --- |
| Broad technical prompt | An open technical problem |
| Company-specific problem | A problem based on company work, with starter code |

Both options must include ready-to-run test cases.

### Candidate documentation requirement

The interview requires the candidate to document their work, using the method of their choice. The documentation must cover:

- Implementation plan
- Thought process
- Final approach

---

## LLM Call #1: Generate the interview

1. Combine Page 1 and Page 2 into a single Markdown context file.
2. Send the context to the LLM.
3. The LLM generates the interview content shown on Page 3.

---

## Page 3: Interview

**Purpose:** Show the generated interview to the recruiter or hiring manager, then collect the candidate's finished work from them.

The candidate does not open this page. The recruiter or hiring manager takes the interview content to the candidate, and the candidate works outside the app.

### Candidate header

- Candidate name
- Position they are interviewing for

### Personalized questions

Generate the chosen number of questions for each selected type, to add to the company's typical interview. They are based on:

- Candidate resume
- Job requirements
- The hiring manager's key priorities from the Page 1 dropdown

No generated question may repeat one of the existing interview questions from Page 1.

### Technical problem

The problem is generated from:

- Job requirements
- Actual company work from the Page 1 text box
- Relevant candidate experience

The problem must include:

- The problem statement
- Starter code, if that option was selected on Page 2
- Test cases
- A reference solution, for the hiring team and LLM Call #2 only. It is never given to the candidate.

The candidate documents their implementation plan and process while solving.

### Submission

The recruiter or hiring manager uploads the candidate's work:

- The completed solution
- The implementation plan and final process

---

## LLM Call #2: Analyze the candidate

1. Add the Page 3 results to the existing Markdown context file.
2. Send the complete context back to the LLM for analysis.
3. The LLM returns the analysis shown on Page 4.

---

## Page 4: Candidate Analysis

**Purpose:** Give the recruiter and hiring manager evidence-based insights on the candidate.

The page must have these five sections, in this order.

### 1. Technical analysis

- Solution correctness
- Code quality
- Documentation
- Reusability
- Maintainability
- Technical decisions

### 2. Problem-solving analysis

- Implementation plan
- Efficiency of planning
- How the candidate approached problems
- Changes between the initial plan and the final solution
- Reasoning behind major decisions

### 3. Role-specific insights

- Connect findings back to the hiring manager's Page 1 priorities.
- Highlight evidence relevant to the actual work the candidate would be doing.
- Identify strengths and areas the interviewer may want to investigate further.

### 4. Collaboration insights

- How understandable their work would be to another developer
- Documentation and communication habits
- Strengths and areas the interviewer may want to investigate further

### 5. Things to follow up on

- Unexplained or inconsistent decisions
- Weak reasoning or documentation
- Areas where the interviewer needs more evidence
- Potential heavy AI reliance, where the submitted process does not match the final code
