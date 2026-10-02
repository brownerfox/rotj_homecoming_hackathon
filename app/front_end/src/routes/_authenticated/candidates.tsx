import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/app-ui";

export const Route = createFileRoute("/_authenticated/candidates")({
  head: () => ({
    meta: [
      { title: "Candidates — Calibrate" },
      { name: "description", content: "Candidates who have submitted coding assessments." },
      { property: "og:title", content: "Candidates — Calibrate" },
      { property: "og:description", content: "Candidates who have submitted coding assessments." },
    ],
  }),
  component: CandidatesPage,
});

function CandidatesPage() {
  const q = useQuery({ queryKey: ["candidates"], queryFn: api.listCandidates });
  return (
    <div>
      <PageHeader title="Candidates" description="Candidates with at least one uploaded submission." />
      {q.isLoading ? <LoadingRows /> : q.error ? <ErrorState message={errorMessage(q.error)} /> : !q.data?.length ? (
        <EmptyState title="No candidates yet" description="Candidates appear here once a submission is uploaded." />
      ) : (
        <div className="rounded-md border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Identifier</TableHead><TableHead className="text-right">Submissions</TableHead></TableRow></TableHeader>
            <TableBody>
              {q.data.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="font-mono text-xs">{c.identifier}</TableCell>
                  <TableCell className="text-right tabular-nums">{c.submissions}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
