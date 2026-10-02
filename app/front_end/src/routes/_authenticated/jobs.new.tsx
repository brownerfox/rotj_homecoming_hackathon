// Page 1: Job Setup.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { ChevronDown, Minus, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { MAX_PDF_MB, MAX_PER_TYPE, QUESTION_TYPES } from "@/lib/constants";
import type { Job, JobInput, QuestionType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, LoadingRows, PageHeader } from "@/components/app-ui";
import { Field, FlowFooter, FlowSteps, Section } from "@/components/flow-ui";
import { cn, pdfProblem, toId } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/jobs/new")({
  // ?job= opens a saved job for editing.
  validateSearch: (search: Record<string, unknown>): { job?: number } => {
    const job = toId(search["job"]);
    return job === undefined ? {} : { job };
  },
  head: () => ({
    meta: [
      { title: "Job Setup — Fit2Hire" },
      { name: "description", content: "Describe the job, the questions to ask, and what the coding challenge should cover." },
      { property: "og:title", content: "Job Setup — Fit2Hire" },
      { property: "og:description", content: "Describe the job, the questions to ask, and what the coding challenge should cover." },
    ],
  }),
  component: JobSetup,
});

// What the job description should cover, so the questions fit the real work.
const DESCRIPTION_PROMPTS = [
  "The public posting: qualifications, responsibilities, preferences",
  "Current company and team work, and what the new hire will work on",
  "Desired working style and anything about culture",
];

interface Form {
  title: string;
  description: string;
  skills: string; // comma-separated
  existing_questions: string;
  coding_brief: string;
  starter_code: boolean;
  counts: Partial<Record<QuestionType, number>>; // selected types only
}

const empty: Form = { title: "", description: "", skills: "", existing_questions: "", coding_brief: "", starter_code: true, counts: {} };

const toForm = (job: Job): Form => ({
  title: job.title,
  description: job.description,
  skills: job.skills.join(", "),
  existing_questions: job.existing_questions ?? "",
  coding_brief: job.coding_brief ?? "",
  starter_code: job.starter_code,
  counts: Object.fromEntries(job.questions.map((q) => [q.type, q.count])),
});

const toInput = (f: Form): JobInput => ({
  title: f.title.trim(),
  description: f.description.trim(),
  skills: f.skills.split(",").map((s) => s.trim()).filter(Boolean),
  existing_questions: f.existing_questions.trim() || null,
  coding_brief: f.coding_brief.trim() || null,
  starter_code: f.starter_code,
  questions: QUESTION_TYPES.flatMap((t) => (f.counts[t.value] ? [{ type: t.value, count: f.counts[t.value] ?? 1 }] : [])),
});

function JobSetup() {
  const [f, setF] = useState<Form>(empty);
  // PDFs chosen on this visit. They upload when the job is saved, because a new job has no id yet.
  const [newFiles, setNewFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((p) => ({ ...p, [k]: v }));

  // Coming back from Page 2 edits the saved job instead of creating a second one.
  const { job: jobId } = Route.useSearch();
  const existing = useQuery({
    queryKey: ["job", String(jobId)], queryFn: () => api.getJob(jobId ?? 0), enabled: jobId !== undefined,
  });
  const savedFiles = useQuery({
    queryKey: ["existing-questions", jobId], queryFn: () => api.listExistingQuestionFiles(jobId ?? 0), enabled: jobId !== undefined,
  });
  const removeFile = useMutation({
    mutationFn: (fileId: number) => api.deleteExistingQuestionFile(jobId ?? 0, fileId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["existing-questions", jobId] }),
    onError: (e) => toast.error(`The file could not be removed. ${errorMessage(e)}`),
  });
  useEffect(() => {
    if (jobId === undefined) { setF(empty); setNewFiles([]); return; }
    if (existing.data) setF(toForm(existing.data));
  }, [jobId, existing.data]);

  const personalizedTotal = Object.values(f.counts).reduce((sum, n) => sum + (n ?? 0), 0);

  // Ticking a type starts it at one question. Unticking it drops its count.
  function toggleType(t: QuestionType) {
    const counts = { ...f.counts };
    if (counts[t]) delete counts[t]; else counts[t] = 1;
    set("counts", counts);
  }

  // The + and - buttons: each selected type has 1 to MAX_PER_TYPE questions.
  function changeCount(t: QuestionType, by: number) {
    set("counts", { ...f.counts, [t]: Math.min(MAX_PER_TYPE, Math.max(1, (f.counts[t] ?? 1) + by)) });
  }

  function addFiles(list: FileList | null) {
    const files = Array.from(list ?? []);
    const problem = pdfProblem(files);
    if (problem) { setError(problem); return; }
    setError(null);
    setNewFiles((prev) => [...prev, ...files]);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) { setError("Role is required."); return; }
    if (!f.description.trim()) { setError("Add the job description."); return; }
    setSaving(true); setError(null);
    let job: Job | null = null;
    try {
      const input = toInput(f);
      job = jobId === undefined ? await api.createJob(input) : await api.updateJob(jobId, input);
      if (newFiles.length) {
        await api.uploadExistingQuestionFiles(job.id, newFiles);
        setNewFiles([]);
      }
      qc.setQueryData(["job", String(job.id)], job);
      await qc.invalidateQueries({ queryKey: ["jobs"] });
      await qc.invalidateQueries({ queryKey: ["existing-questions", job.id] });
      toast.success("Job saved");
      navigate({ to: "/jobs/$jobId/candidates/new", params: { jobId: String(job.id) } });
    } catch (err) {
      // If the job saved but a file upload failed, stay on the saved job so trying again doesn't
      // create a second one.
      if (job && jobId === undefined) navigate({ to: "/jobs/new", search: { job: job.id }, replace: true });
      setError(`${job ? "The job was saved, but the question files could not be uploaded." : "The job could not be saved."} ${errorMessage(err)}`);
    } finally { setSaving(false); }
  }

  // Shown on the dropdown button, in the fixed option order.
  const selectedLabels = QUESTION_TYPES.filter((t) => f.counts[t.value])
    .map((t) => `${t.label} × ${f.counts[t.value]}`).join(", ");

  if (jobId !== undefined && existing.isLoading) return <LoadingRows />;
  if (jobId !== undefined && existing.error) return <ErrorState message={errorMessage(existing.error)} />;

  return (
    <form onSubmit={submit}>
      <PageHeader title="Job Setup" description="Everything here shapes the questions and coding challenge generated for each candidate." />
      <FlowSteps current={1} />

      <Section title="The job">
        <Field label="Role" required>
          <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Backend Software Engineer" />
        </Field>
        <Field label="Job description" required>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
            {DESCRIPTION_PROMPTS.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <Textarea rows={10} value={f.description} onChange={(e) => set("description", e.target.value)} />
        </Field>
        <Field label="Skills you are looking for" hint="Separate skills with commas.">
          <Input value={f.skills} onChange={(e) => set("skills", e.target.value)} placeholder="Python, PostgreSQL, REST APIs" />
        </Field>
      </Section>

      <Section title="Personalized questions"
        description="Choose the types of questions to ask and how many of each. Every candidate gets the same number of each type, written for their resume.">
        <Field label="Question types" note="Plus one coding challenge for every candidate">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="w-full max-w-xl justify-between font-normal">
                <span className={cn("truncate", !selectedLabels && "text-muted-foreground")}>{selectedLabels || "Select question types"}</span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-96 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto">
              {QUESTION_TYPES.map((t) => {
                const count = f.counts[t.value];
                return (
                  <DropdownMenuCheckboxItem key={t.value} checked={count !== undefined}
                    onCheckedChange={() => toggleType(t.value)}
                    onSelect={(e) => e.preventDefault()}>
                    <div className="flex w-full items-center justify-between gap-3">
                      <div>
                        <div>{t.label}</div>
                        <div className="text-xs text-muted-foreground">{t.description}</div>
                      </div>
                      {count !== undefined && (
                        // Clicks on the counter must not reach the row, or they would untick the type.
                        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button type="button" aria-label={`Fewer ${t.label} questions`} disabled={count <= 1}
                            onClick={() => changeCount(t.value, -1)}
                            className="flex h-6 w-6 items-center justify-center rounded border bg-background hover:bg-muted disabled:opacity-40">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-sm font-medium tabular-nums">{count}</span>
                          <button type="button" aria-label={`More ${t.label} questions`} disabled={count >= MAX_PER_TYPE}
                            onClick={() => changeCount(t.value, 1)}
                            className="flex h-6 w-6 items-center justify-center rounded border bg-background hover:bg-muted disabled:opacity-40">
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </DropdownMenuCheckboxItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
          <p className="text-sm">
            <span className="font-medium">{personalizedTotal} personalized {personalizedTotal === 1 ? "question" : "questions"} per candidate</span>
            <span className="ml-1 text-muted-foreground">(up to {MAX_PER_TYPE} of each type), plus the coding challenge</span>
          </p>
        </Field>
      </Section>

      <Section title="Existing interview questions"
        description="Optional. Questions you already ask every candidate. Type them, upload PDFs, or both. Generated questions will not repeat them.">
        <Field label="Questions">
          <Textarea rows={6} value={f.existing_questions} onChange={(e) => set("existing_questions", e.target.value)} />
        </Field>
        <Field label="PDFs" hint={`PDF files up to ${MAX_PDF_MB} MB each. They upload when you save.`}>
          <ExistingFileList
            saved={savedFiles.data ?? []} pending={newFiles} removing={removeFile.isPending ? removeFile.variables : undefined}
            onRemoveSaved={(id) => removeFile.mutate(id)}
            onRemovePending={(i) => setNewFiles((prev) => prev.filter((_, n) => n !== i))} />
          <Input type="file" multiple accept=".pdf" className="max-w-sm" disabled={saving}
            // Clearing the value lets the same file be picked again after removing it.
            onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
        </Field>
      </Section>

      <Section title="Coding challenge" description="Every candidate gets one coding challenge in Python, written for the job and their resume.">
        <Field label="Hiring manager's notes" hint="What should the challenge be like? Jot down your thoughts. The challenge is based mainly on this.">
          <Textarea rows={6} value={f.coding_brief} onChange={(e) => set("coding_brief", e.target.value)} />
        </Field>
        <div className="flex items-start justify-between gap-6 rounded-md border bg-muted/40 p-4">
          <div>
            <label htmlFor="starter-code" className="font-medium">Include starter code and tests</label>
            <p className="mt-1 text-sm text-muted-foreground">
              Without starter code the candidate starts from a blank file, and there are no tests. Applies to resumes uploaded after you save.
            </p>
          </div>
          <Switch id="starter-code" checked={f.starter_code} onCheckedChange={(v) => set("starter_code", v)} />
        </div>
      </Section>

      {error && <div className="mb-4"><ErrorState message={error} /></div>}

      <FlowFooter back={<Button asChild variant="outline"><Link to="/">Back</Link></Button>}>
        <Button type="submit" size="lg" disabled={saving}>
          {saving ? "Saving..." : "Save and continue to Candidates"}
        </Button>
      </FlowFooter>
    </form>
  );
}

function ExistingFileList({ saved, pending, removing, onRemoveSaved, onRemovePending }: {
  saved: { id: number; file_name: string }[];
  pending: File[];
  removing: number | undefined;
  onRemoveSaved: (id: number) => void;
  onRemovePending: (index: number) => void;
}) {
  if (!saved.length && !pending.length) return null;
  const row = (key: string, name: string, note: string, onRemove: () => void, busy = false) => (
    <li key={key} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
      <span className="truncate">{name} <span className="text-muted-foreground">{note}</span></span>
      <Button type="button" variant="ghost" size="sm" aria-label={`Remove ${name}`} disabled={busy} onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
    </li>
  );
  return (
    <ul className="max-w-xl divide-y rounded-md border">
      {saved.map((s) => row(`saved-${s.id}`, s.file_name, "", () => onRemoveSaved(s.id), removing === s.id))}
      {pending.map((p, i) => row(`new-${i}-${p.name}`, p.name, "(uploads when you save)", () => onRemovePending(i)))}
    </ul>
  );
}
