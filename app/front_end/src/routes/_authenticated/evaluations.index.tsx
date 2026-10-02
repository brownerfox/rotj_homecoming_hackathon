import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingRows, PageHeader, StatusBadge, formatDate, scoreTone } from "@/components/app-ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/evaluations/")({
  head: () => ({
    meta: [
      { title: "Evaluations — Calibrate" },
      { name: "description", content: "All candidate code evaluations and their scores." },
      { property: "og:title", content: "Evaluations — Calibrate" },
      { property: "og:description", content: "All candidate code evaluations and their scores." },
    ],
  }),
  component: EvaluationsPage,
});

function EvaluationsPage() {
  const q = useQuery({ queryKey: ["evaluations"], queryFn: api.listEvaluations });
  return (
    <div>
      <PageHeader title="Evaluations" description="Every candidate submission and its evaluation result."
        actions={<Button asChild><Link to="/submissions/new">Evaluate Submission</Link></Button>} />
      {q.isLoading ? <LoadingRows /> : q.error ? <ErrorState message={errorMessage(q.error)} /> : !q.data?.length ? (
        <EmptyState title="No evaluations yet" description="Upload a candidate submission to start an evaluation." />
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Candidate</TableHead><TableHead>Assessment</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Score</TableHead></TableRow></TableHeader>
            <TableBody>
              {q.data.map((e) => (
                <TableRow key={e.submission_id}>
                  <TableCell><Link to="/evaluations/$id" params={{ id: e.submission_id }} className="font-medium text-primary hover:underline">{e.candidate_name}</Link></TableCell>
                  <TableCell><div>{e.assessment_name}</div><div className="text-xs text-muted-foreground">{e.position}</div></TableCell>
                  <TableCell>{formatDate(e.created_at)}</TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell className={cn("text-right font-semibold tabular-nums", e.overall_score != null && scoreTone(e.overall_score))}>{e.overall_score ?? "--"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
