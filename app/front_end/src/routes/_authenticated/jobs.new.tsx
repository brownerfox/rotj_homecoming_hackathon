// Page 1: Job Setup (Page_WorkFlow.md).
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { ChevronDown, Minus, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { MAX_TOTAL_QUESTIONS, QUESTION_TYPES } from "@/lib/constants";
import type { JobInput, QuestionType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, LoadingRows, PageHeader } from "@/components/app-ui";
import { Field, FlowFooter, FlowSteps, Section } from "@/components/flow-ui";
import { cn, toId } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/jobs/new")({
  // ?job= opens a saved job for editing. ?candidate= is carried along so Page 2 can reopen that candidate.
  validateSearch: (search: Record<string, unknown>): { job?: number; candidate?: number } => {
    const job = toId(search["job"]);
    const candidate = toId(search["candidate"]);
    return { ...(job === undefined ? {} : { job }), ...(candidate === undefined ? {} : { candidate }) };
  },
  head: () => ({
    meta: [
      { title: "Job Setup — Fit2Hire" },
      { name: "description", content: "Enter the public job posting, the key priorities, and the hiring manager's context." },
      { property: "og:title", content: "Job Setup — Fit2Hire" },
      { property: "og:description", content: "Enter the public job posting, the key priorities, and the hiring manager's context." },
    ],
  }),
  component: JobSetup,
});

const POSTING_TYPES = [".pdf", ".txt", ".md"];
const MAX_MB = 10;

// What the hiring manager context box should cover (Page_WorkFlow.md, Page 1).
const CONTEXT_PROMPTS = [
  "Current company and team work",
  "What the new hire will work on",
  "Desired working style",
  "Important skills or qualities",
  "Anything about culture",
  "Anything not captured by the public post",
];

// Coding is always selected, because every interview includes a technical problem.
const empty: JobInput = { title: "", posting_text: "", question_types: ["coding"], question_counts: {}, existing_questions: "", context: "" };

function JobSetup() {
  const [f, setF] = useState<JobInput>(empty);
  const [postingFile, setPostingFile] = useState<string | null>(null);
  const [questionsFile, setQuestionsFile] = useState<string | null>(null);
  // Which box is being filled from an upload, if any.
  const [uploading, setUploading] = useState<"posting_text" | "existing_questions" | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const set = <K extends keyof JobInput>(k: K, v: JobInput[K]) => setF((p) => ({ ...p, [k]: v }));

  // Coming back from Page 2 edits the saved job instead of creating a second one.
  const { job: jobId, candidate: candidateId } = Route.useSearch();
  const existing = useQuery({
    queryKey: ["job", String(jobId)], queryFn: () => api.getJob(jobId ?? 0), enabled: jobId !== undefined,
  });
  useEffect(() => {
    if (jobId === undefined) { setF(empty); setPostingFile(null); setQuestionsFile(null); return; }
    if (existing.data) {
      const { title, posting_text, question_types, question_counts, existing_questions, context } = existing.data;
      setF({
        title, posting_text, context,
        // Every selected type needs a count. A job saved before counts existed gets one each.
        question_counts: Object.fromEntries(
          question_types.filter((t) => t !== "coding").map((t) => [t, question_counts?.[t] ?? 1]),
        ),
        // A server that has not added this field yet sends nothing for it.
        existing_questions: existing_questions ?? "",
        question_types: question_types.includes("coding") ? question_types : [...question_types, "coding"],
      });
    }
  }, [jobId, existing.data]);

  // Every generated question: the personalized ones plus the one coding problem.
  const totalQuestions = 1 + f.question_types.reduce((sum, t) => sum + (t === "coding" ? 0 : f.question_counts[t] ?? 1), 0);
  const atLimit = totalQuestions >= MAX_TOTAL_QUESTIONS;

  // Ticking a type starts it at one question. Unticking it drops its count.
  function toggleType(t: QuestionType) {
    const selected = f.question_types.includes(t);
    if (!selected && atLimit) return;
    const counts = { ...f.question_counts };
    if (selected) delete counts[t]; else counts[t] = 1;
    setF((p) => ({
      ...p,
      question_types: selected ? p.question_types.filter((x) => x !== t) : [...p.question_types, t],
      question_counts: counts,
    }));
  }

  // The + and - buttons. A selected type has at least 1. Adding stops once the total reaches the limit.
  function changeCount(t: QuestionType, by: number) {
    if (by > 0 && atLimit) return;
    set("question_counts", { ...f.question_counts, [t]: Math.max(1, (f.question_counts[t] ?? 1) + by) });
  }

  // Reads an uploaded file and puts its text into the job posting box or the existing questions box.
  async function fillFromFile(file: File | undefined, field: "posting_text" | "existing_questions") {
    if (!file) return;
    const what = field === "posting_text" ? "job posting" : "questions file";
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!POSTING_TYPES.includes(ext)) { setError(`The ${what} must be a PDF, TXT, or MD file.`); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setError(`The ${what} must be ${MAX_MB} MB or smaller.`); return; }
    setUploading(field); setError(null);
    try {
      const res = await api.extractText(file);
      set(field, res.text);
      (field === "posting_text" ? setPostingFile : setQuestionsFile)(res.file_name);
    } catch (e) {
      setError(`The ${what} could not be read. ${errorMessage(e)}`);
    } finally { setUploading(null); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) { setError("Role is required."); return; }
    if (!f.posting_text.trim()) { setError("Paste or upload the public job posting."); return; }
    if (!f.context.trim()) { setError("Add the hiring manager context."); return; }
    setSaving(true); setError(null);
    try {
      const input = { ...f, title: f.title.trim() };
      const job = jobId === undefined ? await api.createJob(input) : await api.updateJob(jobId, input);
      qc.setQueryData(["job", String(job.id)], job);
      await qc.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job saved");
      navigate({
        to: "/jobs/$jobId/candidates/new", params: { jobId: String(job.id) },
        search: candidateId === undefined ? {} : { candidate: candidateId },
      });
    } catch (err) {
      setError(`The job could not be saved. ${errorMessage(err)}`);
    } finally { setSaving(false); }
  }

  // Shown on the dropdown button, in the fixed option order.
  const selected = QUESTION_TYPES.filter((t) => f.question_types.includes(t.value));
  const selectedLabels = selected.map((t) => `${t.label} × ${f.question_counts[t.value] ?? 1}`).join(", ");
  const personalizedTotal = totalQuestions - 1;

  if (jobId !== undefined && existing.isLoading) return <LoadingRows />;
  if (jobId !== undefined && existing.error) return <ErrorState message={errorMessage(existing.error)} />;

  return (
    <form onSubmit={submit}>
      <PageHeader title="Job Setup" description="This information is used as context for the interview and the final analysis." />
      <FlowSteps current={1} />

      <Section title="Public job posting" description="Paste or upload the company's original public posting in one piece.">
        <Field label="Role" required>
          <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Backend Software Engineer" />
        </Field>
        <Field label="Job posting" required>
          <div className="flex flex-wrap items-center gap-3">
            <Input type="file" accept={POSTING_TYPES.join(",")} className="max-w-sm" disabled={uploading !== null}
              onChange={(e) => fillFromFile(e.target.files?.[0], "posting_text")} />
            {uploading === "posting_text" ? <span className="text-sm text-muted-foreground">Reading file...</span>
              : postingFile && <span className="text-sm text-muted-foreground">Filled from {postingFile}</span>}
          </div>
          <Textarea rows={10} value={f.posting_text}
            onChange={(e) => { set("posting_text", e.target.value); setPostingFile(null); }} />
        </Field>
      </Section>

      <Section title="Key priorities" description="What matters most for this hire. This decides which types of personalized questions are generated.">
        <Field label="Question types" required note="Coding is always included">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="w-full max-w-xl justify-between font-normal">
                <span className={cn("truncate", !selectedLabels && "text-muted-foreground")}>{selectedLabels || "Select question types"}</span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="max-h-96 w-[var(--radix-dropdown-menu-trigger-width)] overflow-y-auto">
              {atLimit && (
                <div className="sticky top-0 z-10 border-b bg-popover px-2 py-1.5 text-xs font-medium text-destructive">
                  The limit is {MAX_TOTAL_QUESTIONS} questions.
                </div>
              )}
              {QUESTION_TYPES.map((t) => {
                const checked = f.question_types.includes(t.value);
                const count = f.question_counts[t.value] ?? 1;
                return (
                  <DropdownMenuCheckboxItem key={t.value} checked={checked} disabled={!checked && atLimit}
                    onCheckedChange={() => toggleType(t.value)}
                    onSelect={(e) => e.preventDefault()}>
                    <div className="flex w-full items-center justify-between gap-3">
                      <div>
                        <div>{t.label}</div>
                        <div className="text-xs text-muted-foreground">{t.description}</div>
                      </div>
                      {checked && (
                        // Clicks on the counter must not reach the row, or they would untick the type.
                        <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                          <button type="button" aria-label={`Fewer ${t.label} questions`} disabled={count <= 1}
                            onClick={() => changeCount(t.value, -1)}
                            className="flex h-6 w-6 items-center justify-center rounded border bg-background hover:bg-muted disabled:opacity-40">
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-sm font-medium tabular-nums">{count}</span>
                          <button type="button" aria-label={`More ${t.label} questions`} disabled={atLimit}
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
            <span className="font-medium">Total generated questions: {totalQuestions}</span>{" "}
            <span className="ml-1 text-muted-foreground">({personalizedTotal} personalized, plus the coding problem)</span>
            {atLimit && <span className="ml-2 font-medium text-destructive">The limit is {MAX_TOTAL_QUESTIONS} questions.</span>}
          </p>
        </Field>
      </Section>

      <Section title="Existing interview questions"
        description="Questions you already ask every candidate. Type them or upload a file. Generated questions will not repeat them.">
        <Field label="Questions">
          <div className="flex flex-wrap items-center gap-3">
            <Input type="file" accept={POSTING_TYPES.join(",")} className="max-w-sm" disabled={uploading !== null}
              onChange={(e) => fillFromFile(e.target.files?.[0], "existing_questions")} />
            {uploading === "existing_questions" ? <span className="text-sm text-muted-foreground">Reading file...</span>
              : questionsFile && <span className="text-sm text-muted-foreground">Filled from {questionsFile}</span>}
          </div>
          <Textarea rows={6} value={f.existing_questions}
            onChange={(e) => { set("existing_questions", e.target.value); setQuestionsFile(null); }} />
        </Field>
      </Section>

      <Section title="Hiring manager context" description="Everything the hiring manager wants the interview and analysis to take into account.">
        <Field label="Context" required>
          <ul className="list-disc space-y-0.5 pl-5 text-xs text-muted-foreground">
            {CONTEXT_PROMPTS.map((p) => <li key={p}>{p}</li>)}
          </ul>
          <Textarea rows={10} value={f.context} onChange={(e) => set("context", e.target.value)} />
        </Field>
      </Section>

      {error && <div className="mb-4"><ErrorState message={error} /></div>}

      <FlowFooter back={<Button asChild variant="outline"><Link to="/">Back</Link></Button>}>
        <Button type="submit" size="lg" disabled={saving || uploading !== null}>
          {saving ? "Saving..." : "Save and continue to Candidate Setup"}
        </Button>
      </FlowFooter>
    </form>
  );
}
