import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown } from "lucide-react";
import { api, errorMessage } from "@/lib/api";
import { CRITERIA } from "@/lib/constants";
import type { Evaluation, QuestionEvaluation } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CoverageBadge, ErrorState, LoadingRows, PageHeader, StatusBadge, scoreTone } from "@/components/app-ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/evaluations/$id")({
  head: () => ({
    meta: [
      { title: "Evaluation Results — Calibrate" },
      { name: "description", content: "Criterion-by-criterion evaluation of a candidate's coding submission." },
      { property: "og:title", content: "Evaluation Results — Calibrate" },
      { property: "og:description", content: "Criterion-by-criterion evaluation of a candidate's coding submission." },
    ],
  }),
  component: EvaluationPage,
});

function EvaluationPage() {
  const { id } = Route.useParams();
  const sub = useQuery({ queryKey: ["submission", id], queryFn: () => api.getSubmission(id) });
  const assessment = useQuery({
    queryKey: ["assessment", sub.data?.assessment_id],
    queryFn: () => api.getAssessment(sub.data!.assessment_id),
    enabled: !!sub.data,
  });
  const ev = useQuery({
    queryKey: ["evaluation", id],
    queryFn: () => api.getEvaluation(id),
    refetchInterval: (q) => (q.state.data?.status === "pending" ? 2000 : false),
  });

  if (sub.isLoading) return <LoadingRows />;
  if (sub.error || !sub.data) return <ErrorState message={errorMessage(sub.error)} />;
  const s = sub.data;
  const a = assessment.data;
  const e = ev.data;

  return (
    <div>
      <PageHeader title={s.candidate_name} description={`Candidate ${s.candidate_identifier} · ${s.file_name}`} />
      <div className="mb-6 grid gap-4 rounded-md border bg-card p-5 sm:grid-cols-2 lg:grid-cols-6">
        <Meta k="Position" v={a?.position ?? "-"} />
        <Meta k="Assessment" v={a ? <Link to="/assessments/$id" params={{ id: a.id }} className="text-primary hover:underline">{a.name}</Link> : "-"} />
        <Meta k="Language" v={<span className="font-mono">{a?.programming_language ?? "-"}</span>} />
        <Meta k="Status" v={<StatusBadge status={e?.status === "complete" ? "evaluation_complete" : e?.status === "failed" ? "failed" : "evaluating"} />} />
        <div className="lg:col-span-2 lg:text-right">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Overall assessment score</div>
          <div className={cn("text-4xl font-semibold tabular-nums", e?.overall_score != null && scoreTone(e.overall_score))}>
            {e?.overall_score ?? "--"}<span className="text-lg text-muted-foreground">/100</span>
          </div>
        </div>
      </div>

      {ev.error ? <ErrorState message={`The evaluation could not be loaded. ${errorMessage(ev.error)}`} /> :
        !e || e.status === "pending" ? (
          <Card><CardContent className="p-10 text-center">
            <div className="mx-auto mb-4 h-1 w-48 overflow-hidden rounded bg-muted"><div className="h-full w-1/3 animate-pulse bg-primary" /></div>
            <p className="font-medium">Evaluation in progress</p>
            <p className="mt-1 text-sm text-muted-foreground">The submission and assessment requirements have been sent to the evaluation service. This page updates automatically.</p>
          </CardContent></Card>
        ) : e.status === "failed" ? (
          <ErrorState message="The evaluation service could not produce a valid result for this submission. Please try submitting again later." />
        ) : <Results e={e} />}
    </div>
  );
}

function Meta({ k, v }: { k: string; v: React.ReactNode }) {
  return <div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{k}</div><div className="mt-1 text-sm font-medium">{v}</div></div>;
}

function Results({ e }: { e: Evaluation }) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle className="text-base">Recruiter summary</CardTitle></CardHeader>
        <CardContent className="space-y-5 text-sm">
          {e.summary && <p>{e.summary}</p>}
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-md border-l-4 border-success bg-success-soft/50 p-4">
              <div className="mb-2 font-semibold">Demonstrated strengths</div>
              <ul className="list-disc space-y-1 pl-5">{e.strengths.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div className="rounded-md border-l-4 border-destructive bg-danger-soft/50 p-4">
              <div className="mb-2 font-semibold">Areas of concern</div>
              <ul className="list-disc space-y-1 pl-5">{e.concerns.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            <div><div className="mb-1 font-semibold">Requirements coverage</div><p className="text-muted-foreground">{e.requirements_coverage_summary}</p></div>
            <div><div className="mb-1 font-semibold">Question performance</div><p className="text-muted-foreground">{e.question_performance_summary}</p></div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Requirements coverage</CardTitle></CardHeader>
          <CardContent>
            <div className="mb-3 flex gap-4 text-xs text-muted-foreground">
              {(["met", "partially_met", "not_met"] as const).map((r) => (
                <span key={r} className="flex items-center gap-1.5"><CoverageBadge result={r} />{e.requirements_coverage.filter((x) => x.result === r).length}</span>
              ))}
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Requirement</TableHead><TableHead>Result</TableHead></TableRow></TableHeader>
              <TableBody>
                {e.requirements_coverage.map((r) => (
                  <TableRow key={r.requirement}>
                    <TableCell><div className="font-medium">{r.requirement}</div><div className="text-xs text-muted-foreground">{r.note}</div></TableCell>
                    <TableCell><CoverageBadge result={r.result} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">How the overall score was calculated</CardTitle></CardHeader>
          <CardContent className="text-sm">
            <Table>
              <TableHeader><TableRow><TableHead>Question</TableHead><TableHead className="text-right">Score</TableHead><TableHead className="text-right">Weight</TableHead><TableHead className="text-right">Contribution</TableHead></TableRow></TableHeader>
              <TableBody>
                {e.questions.map((q) => (
                  <TableRow key={q.question_id}>
                    <TableCell><span className="font-mono text-xs">{q.question_id}</span> {q.title}</TableCell>
                    <TableCell className="text-right tabular-nums">{q.overall_score}</TableCell>
                    <TableCell className="text-right tabular-nums">{Math.round(q.weight * 100)}%</TableCell>
                    <TableCell className="text-right tabular-nums">{(q.overall_score * q.weight).toFixed(1)}</TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={3} className="font-semibold">Overall score</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{e.overall_score}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-lg font-semibold">Question evaluations</h2>
      {e.questions.map((q, i) => <QuestionCard key={q.question_id} q={q} index={i} />)}
    </div>
  );
}

function QuestionCard({ q, index }: { q: QuestionEvaluation; index: number }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <div className="font-mono text-xs text-muted-foreground">Question {index + 1} · {q.question_id}</div>
          <CardTitle className="mt-1 text-base">{q.title}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">{q.summary}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">Overall score</div>
          <div className={cn("text-3xl font-semibold tabular-nums", scoreTone(q.overall_score))}>{q.overall_score}<span className="text-sm text-muted-foreground">/100</span></div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-x-8 gap-y-4 md:grid-cols-2">
          {CRITERIA.map(({ key, label }) => {
            const c = q[key];
            return (
              <div key={key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{label}</span>
                  <span className={cn("font-semibold tabular-nums", scoreTone(c.score, 10))}>{c.score}/10</span>
                </div>
                <Progress value={c.score * 10} className="mt-1.5 h-1.5" />
                <p className="mt-1.5 text-xs text-muted-foreground">{c.explanation}</p>
                {key === "testing" && (
                  <p className="mt-1 text-xs">
                    {!q.testing.tests_provided
                      ? q.testing.tests_required ? "Candidate did not provide tests (tests were required)." : "Candidate did not provide tests (not required; not penalized)."
                      : "Candidate provided tests."}
                  </p>
                )}
              </div>
            );
          })}
        </div>
        <Collapsible className="mt-5 border-t pt-3">
          <CollapsibleTrigger className="group flex items-center gap-1 text-sm font-medium text-primary">
            Detailed evaluation <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 text-sm leading-relaxed text-muted-foreground">{q.detailed_explanation}</CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}
