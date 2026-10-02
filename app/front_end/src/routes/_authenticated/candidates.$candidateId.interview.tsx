// Page 3: Interview. One candidate's personalized questions and coding challenge, every part of
// it editable. The candidate never opens this page.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { CANDIDATE_STATUS, QUESTION_TYPE_LABELS } from "@/lib/constants";
import type { CandidateDetail, CodingChallengeUpdate } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/app-ui";
import { FlowFooter, FlowSteps, Section } from "@/components/flow-ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/candidates/$candidateId/interview")({
  head: () => ({
    meta: [
      { title: "Interview — Fit2Hire" },
      { name: "description", content: "The personalized questions and coding challenge for this candidate." },
      { property: "og:title", content: "Interview — Fit2Hire" },
      { property: "og:description", content: "The personalized questions and coding challenge for this candidate." },
    ],
  }),
  component: InterviewPage,
});

function InterviewPage() {
  const { candidateId } = Route.useParams();
  const id = Number(candidateId);
  const qc = useQueryClient();
  const candidate = useQuery({
    queryKey: ["candidate", id],
    queryFn: () => api.getCandidate(id),
    // Check every 2 seconds while the server is still generating this interview.
    refetchInterval: (q) => (q.state.data && CANDIDATE_STATUS[q.state.data.status].busy ? 2000 : false),
  });
  const jobId = candidate.data?.job_id;
  const job = useQuery({ queryKey: ["job", String(jobId)], queryFn: () => api.getJob(jobId ?? 0), enabled: jobId !== undefined });
  const retry = useMutation({
    mutationFn: () => api.retryCandidate(id),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: ["candidate", id] }),
      qc.invalidateQueries({ queryKey: ["candidates"] }),
    ]),
    onError: (e) => toast.error(`Retry failed. ${errorMessage(e)}`),
  });

  if (candidate.isLoading) return <LoadingRows />;
  if (candidate.error || !candidate.data) return <ErrorState message={errorMessage(candidate.error)} />;
  const c = candidate.data;
  const back = (
    <Button asChild variant="outline">
      <Link to="/jobs/$jobId/candidates/new" params={{ jobId: String(c.job_id) }}>Back</Link>
    </Button>
  );
  const position = job.data ? `Interviewing for ${job.data.title}` : undefined;

  if (c.status !== "ready") {
    return (
      <div>
        <PageHeader title={c.name ?? c.resume_file_name} {...(position ? { description: position } : {})} />
        <FlowSteps current={3} />
        {CANDIDATE_STATUS[c.status].busy ? (
          <EmptyState title="Generating this interview" description="This usually takes under a minute. The page updates on its own." />
        ) : (
          <div className="space-y-4">
            <ErrorState message={c.error ?? "Generation failed."} />
            {c.resume_text !== null && (
              <Button onClick={() => retry.mutate()} disabled={retry.isPending}>{retry.isPending ? "Retrying..." : "Retry"}</Button>
            )}
          </div>
        )}
        <FlowFooter back={back} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader title={c.name ?? c.resume_file_name} {...(position ? { description: position } : {})}
        actions={<NameEditor candidate={c} />} />
      <FlowSteps current={3} />
      <Questions candidate={c} />
      <Challenge candidate={c} />
      <FlowFooter back={back} />
    </div>
  );
}

// Re-reads the candidate after an edit, so every part of the page shows what the server stored.
function useRefreshCandidate(id: number) {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["candidate", id] });
}

function NameEditor({ candidate: c }: { candidate: CandidateDetail }) {
  const [draft, setDraft] = useState<string | null>(null);
  const refresh = useRefreshCandidate(c.id);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (name: string) => api.updateCandidate(c.id, { name }),
    onSuccess: async () => {
      setDraft(null);
      await refresh();
      await qc.invalidateQueries({ queryKey: ["candidates"] });
    },
    onError: (e) => toast.error(`The name could not be saved. ${errorMessage(e)}`),
  });
  if (draft === null) {
    return <Button variant="outline" onClick={() => setDraft(c.name ?? "")}>{c.name ? "Edit name" : "Add name"}</Button>;
  }
  return (
    <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); save.mutate(draft); }}>
      <Input value={draft} onChange={(e) => setDraft(e.target.value)} className="w-56" autoFocus />
      <Button type="submit" disabled={save.isPending || !draft.trim()}>Save</Button>
      <Button type="button" variant="outline" onClick={() => setDraft(null)} disabled={save.isPending}>Cancel</Button>
    </form>
  );
}

function Questions({ candidate: c }: { candidate: CandidateDetail }) {
  const refresh = useRefreshCandidate(c.id);
  if (!c.questions.length) {
    return <Section title="Personalized questions"><p className="text-sm text-muted-foreground">This job asked for no personalized questions.</p></Section>;
  }
  return (
    <Section title="Personalized questions" description="Add these to your usual interview. They're written for this candidate's resume and grouped by type.">
      <ol className="space-y-4">
        {c.questions.map((q, i) => (
          <li key={q.id} className="rounded-md border p-4">
            <EditableBlock value={q.prompt} rows={4}
              label={<><span className="font-mono text-xs text-muted-foreground">Question {i + 1}</span><Badge variant="outline">{QUESTION_TYPE_LABELS[q.type]}</Badge></>}
              onSave={async (prompt) => { await api.editCandidateQuestion(q.id, prompt); await refresh(); }}>
              <p className="text-sm">{q.prompt}</p>
            </EditableBlock>
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Challenge({ candidate: c }: { candidate: CandidateDetail }) {
  const refresh = useRefreshCandidate(c.id);
  const p = c.coding_challenge;
  if (!p) return null;
  const edit = (field: keyof CodingChallengeUpdate) => async (value: string) => {
    await api.editCodingChallenge(c.id, { [field]: value });
    await refresh();
  };
  const code = (text: string) => (
    <pre className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-4 font-mono text-[13px] leading-relaxed">{text}</pre>
  );

  return (
    <Section title="Coding challenge"
      description="Give the candidate the problem statement, plus the starter code and tests if there are any. Keep the reference solution to yourself.">
      <Badge variant="outline" className="w-fit font-mono">{p.language}</Badge>

      <EditableBlock label="Problem statement" value={p.prompt} copy="Problem statement" rows={14} onSave={edit("prompt")}>
        <div className="md-preview rounded-md border p-5 text-sm">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.prompt}</ReactMarkdown>
        </div>
      </EditableBlock>

      {p.starter_code !== null && p.tests !== null ? (
        <>
          <EditableBlock label="Starter code" value={p.starter_code} copy="Starter code" mono onSave={edit("starter_code")}>
            {code(p.starter_code)}
          </EditableBlock>
          <EditableBlock label="Tests" value={p.tests} copy="Tests" mono onSave={edit("tests")}>
            {code(p.tests)}
          </EditableBlock>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          No starter code or tests: the job had starter code turned off when this interview was generated.
        </p>
      )}

      <Collapsible className="rounded-md border border-dashed p-4">
        <CollapsibleTrigger className="group flex w-full items-center justify-between text-sm font-medium">
          Reference solution, for the hiring team only
          <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <p className="mb-3 text-sm text-destructive">Do not give this to the candidate.</p>
          <EditableBlock label="Solution" value={p.solution_code} mono onSave={edit("solution_code")}>
            {code(p.solution_code)}
          </EditableBlock>
        </CollapsibleContent>
      </Collapsible>
    </Section>
  );
}

function CopyButton({ text, what }: { text: string; what: string }) {
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${what} copied`);
    } catch {
      toast.error("Copy failed. Select the text and copy it by hand.");
    }
  }
  return <Button type="button" variant="outline" size="sm" onClick={copy}>Copy</Button>;
}

// A labeled block that shows `children`, with Copy and Edit buttons. Edit swaps in a text box.
function EditableBlock({ label, value, onSave, copy, mono, rows = 10, children }: {
  label: ReactNode; value: string; onSave: (value: string) => Promise<void>; copy?: string; mono?: boolean; rows?: number; children: ReactNode;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (draft === null) return;
    setSaving(true);
    try {
      await onSave(draft);
      setDraft(null);
    } catch (e) {
      toast.error(`Your edit could not be saved. ${errorMessage(e)}`);
    } finally { setSaving(false); }
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-medium">{label}</div>
        {draft === null && (
          <div className="flex gap-2">
            {copy && <CopyButton text={value} what={copy} />}
            <Button type="button" variant="outline" size="sm" onClick={() => setDraft(value)}>Edit</Button>
          </div>
        )}
      </div>
      {draft === null ? children : (
        <div className="space-y-2">
          <Textarea rows={rows} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
            className={cn(mono && "font-mono text-[13px]")} />
          <div className="flex gap-2">
            <Button type="button" size="sm" onClick={save} disabled={saving || !draft.trim()}>{saving ? "Saving..." : "Save"}</Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setDraft(null)} disabled={saving}>Cancel</Button>
          </div>
        </div>
      )}
    </div>
  );
}
