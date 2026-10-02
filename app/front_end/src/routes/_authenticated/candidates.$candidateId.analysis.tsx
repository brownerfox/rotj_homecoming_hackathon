// Page 4: Candidate Analysis (Page_WorkFlow.md). Shows the result of LLM Call #2 as evidence
// and open questions for the recruiter and hiring manager. There are no scores.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, type ReactNode } from "react";
import { api, errorMessage } from "@/lib/api";
import type { Analysis, Finding, FollowUp } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingRows, PageHeader, formatDate } from "@/components/app-ui";
import { FlowSteps, Section } from "@/components/flow-ui";

export const Route = createFileRoute("/_authenticated/candidates/$candidateId/analysis")({
  head: () => ({
    meta: [
      { title: "Candidate Analysis — Fit2Hire" },
      { name: "description", content: "Evidence-based insights on how the candidate worked through the interview." },
      { property: "og:title", content: "Candidate Analysis — Fit2Hire" },
      { property: "og:description", content: "Evidence-based insights on how the candidate worked through the interview." },
    ],
  }),
  component: AnalysisPage,
});

// Labels and order come from Page_WorkFlow.md, Page 4. Do not add, remove, or reorder.
const TECHNICAL: [keyof Analysis["technical_analysis"], string][] = [
  ["solution_correctness", "Solution correctness"],
  ["code_quality", "Code quality"],
  ["documentation", "Documentation"],
  ["reusability", "Reusability"],
  ["maintainability", "Maintainability"],
  ["technical_decisions", "Technical decisions"],
];

const PROBLEM_SOLVING: [keyof Analysis["problem_solving_analysis"], string][] = [
  ["implementation_plan", "Implementation plan"],
  ["planning_efficiency", "Efficiency of planning"],
  ["approach_to_problems", "How the candidate approached problems"],
  ["plan_vs_final_changes", "Changes between the initial plan and the final solution"],
  ["decision_reasoning", "Reasoning behind major decisions"],
];

const FOLLOW_UPS: [keyof Analysis["follow_ups"], string, string][] = [
  ["unexplained_or_inconsistent_decisions", "Unexplained or inconsistent decisions", ""],
  ["weak_reasoning_or_documentation", "Weak reasoning or documentation", ""],
  ["needs_more_evidence", "Areas where the interviewer needs more evidence", ""],
  ["ai_reliance_signals", "Potential heavy AI reliance",
    "Places where the submitted process does not match the final code. These are questions to ask, not conclusions."],
];

function AnalysisPage() {
  const { candidateId } = Route.useParams();
  const id = Number(candidateId);
  const candidate = useQuery({ queryKey: ["candidate", id], queryFn: () => api.getCandidate(id) });
  const interview = useQuery({ queryKey: ["interview", id], queryFn: () => api.getInterview(id) });
  const analysis = useQuery({ queryKey: ["analysis", id], queryFn: () => api.getAnalysis(id) });

  if (candidate.isLoading || interview.isLoading || analysis.isLoading) return <LoadingRows />;
  const loadError = candidate.error ?? interview.error ?? analysis.error;
  if (loadError || !candidate.data) return <ErrorState message={errorMessage(loadError)} />;

  const backToInterview = (
    <Button asChild variant="outline">
      <Link to="/candidates/$candidateId/interview" params={{ candidateId }}>Back to interview</Link>
    </Button>
  );
  const a = analysis.data;

  if (!a) {
    return (
      <div>
        <PageHeader title={candidate.data.name} description="This candidate has not been analyzed yet." />
        <FlowSteps current={4} />
        <EmptyState title="No analysis yet"
          description="Upload the candidate's solution and process on the interview page, then run the analysis."
          action={backToInterview} />
      </div>
    );
  }

  const role = a.role_specific_insights;
  const collab = a.collaboration_insights;
  return (
    <div>
      <PageHeader title={candidate.data.name}
        description={`Candidate analysis${interview.data ? ` for ${interview.data.position}` : ""}. Generated ${formatDate(a.created_at)}.`}
        actions={backToInterview} />
      <FlowSteps current={4} />

      <Section title="1. Technical analysis">
        {TECHNICAL.map(([key, label]) => <FindingBlock key={key} label={label} finding={a.technical_analysis[key]} />)}
      </Section>

      <Section title="2. Problem-solving analysis">
        {PROBLEM_SOLVING.map(([key, label]) => <FindingBlock key={key} label={label} finding={a.problem_solving_analysis[key]} />)}
      </Section>

      <Section title="3. Role-specific insights" description="Findings connected back to the hiring manager's priorities and the actual work.">
        <div className="space-y-4">
          {role.priority_findings.map((p) => (
            <FindingBlock key={p.priority} label={p.priority} finding={{ assessment: p.finding, evidence: p.evidence }} />
          ))}
        </div>
        <BulletList title="Evidence relevant to the actual work" items={role.relevant_work_evidence} />
        <BulletList title="Strengths" items={role.strengths} />
        <BulletList title="Areas the interviewer may want to investigate" items={role.areas_to_investigate} />
      </Section>

      <Section title="4. Collaboration insights">
        <FindingBlock label="How understandable their work would be to another developer" finding={collab.understandability} />
        <FindingBlock label="Documentation and communication habits" finding={collab.documentation_and_communication} />
        <BulletList title="Strengths" items={collab.strengths} />
        <BulletList title="Areas the interviewer may want to investigate" items={collab.areas_to_investigate} />
      </Section>

      <Section title="5. Things to follow up on">
        {FOLLOW_UPS.map(([key, label, note]) => (
          <FollowUpGroup key={key} label={label} note={note} items={a.follow_ups[key]} />
        ))}
      </Section>
    </div>
  );
}

// The analysis marks code with backticks. Show those parts in the code font.
function withCode(text: string): ReactNode {
  return text.split("`").map((part, i) =>
    i % 2 === 1
      ? <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">{part}</code>
      : <Fragment key={i}>{part}</Fragment>);
}

function FindingBlock({ label, finding }: { label: string; finding: Finding }) {
  return (
    <div className="rounded-md border p-4">
      <div className="text-sm font-semibold">{label}</div>
      <p className="mt-1 text-sm">{withCode(finding.assessment)}</p>
      {finding.evidence.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Evidence</div>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {finding.evidence.map((e) => <li key={e}>{withCode(e)}</li>)}
          </ul>
        </div>
      )}
    </div>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-sm font-semibold">{title}</div>
      {items.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">Nothing noted.</p> : (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
          {items.map((x) => <li key={x}>{withCode(x)}</li>)}
        </ul>
      )}
    </div>
  );
}

function FollowUpGroup({ label, note, items }: { label: string; note: string; items: FollowUp[] }) {
  return (
    <div>
      <div className="text-sm font-semibold">{label}</div>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      {items.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">Nothing flagged.</p> : (
        <ul className="mt-2 space-y-3">
          {items.map((f) => (
            <li key={f.observation} className="rounded-md border p-4 text-sm">
              <p className="font-medium">{withCode(f.observation)}</p>
              <p className="mt-1 text-muted-foreground"><span className="font-medium">Evidence: </span>{withCode(f.evidence)}</p>
              <p className="mt-2"><span className="font-medium">Ask: </span>{withCode(f.suggested_question)}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
