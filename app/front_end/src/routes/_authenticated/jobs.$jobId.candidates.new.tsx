// Page 2: Candidates. Upload resumes in bulk. The server makes one candidate per resume and
// generates each one's questions and coding challenge in the background.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { CANDIDATE_STATUS, MAX_PDF_MB } from "@/lib/constants";
import type { Candidate } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/app-ui";
import { Field, FlowFooter, FlowSteps, Section } from "@/components/flow-ui";
import { cn, pdfProblem } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/jobs/$jobId/candidates/new")({
  head: () => ({
    meta: [
      { title: "Candidates — Fit2Hire" },
      { name: "description", content: "Upload resumes. Each candidate gets personalized questions and a coding challenge." },
      { property: "og:title", content: "Candidates — Fit2Hire" },
      { property: "og:description", content: "Upload resumes. Each candidate gets personalized questions and a coding challenge." },
    ],
  }),
  component: CandidatesPage,
});

function CandidatesPage() {
  const { jobId } = Route.useParams();
  const id = Number(jobId);
  const qc = useQueryClient();
  const [files, setFiles] = useState<File[]>([]);
  // Changing the key empties the file picker after an upload.
  const [pickerKey, setPickerKey] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const job = useQuery({ queryKey: ["job", jobId], queryFn: () => api.getJob(id) });
  const candidates = useQuery({
    queryKey: ["job-candidates", id],
    queryFn: () => api.listJobCandidates(id),
    // Check every 2 seconds while the server is still generating any of them.
    refetchInterval: (q) => (q.state.data?.some((c) => CANDIDATE_STATUS[c.status].busy) ? 2000 : false),
  });
  const refresh = () => Promise.all([
    qc.invalidateQueries({ queryKey: ["job-candidates", id] }),
    qc.invalidateQueries({ queryKey: ["candidates"] }),
  ]);

  const upload = useMutation({
    mutationFn: () => api.uploadResumes(id, files),
    onSuccess: async (created) => {
      setFiles([]);
      setPickerKey((k) => k + 1);
      await refresh();
      toast.success(`${created.length} ${created.length === 1 ? "resume" : "resumes"} uploaded. Generating interviews...`);
    },
    onError: (e) => setError(`The resumes could not be uploaded. ${errorMessage(e)}`),
  });
  const retry = useMutation({
    mutationFn: (candidateId: number) => api.retryCandidate(candidateId),
    onSuccess: refresh,
    onError: (e) => toast.error(`Retry failed. ${errorMessage(e)}`),
  });
  const remove = useMutation({
    mutationFn: (candidateId: number) => api.deleteCandidate(candidateId),
    onSuccess: refresh,
    onError: (e) => toast.error(`The candidate could not be removed. ${errorMessage(e)}`),
  });

  function choose(list: FileList | null) {
    const chosen = Array.from(list ?? []);
    const problem = pdfProblem(chosen);
    setError(problem);
    setFiles(problem ? [] : chosen);
  }

  if (job.isLoading) return <LoadingRows />;
  if (job.error || !job.data) return <ErrorState message={errorMessage(job.error)} />;

  return (
    <div>
      <PageHeader title="Candidates" description={`Upload resumes for ${job.data.title}. Each one becomes a candidate with their own interview.`} />
      <FlowSteps current={2} />

      <Section title="Upload resumes"
        description="Questions and coding challenges are generated in the background using the job's settings as they are now. Editing the job later won't change candidates who already have them.">
        <Field label="Resumes" hint={`Select as many PDFs as you like, up to ${MAX_PDF_MB} MB each.`}>
          <div className="flex flex-wrap items-center gap-3">
            <Input key={pickerKey} type="file" multiple accept=".pdf" className="max-w-sm" disabled={upload.isPending}
              onChange={(e) => choose(e.target.files)} />
            <Button type="button" disabled={!files.length || upload.isPending} onClick={() => { setError(null); upload.mutate(); }}>
              {upload.isPending ? "Uploading..." : files.length ? `Upload ${files.length} and generate` : "Upload and generate"}
            </Button>
          </div>
        </Field>
        {error && <ErrorState message={error} />}
      </Section>

      <Section title="Candidates for this job">
        {candidates.isLoading ? <LoadingRows />
          : candidates.error ? <ErrorState message={errorMessage(candidates.error)} />
          : !candidates.data?.length ? (
            <EmptyState title="No candidates yet" description="Upload resumes above to add candidates." />
          ) : (
            <ul className="divide-y rounded-md border">
              {candidates.data.map((c) => (
                <CandidateRow key={c.id} candidate={c}
                  onRetry={() => retry.mutate(c.id)} retrying={retry.isPending && retry.variables === c.id}
                  onRemove={() => { if (window.confirm(`Remove ${c.name ?? c.resume_file_name}?`)) remove.mutate(c.id); }} />
              ))}
            </ul>
          )}
      </Section>

      <FlowFooter back={
        <Button asChild variant="outline"><Link to="/jobs/new" search={{ job: id }}>Back</Link></Button>
      } />
    </div>
  );
}

function CandidateRow({ candidate: c, onRetry, retrying, onRemove }: {
  candidate: Candidate; onRetry: () => void; retrying: boolean; onRemove: () => void;
}) {
  const status = CANDIDATE_STATUS[c.status];
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <div className="font-medium">{c.name ?? c.resume_file_name}</div>
        {c.name && <div className="text-xs text-muted-foreground">{c.resume_file_name}</div>}
        {c.error && <div className="mt-1 text-sm text-destructive">{c.error}</div>}
      </div>
      <div className="flex items-center gap-2">
        <Badge variant="outline" className={cn(status.busy && "animate-pulse", c.status === "failed" && "border-destructive text-destructive")}>
          {status.label}
        </Badge>
        {c.status === "ready" && (
          <Button asChild size="sm"><Link to="/candidates/$candidateId/interview" params={{ candidateId: String(c.id) }}>Open interview</Link></Button>
        )}
        {c.status === "failed" && (
          <Button type="button" size="sm" variant="outline" disabled={retrying} onClick={onRetry}>{retrying ? "Retrying..." : "Retry"}</Button>
        )}
        <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${c.name ?? c.resume_file_name}`} onClick={onRemove}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </li>
  );
}
