// Page 3: Interview (Page_WorkFlow.md). Shows the generated interview to the recruiter or
// hiring manager, then collects the candidate's finished work. Submitting runs LLM Call #2.
// The candidate never opens this page.
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import { QUESTION_TYPE_LABELS } from "@/lib/constants";
import type { Interview, QuestionType, Submission } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { EmptyState, ErrorState, LoadingRows, PageHeader, formatDate } from "@/components/app-ui";
import { Field, FlowFooter, FlowSteps, Section } from "@/components/flow-ui";

export const Route = createFileRoute("/_authenticated/candidates/$candidateId/interview")({
  head: () => ({
    meta: [
      { title: "Interview — Fit2Hire" },
      { name: "description", content: "The personalized interview for this candidate, and the upload for their finished work." },
      { property: "og:title", content: "Interview — Fit2Hire" },
      { property: "og:description", content: "The personalized interview for this candidate, and the upload for their finished work." },
    ],
  }),
  component: InterviewPage,
});

const SOLUTION_TYPES = [".py", ".java", ".js", ".ts", ".cpp", ".hpp", ".c", ".h", ".txt", ".md"];
const PROCESS_TYPES = [".pdf", ".txt", ".md"];
const MAX_MB = 10;

const typeLabel = (t: QuestionType) => QUESTION_TYPE_LABELS[t];

// Returns a message for the first file that is the wrong type or too large, or null if all are fine.
function fileProblem(files: File[], allowed: string[]): string | null {
  for (const f of files) {
    const ext = f.name.slice(f.name.lastIndexOf(".")).toLowerCase();
    if (!allowed.includes(ext)) return `${f.name} is not an accepted file type. Use ${allowed.join(", ")}.`;
    if (f.size > MAX_MB * 1024 * 1024) return `${f.name} is larger than ${MAX_MB} MB.`;
  }
  return null;
}

function InterviewPage() {
  const { candidateId } = Route.useParams();
  const id = Number(candidateId);
  const qc = useQueryClient();
  const candidate = useQuery({ queryKey: ["candidate", id], queryFn: () => api.getCandidate(id) });
  const interview = useQuery({ queryKey: ["interview", id], queryFn: () => api.getInterview(id) });
  const submission = useQuery({ queryKey: ["submission", id], queryFn: () => api.getSubmission(id) });

  // Only needed when LLM Call #1 failed on Page 2 and the candidate was saved without an interview.
  const generate = useMutation({
    mutationFn: () => api.generateInterview(id),
    onSuccess: (data) => {
      qc.setQueryData(["interview", id], data);
      void qc.invalidateQueries({ queryKey: ["candidate", id] });
      void qc.invalidateQueries({ queryKey: ["candidates"] });
    },
  });

  if (candidate.isLoading || interview.isLoading || submission.isLoading) return <LoadingRows />;
  const loadError = candidate.error ?? interview.error ?? submission.error;
  if (loadError || !candidate.data) return <ErrorState message={errorMessage(loadError)} />;

  if (!interview.data) {
    return (
      <div>
        <PageHeader title={candidate.data.name} description="The interview for this candidate has not been generated yet." />
        <FlowSteps current={3} />
        <EmptyState title="No interview yet" description="Generating it can take up to 90 seconds."
          action={<Button onClick={() => generate.mutate()} disabled={generate.isPending}>
            {generate.isPending ? "Generating interview..." : "Generate interview"}
          </Button>} />
        {generate.error && <div className="mt-4"><ErrorState message={`The interview could not be generated. ${errorMessage(generate.error)}`} /></div>}
        <FlowFooter back={<Button asChild variant="outline">
          <Link to="/jobs/$jobId/candidates/new" params={{ jobId: String(candidate.data.job_id) }} search={{ candidate: id }}>Back</Link>
        </Button>} />
      </div>
    );
  }

  const analyzed = candidate.data.status === "analyzed";
  return (
    <div>
      <PageHeader title={interview.data.candidate_name} description={`Interviewing for ${interview.data.position}`}
        actions={analyzed && (
          <Button asChild variant="outline">
            <Link to="/candidates/$candidateId/analysis" params={{ candidateId }}>View analysis</Link>
          </Button>
        )} />
      <FlowSteps current={3} />
      <InterviewContent interview={interview.data} />
      <SubmissionForm candidateId={id} jobId={candidate.data.job_id} existing={submission.data ?? null} analyzed={analyzed} />
    </div>
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

function CodeBlock({ title, code }: { title: string; code: string }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm font-medium">{title}</div>
        <CopyButton text={code} what={title} />
      </div>
      <pre className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-4 font-mono text-[13px] leading-relaxed">{code}</pre>
    </div>
  );
}

function InterviewContent({ interview }: { interview: Interview }) {
  const p = interview.technical_problem;
  return (
    <>
      <Section title="Personalized questions" description="Add these to your usual interview. Each one notes what it is based on.">
        <ol className="space-y-4">
          {interview.personalized_questions.map((q, i) => (
            <li key={q.question_id} className="rounded-md border p-4">
              <div className="mb-2 flex items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">Question {i + 1}</span>
                <Badge variant="outline">{typeLabel(q.type)}</Badge>
              </div>
              <p className="text-sm">{q.text}</p>
              <p className="mt-2 text-xs text-muted-foreground"><span className="font-medium">Based on: </span>{q.rationale}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="Technical problem"
        description="Give the candidate the problem statement, the starter code if there is any, and the test cases. The candidate documents their implementation plan and process while solving.">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Badge variant="outline" className="font-mono">{p.language}</Badge>
          <span className="text-muted-foreground"><span className="font-medium">Why this problem: </span>{p.rationale}</span>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="text-sm font-medium">Problem statement</div>
            <CopyButton text={p.problem_statement} what="Problem statement" />
          </div>
          <div className="md-preview rounded-md border p-5 text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{p.problem_statement}</ReactMarkdown>
          </div>
        </div>

        {p.skeleton_code
          ? <CodeBlock title="Starter code" code={p.skeleton_code} />
          : <p className="text-sm text-muted-foreground">No starter code. This candidate has the broad technical prompt.</p>}

        <CodeBlock title="Test cases" code={p.test_code} />

        <Collapsible className="rounded-md border border-dashed p-4">
          <CollapsibleTrigger className="group flex w-full items-center justify-between text-sm font-medium">
            Reference solution, for the hiring team only
            <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <p className="mb-3 text-sm text-destructive">Do not give this to the candidate.</p>
            <pre className="max-h-96 overflow-auto rounded-md border bg-muted/40 p-4 font-mono text-[13px] leading-relaxed">{p.reference_solution}</pre>
          </CollapsibleContent>
        </Collapsible>
      </Section>
    </>
  );
}

function SubmissionForm({ candidateId, jobId, existing, analyzed }: { candidateId: number; jobId: number; existing: Submission | null; analyzed: boolean }) {
  const [solutionFiles, setSolutionFiles] = useState<File[]>([]);
  const [processFiles, setProcessFiles] = useState<File[]>([]);
  const [phase, setPhase] = useState<"idle" | "uploading" | "analyzing">("idle");
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const busy = phase !== "idle";
  // With work already uploaded, the user can analyze it as is or replace it with new files.
  const uploadNeeded = !existing || solutionFiles.length > 0 || processFiles.length > 0;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (uploadNeeded) {
      if (!solutionFiles.length) { setError("Upload the candidate's completed solution."); return; }
      if (!processFiles.length) { setError("Upload the candidate's implementation plan and final process."); return; }
      const problem = fileProblem(solutionFiles, SOLUTION_TYPES) ?? fileProblem(processFiles, PROCESS_TYPES);
      if (problem) { setError(problem); return; }
    }
    setError(null);
    let step = "The submission could not be uploaded.";
    try {
      if (uploadNeeded) {
        setPhase("uploading");
        qc.setQueryData(["submission", candidateId], await api.createSubmission(candidateId, { solutionFiles, processFiles }));
      }
      // LLM Call #2. The server adds the submission to the existing Markdown context file.
      step = "The analysis could not be generated.";
      setPhase("analyzing");
      await api.generateAnalysis(candidateId);
      await qc.invalidateQueries({ queryKey: ["candidates"] });
      await qc.invalidateQueries({ queryKey: ["candidate", candidateId] });
      navigate({ to: "/candidates/$candidateId/analysis", params: { candidateId: String(candidateId) } });
    } catch (err) {
      setError(`${step} ${errorMessage(err)}`);
      void qc.invalidateQueries({ queryKey: ["candidate", candidateId] });
    } finally { setPhase("idle"); }
  }

  return (
    <form onSubmit={submit}>
      <Section title="Submission" description="The candidate works outside this tool. When they finish, upload their work here.">
        {existing && (
          <div className="rounded-md border bg-muted/40 p-4 text-sm">
            <div className="font-medium">Already uploaded on {formatDate(existing.created_at)}</div>
            <div className="mt-1 text-muted-foreground">Solution: {existing.solution_file_names.join(", ")}</div>
            <div className="text-muted-foreground">Plan and process: {existing.process_file_names.join(", ")}</div>
            <div className="mt-2 text-muted-foreground">Choose new files below only if you want to replace these.</div>
          </div>
        )}
        <Field label="Completed solution" required={!existing} hint={`One or more files. Accepted: ${SOLUTION_TYPES.join(", ")}.`}>
          <Input type="file" multiple accept={SOLUTION_TYPES.join(",")} className="max-w-md" disabled={busy}
            onChange={(e) => setSolutionFiles(Array.from(e.target.files ?? []))} />
        </Field>
        <Field label="Implementation plan and final process" required={!existing} hint={`One or more files. Accepted: ${PROCESS_TYPES.join(", ")}.`}>
          <Input type="file" multiple accept={PROCESS_TYPES.join(",")} className="max-w-md" disabled={busy}
            onChange={(e) => setProcessFiles(Array.from(e.target.files ?? []))} />
        </Field>
      </Section>

      {error && <div className="mb-4"><ErrorState message={error} /></div>}

      <FlowFooter back={
        <Button asChild variant="outline">
          <Link to="/jobs/$jobId/candidates/new" params={{ jobId: String(jobId) }} search={{ candidate: candidateId }}>Back</Link>
        </Button>}>
        {phase === "analyzing" && (
          <span className="text-sm text-muted-foreground">Analyzing the submission. This can take up to 90 seconds.</span>
        )}
        <Button type="submit" size="lg" disabled={busy}>
          {phase === "uploading" ? "Uploading..." : phase === "analyzing" ? "Analyzing..." : analyzed ? "Analyze again" : "Analyze candidate"}
        </Button>
      </FlowFooter>
    </form>
  );
}
