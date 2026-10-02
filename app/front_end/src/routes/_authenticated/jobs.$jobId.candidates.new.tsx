// Page 2: Candidate Setup (Page_WorkFlow.md). Saving this page runs LLM Call #1.
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/api";
import { INTERVIEW_STYLES } from "@/lib/constants";
import type { ExtractedText, InterviewStyle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ErrorState, LoadingRows, PageHeader } from "@/components/app-ui";
import { Field, FlowSteps, Section } from "@/components/flow-ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/jobs/$jobId/candidates/new")({
  head: () => ({
    meta: [
      { title: "Candidate Setup — Fit2Hire" },
      { name: "description", content: "Add the candidate's resume and choose the technical interview style." },
      { property: "og:title", content: "Candidate Setup — Fit2Hire" },
      { property: "og:description", content: "Add the candidate's resume and choose the technical interview style." },
    ],
  }),
  component: CandidateSetup,
});

const RESUME_TYPES = [".pdf", ".txt", ".md"];
const MAX_MB = 10;

// What the candidate must document (Page_WorkFlow.md, Page 2).
const DOCUMENTATION_ITEMS = ["Implementation plan", "Thought process", "Final approach"];

function CandidateSetup() {
  const { jobId } = Route.useParams();
  const job = useQuery({ queryKey: ["job", jobId], queryFn: () => api.getJob(Number(jobId)) });
  const [name, setName] = useState("");
  const [resume, setResume] = useState<ExtractedText | null>(null);
  const [style, setStyle] = useState<InterviewStyle | null>(null);
  // Set once the candidate is saved, so a retry after a failed generation reuses it.
  const [candidateId, setCandidateId] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [phase, setPhase] = useState<"idle" | "saving" | "generating">("idle");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const busy = phase !== "idle";

  async function uploadResume(file: File | undefined) {
    if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!RESUME_TYPES.includes(ext)) { setError("The resume must be a PDF, TXT, or MD file."); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setError(`The resume must be ${MAX_MB} MB or smaller.`); return; }
    setUploading(true); setError(null);
    try {
      setResume(await api.extractText(file));
    } catch (e) {
      setResume(null);
      setError(`The resume could not be read. ${errorMessage(e)}`);
    } finally { setUploading(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Candidate name is required."); return; }
    if (!resume) { setError("Upload the candidate's resume."); return; }
    if (!style) { setError("Choose a technical interview style."); return; }
    setError(null);
    let step = "The candidate could not be saved.";
    try {
      setPhase("saving");
      const input = { name: name.trim(), resume_text: resume.text, interview_style: style };
      const candidate = candidateId === null
        ? await api.createCandidate(Number(jobId), input)
        : await api.updateCandidate(candidateId, input);
      setCandidateId(candidate.id);

      // LLM Call #1. The server combines Page 1 and Page 2 into the Markdown context file.
      step = "The interview could not be generated.";
      setPhase("generating");
      await api.generateInterview(candidate.id);
      await qc.invalidateQueries({ queryKey: ["candidates"] });
      navigate({ to: "/candidates/$candidateId/interview", params: { candidateId: String(candidate.id) } });
    } catch (err) {
      setError(`${step} ${errorMessage(err)}`);
    } finally { setPhase("idle"); }
  }

  if (job.isLoading) return <LoadingRows />;
  if (job.error || !job.data) return <ErrorState message={errorMessage(job.error)} />;

  return (
    <form onSubmit={submit}>
      <PageHeader title="Candidate Setup" description={`Add a candidate for ${job.data.title} and choose how they will be tested.`} />
      <FlowSteps current={2} />

      <Section title="Candidate">
        <Field label="Candidate name" required>
          <Input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
        </Field>
        <Field label="Resume" required hint="Upload a PDF, TXT, or MD file, up to 10 MB.">
          <div className="flex flex-wrap items-center gap-3">
            <Input type="file" accept={RESUME_TYPES.join(",")} className="max-w-sm" disabled={uploading || busy}
              onChange={(e) => uploadResume(e.target.files?.[0])} />
            {uploading ? <span className="text-sm text-muted-foreground">Reading file...</span>
              : resume && <span className="text-sm text-muted-foreground">Read {resume.file_name}</span>}
          </div>
        </Field>
      </Section>

      <Section title="Technical interview style" description="Pick one. Both options include ready-to-run test cases.">
        <RadioGroup value={style ?? ""} onValueChange={(v) => setStyle(v as InterviewStyle)} disabled={busy} className="gap-3">
          {INTERVIEW_STYLES.map((s) => (
            <label key={s.value} htmlFor={`style-${s.value}`}
              className={cn("flex cursor-pointer items-start gap-3 rounded-md border p-4", style === s.value && "border-primary bg-accent")}>
              <RadioGroupItem id={`style-${s.value}`} value={s.value} className="mt-0.5" />
              <div>
                <div className="text-sm font-medium">{s.label}</div>
                <p className="text-sm text-muted-foreground">{s.description}</p>
              </div>
            </label>
          ))}
        </RadioGroup>
      </Section>

      <Section title="Candidate documentation"
        description="The interview requires the candidate to document their work, using the method of their choice. The documentation must cover:">
        <ul className="list-disc space-y-1 pl-5 text-sm">
          {DOCUMENTATION_ITEMS.map((d) => <li key={d}>{d}</li>)}
        </ul>
      </Section>

      {error && <div className="mb-4"><ErrorState message={error} /></div>}

      <div className="flex flex-wrap items-center justify-end gap-4">
        {phase === "generating" && (
          <span className="text-sm text-muted-foreground">Writing the interview. This can take up to 90 seconds.</span>
        )}
        <Button type="submit" size="lg" disabled={busy || uploading}>
          {phase === "saving" ? "Saving..." : phase === "generating" ? "Generating interview..." : "Generate interview"}
        </Button>
      </div>
    </form>
  );
}
