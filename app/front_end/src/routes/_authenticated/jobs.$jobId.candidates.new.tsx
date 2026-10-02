// Page 2: Candidate Setup (Page_WorkFlow.md). Saving this page runs LLM Call #1.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { api, errorMessage } from "@/lib/api";
import { nameFromResume } from "@/lib/candidate-name";
import { INTERVIEW_STYLES } from "@/lib/constants";
import type { ExtractedText, InterviewStyle } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ErrorState, LoadingRows, PageHeader } from "@/components/app-ui";
import { Field, FlowFooter, FlowSteps, Section } from "@/components/flow-ui";
import { cn, toId } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/jobs/$jobId/candidates/new")({
  // ?candidate= opens a saved candidate for editing, when coming back from Page 3.
  validateSearch: (search: Record<string, unknown>): { candidate?: number } => {
    const candidate = toId(search["candidate"]);
    return candidate === undefined ? {} : { candidate };
  },
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
  // Read from the resume. The user only types it if it could not be read.
  const [name, setName] = useState("");
  const [nameUnreadable, setNameUnreadable] = useState(false);
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

  // Coming back from Page 3 edits the saved candidate instead of adding a second one.
  const { candidate: editId } = Route.useSearch();
  const existing = useQuery({
    queryKey: ["candidate", editId], queryFn: () => api.getCandidate(editId ?? 0), enabled: editId !== undefined,
  });
  useEffect(() => {
    if (!existing.data) return;
    setName(existing.data.name);
    setStyle(existing.data.interview_style);
    // An empty file name marks the resume that is already saved.
    setResume({ file_name: "", text: existing.data.resume_text });
    setCandidateId(existing.data.id);
  }, [existing.data]);
  const hasInterview = existing.data !== undefined && existing.data.status !== "setup";

  async function uploadResume(file: File | undefined) {
    if (!file) return;
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!RESUME_TYPES.includes(ext)) { setError("The resume must be a PDF, TXT, or MD file."); return; }
    if (file.size > MAX_MB * 1024 * 1024) { setError(`The resume must be ${MAX_MB} MB or smaller.`); return; }
    setUploading(true); setError(null);
    try {
      const extracted = await api.extractText(file);
      const found = nameFromResume(extracted.text, extracted.file_name);
      setResume(extracted);
      setName(found ?? "");
      setNameUnreadable(found === null);
    } catch (e) {
      setResume(null);
      setError(`The resume could not be read. ${errorMessage(e)}`);
    } finally { setUploading(false); }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!resume) { setError("Upload the candidate's resume."); return; }
    if (!name.trim()) { setError("Enter the candidate's name. It could not be read from the resume."); return; }
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

  if (job.isLoading || (editId !== undefined && existing.isLoading)) return <LoadingRows />;
  if (job.error || !job.data) return <ErrorState message={errorMessage(job.error)} />;
  if (existing.error) return <ErrorState message={errorMessage(existing.error)} />;

  return (
    <form onSubmit={submit}>
      <PageHeader title="Candidate Setup" description={`Add a candidate for ${job.data.title} and choose how they will be tested.`} />
      <FlowSteps current={2} />

      <Section title="Candidate">
        <Field label="Resume" required hint="Upload a PDF, TXT, or MD file, up to 10 MB.">
          <div className="flex flex-wrap items-center gap-3">
            <Input type="file" accept={RESUME_TYPES.join(",")} className="max-w-sm" disabled={uploading || busy}
              onChange={(e) => uploadResume(e.target.files?.[0])} />
            {uploading ? <span className="text-sm text-muted-foreground">Reading file...</span>
              : resume && (
                <span className="text-sm text-muted-foreground">
                  {resume.file_name ? `Read ${resume.file_name}` : "Resume already on file. Choose a file to replace it."}
                </span>
              )}
          </div>
        </Field>
        {resume && !nameUnreadable && (
          <div>
            <div className="text-base font-medium">Candidate name</div>
            <div className="mt-1 text-sm">{name} <span className="text-muted-foreground">(read from the resume)</span></div>
          </div>
        )}
        {nameUnreadable && (
          <Field label="Candidate name" required hint="The name could not be read from this resume, so please enter it.">
            <Input value={name} onChange={(e) => setName(e.target.value)} disabled={busy} />
          </Field>
        )}
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

      <FlowFooter back={
        <Button asChild variant="outline">
          <Link to="/jobs/new" search={editId === undefined ? { job: Number(jobId) } : { job: Number(jobId), candidate: editId }}>Back</Link>
        </Button>}>
        {phase === "generating" && (
          <span className="text-sm text-muted-foreground">Writing the interview. This can take up to 90 seconds.</span>
        )}
        {hasInterview && phase === "idle" && (
          <>
            <span className="text-sm text-muted-foreground">Regenerating replaces the current interview.</span>
            <Button asChild variant="outline" size="lg">
              <Link to="/candidates/$candidateId/interview" params={{ candidateId: String(editId) }}>Continue to interview</Link>
            </Button>
          </>
        )}
        <Button type="submit" size="lg" disabled={busy || uploading}>
          {phase === "saving" ? "Saving..." : phase === "generating" ? "Generating interview..."
            : hasInterview ? "Regenerate interview" : "Generate interview"}
        </Button>
      </FlowFooter>
    </form>
  );
}
