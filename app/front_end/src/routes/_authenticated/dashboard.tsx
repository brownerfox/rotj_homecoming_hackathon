import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AssessmentsTable } from "@/components/assessments-table";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/app-ui";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Calibrate" },
      { name: "description", content: "Overview of your technical assessments and candidate evaluations." },
      { property: "og:title", content: "Dashboard — Calibrate" },
      { property: "og:description", content: "Overview of your technical assessments and candidate evaluations." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const q = useQuery({ queryKey: ["assessments"], queryFn: api.listAssessments });
  const items = q.data ?? [];
  const stats = [
    ["Total assessments", items.length],
    ["Ready for candidate", items.filter((a) => a.status === "ready_for_candidate" || a.status === "specification_generated").length],
    ["Awaiting evaluation", items.filter((a) => a.status === "candidate_submitted").length],
    ["Candidates evaluated", items.reduce((s, a) => s + a.candidates_evaluated, 0)],
  ] as const;

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Turn your company's real engineering requirements and a candidate's relevant experience into a targeted technical assessment, then see how well the candidate demonstrated those requirements."
        actions={<>
          <Button asChild variant="outline"><Link to="/submissions/new">Evaluate Submission</Link></Button>
          <Button asChild size="lg"><Link to="/assessments/new">Create Assessment</Link></Button>
        </>}
      />

      <div className="mb-8 grid gap-4 md:grid-cols-2">
        <Workflow n="A" title="Hiring Manager" steps={["Describe company and role", "Select requirements and difficulty", "Optionally add a resume", "Review, edit, and download the Markdown specification"]} />
        <Workflow n="B" title="Recruiter" steps={["Select the assessment", "Upload the candidate's completed code", "Submit for evaluation", "Review scores, strengths, and requirement coverage"]} />
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([l, v]) => (
          <Card key={l}><CardContent className="p-5">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{l}</div>
            <div className="mt-2 text-3xl font-semibold tabular-nums">{q.isLoading ? "-" : v}</div>
          </CardContent></Card>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Assessments</h2>
        <Link to="/assessments" className="text-sm text-primary hover:underline">View all</Link>
      </div>
      {q.isLoading ? <LoadingRows /> : q.error ? <ErrorState message={errorMessage(q.error)} /> : items.length === 0 ? (
        <EmptyState title="No assessments yet" description="Create your first assessment to generate a specification."
          action={<Button asChild><Link to="/assessments/new">Create Assessment</Link></Button>} />
      ) : <AssessmentsTable items={items.slice(0, 8)} />}
    </div>
  );
}

function Workflow({ n, title, steps }: { n: string; title: string; steps: string[] }) {
  return (
    <Card><CardContent className="p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded bg-primary font-mono text-xs text-primary-foreground">{n}</span>
        <span className="font-semibold">{title} workflow</span>
      </div>
      <ol className="mt-3 space-y-1.5 text-sm text-muted-foreground">
        {steps.map((s, i) => <li key={s} className="flex gap-2"><span className="font-mono text-xs leading-5">{i + 1}.</span>{s}</li>)}
      </ol>
    </CardContent></Card>
  );
}
