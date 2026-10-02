import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { api, errorMessage } from "@/lib/api";
import { LANGUAGE_EXTENSIONS, difficultyLabel, levelLabel } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, PageHeader } from "@/components/app-ui";

export const Route = createFileRoute("/_authenticated/submissions/new")({
  validateSearch: z.object({ assessment: z.string().optional() }),
  head: () => ({
    meta: [
      { title: "Evaluate Submission — Calibrate" },
      { name: "description", content: "Upload a candidate's completed code to evaluate it against an assessment." },
      { property: "og:title", content: "Evaluate Submission — Calibrate" },
      { property: "og:description", content: "Upload a candidate's completed code for evaluation." },
    ],
  }),
  component: NewSubmission,
});

const MAX_MB = 20;

function NewSubmission() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: ["assessments"], queryFn: api.listAssessments });
  const [assessmentId, setAssessmentId] = useState(search.assessment ?? "");
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [question, setQuestion] = useState("all");
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const a = list.data?.find((x) => x.id === assessmentId);
  const exts = a ? [...LANGUAGE_EXTENSIONS[a.programming_language], ".zip"] : [];

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!a) return setError("Select an assessment.");
    if (!name.trim() || !identifier.trim()) return setError("Candidate name and identifier are required.");
    if (!file) return setError("Upload the candidate's code file.");
    const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!exts.includes(ext)) return setError(`Invalid file type. For ${a.programming_language}, upload ${exts.join(", ")}.`);
    if (file.size > MAX_MB * 1024 * 1024) return setError(`File must be ${MAX_MB} MB or smaller.`);
    setBusy(true);
    try {
      const s = await api.createSubmission({
        assessment_id: a.id, candidate_name: name.trim(), candidate_identifier: identifier.trim(),
        question_id: question === "all" ? null : question, file,
      });
      qc.invalidateQueries();
      navigate({ to: "/evaluations/$id", params: { id: s.id } });
    } catch (err) {
      setError(`Code upload failed. ${errorMessage(err)}`);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="Evaluate Submission" description="Associate a candidate's completed code with an assessment. The code is not run here; it is sent with the assessment requirements to the evaluation service." />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card>
          <CardHeader><CardTitle className="text-base">Submission details</CardTitle><CardDescription>All fields are required unless noted.</CardDescription></CardHeader>
          <CardContent>
            <form onSubmit={submit} className="space-y-5">
              <div className="space-y-2">
                <Label>Assessment</Label>
                <Select value={assessmentId} onValueChange={(v) => { setAssessmentId(v); setQuestion("all"); setFile(null); }}>
                  <SelectTrigger><SelectValue placeholder={list.isLoading ? "Loading..." : "Select an assessment"} /></SelectTrigger>
                  <SelectContent>{list.data?.map((x) => <SelectItem key={x.id} value={x.id}>{x.name}</SelectItem>)}</SelectContent>
                </Select>
                {list.error && <ErrorState message={errorMessage(list.error)} />}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label>Candidate name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
                <div className="space-y-2"><Label>Candidate identifier</Label><Input placeholder="e.g. CAND-1042" value={identifier} onChange={(e) => setIdentifier(e.target.value)} /></div>
              </div>
              <div className="space-y-2">
                <Label>Coding question</Label>
                <Select value={question} onValueChange={setQuestion} disabled={!a}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All questions (full submission)</SelectItem>
                    {a?.questions.map((qq) => <SelectItem key={qq.id} value={qq.id}>{qq.id}: {qq.title}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Code file</Label>
                <p className="text-xs text-muted-foreground">
                  {a ? `Accepted: ${exts.join(", ")}. Use a ZIP for multi-file submissions. Up to ${MAX_MB} MB.` : "Select an assessment to see accepted file types."}
                </p>
                <Input type="file" disabled={!a} accept={exts.join(",")} onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              </div>
              {error && <ErrorState message={error} />}
              <Button type="submit" size="lg" disabled={busy}>{busy ? "Uploading..." : "Submit for Evaluation"}</Button>
            </form>
          </CardContent>
        </Card>
        <Card className="h-fit">
          <CardHeader><CardTitle className="text-base">What the candidate was asked</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            {!a ? <p className="text-muted-foreground">Select an assessment to see its requirements.</p> : <>
              <div><span className="text-muted-foreground">Position: </span>{a.position}</div>
              <div><span className="text-muted-foreground">Level: </span>{levelLabel(a.candidate_level)}</div>
              <div><span className="text-muted-foreground">Language: </span><span className="font-mono">{a.programming_language}</span></div>
              <div><span className="text-muted-foreground">Difficulty: </span>{difficultyLabel(a.difficulty, a.custom_difficulty)}</div>
              <div className="pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Requirements</div>
              <ul className="list-disc space-y-0.5 pl-5">{a.technical_requirements.map((r) => <li key={r}>{r}</li>)}</ul>
            </>}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
