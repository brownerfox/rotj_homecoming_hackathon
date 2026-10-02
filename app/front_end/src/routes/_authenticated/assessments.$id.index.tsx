import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { api, errorMessage } from "@/lib/api";
import { difficultyLabel, levelLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingRows, PageHeader, StatusBadge, formatDate } from "@/components/app-ui";

export const Route = createFileRoute("/_authenticated/assessments/$id/")({
  head: () => ({
    meta: [
      { title: "Assessment Details — Calibrate" },
      { name: "description", content: "Assessment settings, specification, and candidate submissions." },
      { property: "og:title", content: "Assessment Details — Calibrate" },
      { property: "og:description", content: "Assessment settings, specification, and candidate submissions." },
    ],
  }),
  component: AssessmentDetail,
});

function AssessmentDetail() {
  const { id } = Route.useParams();
  const q = useQuery({ queryKey: ["assessment", id], queryFn: () => api.getAssessment(id) });
  const subs = useQuery({ queryKey: ["submissions", id], queryFn: () => api.listSubmissions(id) });
  if (q.isLoading) return <LoadingRows />;
  if (q.error || !q.data) return <ErrorState message={errorMessage(q.error)} />;
  const a = q.data;
  const Row = ({ k, v }: { k: string; v: ReactNode }) => (
    <div className="grid grid-cols-[150px_1fr] gap-3 border-b py-2 text-sm last:border-0"><span className="text-muted-foreground">{k}</span><span className="whitespace-pre-wrap">{v || "-"}</span></div>
  );

  return (
    <div>
      <PageHeader title={a.name} description={`${a.company_name} · Created ${formatDate(a.created_at)}`}
        actions={<>
          <Button asChild variant="outline"><Link to="/assessments/$id/spec" params={{ id }}>{a.markdown_specification ? "Open specification" : "Generate specification"}</Link></Button>
          <Button asChild><Link to="/submissions/new" search={{ assessment: id }}>Upload submission</Link></Button>
        </>} />
      <div className="mb-6"><StatusBadge status={a.status} /></div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Role and configuration</CardTitle></CardHeader>
          <CardContent>
            <Row k="Position" v={a.position} />
            <Row k="Candidate level" v={levelLabel(a.candidate_level)} />
            <Row k="Language" v={<span className="font-mono">{a.programming_language}</span>} />
            <Row k="Difficulty" v={difficultyLabel(a.difficulty, a.custom_difficulty)} />
            <Row k="General questions" v={a.general_programming_questions ? "Included" : "Not included"} />
            <Row k="Resume" v={a.resume ? a.resume.file_name : "Not provided"} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">What the candidate must demonstrate</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="flex flex-wrap gap-1.5">{a.technical_requirements.map((r) => <span key={r} className="rounded border bg-muted px-2 py-0.5 text-xs">{r}</span>)}</div>
            {a.custom_technical_requirements && <p className="whitespace-pre-wrap">{a.custom_technical_requirements}</p>}
            {a.custom_instructions && <div><div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Hiring manager instructions</div><p className="whitespace-pre-wrap">{a.custom_instructions}</p></div>}
          </CardContent>
        </Card>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Submissions</h2>
      {subs.isLoading ? <LoadingRows /> : subs.error ? <ErrorState message={errorMessage(subs.error)} /> : !subs.data?.length ? (
        <EmptyState title="No submissions yet" description="Upload a candidate's completed code to evaluate it against this assessment." />
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Candidate</TableHead><TableHead>ID</TableHead><TableHead>File</TableHead><TableHead>Submitted</TableHead><TableHead>Status</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {subs.data.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.candidate_name}</TableCell>
                  <TableCell className="font-mono text-xs">{s.candidate_identifier}</TableCell>
                  <TableCell className="font-mono text-xs">{s.file_name}</TableCell>
                  <TableCell>{formatDate(s.created_at)}</TableCell>
                  <TableCell><StatusBadge status={s.status} /></TableCell>
                  <TableCell className="text-right"><Link to="/evaluations/$id" params={{ id: s.id }} className="text-sm text-primary hover:underline">View evaluation</Link></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
