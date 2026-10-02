// Page 1: Job Setup (Page_WorkFlow.md).
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { QUESTION_TYPES } from "@/lib/constants";
import type { JobInput, QuestionType } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, PageHeader } from "@/components/app-ui";
import { Field, FlowSteps, Section } from "@/components/flow-ui";

export const Route = createFileRoute("/_authenticated/jobs/new")({
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
const empty: JobInput = { title: "", posting_text: "", question_types: ["coding"], context: "" };

function JobSetup() {
  const [f, setF] = useState<JobInput>(empty);
  const [postingFile, setPostingFile] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const set = <K extends keyof JobInput>(k: K, v: JobInput[K]) => setF((p) => ({ ...p, [k]: v }));

  function toggleType(t: QuestionType) {
    if (t === "coding") return;
    set("question_types", f.question_types.includes(t) ? f.question_types.filter((x) => x !== t) : [...f.question_types, t]);
  }

  async function uploadPosting(file: File | undefined) {
    if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!POSTING_TYPES.includes(ext)) { setError("The job posting must be a PDF, TXT, or MD file."); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setError(`The job posting must be ${MAX_MB} MB or smaller.`); return; }
    setUploading(true); setError(null);
    try {
      const res = await api.extractText(file);
      set("posting_text", res.text);
      setPostingFile(res.file_name);
    } catch (e) {
      setError(`The job posting could not be read. ${errorMessage(e)}`);
    } finally { setUploading(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) { setError("Role is required."); return; }
    if (!f.posting_text.trim()) { setError("Paste or upload the public job posting."); return; }
    if (!f.context.trim()) { setError("Add the hiring manager context."); return; }
    setSaving(true); setError(null);
    try {
      const job = await api.createJob({ ...f, title: f.title.trim() });
      await qc.invalidateQueries({ queryKey: ["jobs"] });
      toast.success("Job saved");
      navigate({ to: "/jobs/$jobId/candidates/new", params: { jobId: String(job.id) } });
    } catch (err) {
      setError(`The job could not be saved. ${errorMessage(err)}`);
    } finally { setSaving(false); }
  }

  // Shown on the dropdown button, in the fixed option order.
  const selectedLabels = QUESTION_TYPES.filter((t) => f.question_types.includes(t.value)).map((t) => t.label).join(", ");

  return (
    <form onSubmit={submit}>
      <PageHeader title="Job Setup" description="This information is used as context for the interview and the final analysis." />
      <FlowSteps current={1} />

      <Section title="Public job posting" description="Paste or upload the company's original public posting in one piece.">
        <Field label="Role" required>
          <Input value={f.title} onChange={(e) => set("title", e.target.value)} placeholder="Backend Software Engineer" />
        </Field>
        <Field label="Job posting" required hint="Covers qualifications, description, and preferences. Upload a PDF, TXT, or MD file, or paste the text below.">
          <div className="flex flex-wrap items-center gap-3">
            <Input type="file" accept={POSTING_TYPES.join(",")} className="max-w-sm" disabled={uploading}
              onChange={(e) => uploadPosting(e.target.files?.[0])} />
            {uploading ? <span className="text-sm text-muted-foreground">Reading file...</span>
              : postingFile && <span className="text-sm text-muted-foreground">Filled from {postingFile}</span>}
          </div>
          <Textarea rows={10} value={f.posting_text}
            onChange={(e) => { set("posting_text", e.target.value); setPostingFile(null); }} />
        </Field>
      </Section>

      <Section title="Key priorities" description="What matters most for this hire. This decides which types of personalized questions are generated.">
        <Field label="Question types" required hint="Select all that apply. Coding is always included.">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="w-full max-w-md justify-between font-normal">
                <span className="truncate">{selectedLabels}</span>
                <ChevronDown className="h-4 w-4 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-[var(--radix-dropdown-menu-trigger-width)]">
              {QUESTION_TYPES.map((t) => (
                <DropdownMenuCheckboxItem key={t.value} checked={f.question_types.includes(t.value)}
                  disabled={t.value === "coding"} onCheckedChange={() => toggleType(t.value)}
                  onSelect={(e) => e.preventDefault()}>
                  <div>
                    <div>{t.label}</div>
                    <div className="text-xs text-muted-foreground">{t.description}</div>
                  </div>
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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

      <div className="flex justify-end">
        <Button type="submit" size="lg" disabled={saving || uploading}>
          {saving ? "Saving..." : "Save and continue to Candidate Setup"}
        </Button>
      </div>
    </form>
  );
}
