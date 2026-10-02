import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import {
  DIFFICULTIES, ENGINEERING_AREAS, LANGUAGES, LEVELS, REQUIREMENT_GROUPS, difficultyLabel, levelLabel,
} from "@/lib/constants";
import type { AssessmentInput, ResumeInsights } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ErrorState, PageHeader } from "@/components/app-ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assessments/new")({
  head: () => ({
    meta: [
      { title: "Create Assessment — Calibrate" },
      { name: "description", content: "Define company, role, and technical requirements for a targeted coding assessment." },
      { property: "og:title", content: "Create Assessment — Calibrate" },
      { property: "og:description", content: "Define requirements for a targeted coding assessment." },
    ],
  }),
  component: CreateAssessment,
});

const STEPS = ["Company", "Role", "Technical Requirements", "Candidate", "Custom Instructions", "Review", "Markdown"];
const RESUME_TYPES = [".pdf", ".docx", ".txt"];

const empty: AssessmentInput = {
  name: "", company_name: "", company_purpose: "", engineering_focus: [], engineering_focus_other: "",
  position: "", candidate_level: "mid", programming_language: "Python", technical_requirements: [],
  custom_technical_requirements: "", general_programming_questions: false, difficulty: "medium",
  custom_difficulty: "", custom_instructions: "", candidate_name: "",
};

function CreateAssessment() {
  const [step, setStep] = useState(0);
  const [f, setF] = useState<AssessmentInput>(empty);
  const [assessmentId, setAssessmentId] = useState<string | null>(null);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [insights, setInsights] = useState<ResumeInsights | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const set = <K extends keyof AssessmentInput>(k: K, v: AssessmentInput[K]) => setF((p) => ({ ...p, [k]: v }));
  const toggle = (k: "engineering_focus" | "technical_requirements", v: string) =>
    set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v]);

  function validate(s: number): string | null {
    if (s === 0) {
      if (!f.company_name.trim()) return "Company name is required.";
      if (!f.company_purpose.trim()) return "Please describe the company's purpose.";
      if (!f.engineering_focus.length) return "Select at least one engineering area.";
      if (f.engineering_focus.includes("Other") && !f.engineering_focus_other.trim()) return "Describe the 'Other' engineering area.";
    }
    if (s === 1 && !f.position.trim()) return "Position is required.";
    if (s === 2) {
      if (!f.technical_requirements.length && !f.custom_technical_requirements.trim()) return "Select at least one technical requirement or describe a custom one.";
      if (f.difficulty === "custom" && !f.custom_difficulty.trim()) return "Describe the custom difficulty.";
    }
    return null;
  }

  async function ensureSaved(): Promise<string> {
    const payload = { ...f, name: f.name.trim() || `${f.position} - ${f.company_name}` };
    if (assessmentId) { await api.updateAssessment(assessmentId, payload); return assessmentId; }
    const a = await api.createAssessment(payload);
    setAssessmentId(a.id);
    return a.id;
  }

  function next() {
    const e = validate(step);
    setError(e);
    if (!e) setStep((s) => Math.min(s + 1, 5));
  }

  async function uploadResume() {
    if (!resumeFile) return;
    const ext = resumeFile.name.slice(resumeFile.name.lastIndexOf(".")).toLowerCase();
    if (!RESUME_TYPES.includes(ext)) { setError("Resume must be a PDF, DOCX, or TXT file."); return; }
    if (resumeFile.size > 10 * 1024 * 1024) { setError("Resume must be 10 MB or smaller."); return; }
    setBusy(true); setError(null);
    try {
      const id = await ensureSaved();
      setInsights(await api.uploadResume(id, resumeFile));
      toast.success("Resume analyzed");
    } catch (e) {
      setError(`Resume upload failed. ${errorMessage(e)}`);
    } finally { setBusy(false); }
  }

  async function generate() {
    for (let s = 0; s < 3; s++) { const e = validate(s); if (e) { setError(e); setStep(s); return; } }
    setBusy(true); setError(null); setStep(6);
    try {
      const id = await ensureSaved();
      await api.generateSpecification(id);
      await qc.invalidateQueries({ queryKey: ["assessments"] });
      navigate({ to: "/assessments/$id/spec", params: { id } });
    } catch (e) {
      setError(`The specification could not be generated. ${errorMessage(e)}`);
      setStep(5);
    } finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader title="Create Assessment" description="Each step adds information that will be included in the Markdown specification passed to the assessment-generation model." />
      <Stepper step={step} onJump={(i) => i < step && setStep(i)} />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <div className="min-w-0">
          {step === 0 && (
            <Section title="Company information" description="Describe what the company builds and the engineering problems its team solves.">
              <Field label="Company name" required><Input value={f.company_name} onChange={(e) => set("company_name", e.target.value)} /></Field>
              <Field label="Company purpose" required hint="What the company does, what problem its software solves, what engineers work on, and the kinds of technical problems the team solves.">
                <Textarea rows={6} value={f.company_purpose} onChange={(e) => set("company_purpose", e.target.value)} />
              </Field>
              <Field label="Primary software engineering application" required hint="Select all that apply.">
                <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                  {ENGINEERING_AREAS.map((a) => <CheckItem key={a} label={a} checked={f.engineering_focus.includes(a)} onChange={() => toggle("engineering_focus", a)} />)}
                </div>
                {f.engineering_focus.includes("Other") && (
                  <Input className="mt-2" placeholder="Describe the other area" value={f.engineering_focus_other} onChange={(e) => set("engineering_focus_other", e.target.value)} />
                )}
              </Field>
            </Section>
          )}

          {step === 1 && (
            <Section title="Role information" description="The role, the level of the candidate, and the language the candidate must use.">
              <Field label="Assessment name" hint="Optional. Defaults to position and company.">
                <Input value={f.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Position" required hint="For example: Backend Software Engineer, Machine Learning Engineer, Full-Stack Engineer, Data Engineer.">
                <Input value={f.position} onChange={(e) => set("position", e.target.value)} />
              </Field>
              <Field label="Candidate level" required>
                <Segmented options={LEVELS} value={f.candidate_level} onChange={(v) => set("candidate_level", v)} />
              </Field>
              <Field label="Programming language" required hint="The candidate must write solutions in this language.">
                <Segmented options={LANGUAGES.map((l) => ({ value: l, label: l }))} value={f.programming_language} onChange={(v) => set("programming_language", v)} mono />
              </Field>
            </Section>
          )}

          {step === 2 && (
            <>
              <Section title="Technical requirements" description="Select everything the candidate needs to demonstrate.">
                {REQUIREMENT_GROUPS.map((g) => (
                  <div key={g.group}>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{g.group}</div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
                      {g.items.map((r) => <CheckItem key={r} label={r} checked={f.technical_requirements.includes(r)} onChange={() => toggle("technical_requirements", r)} />)}
                    </div>
                  </div>
                ))}
                <Field label="Custom technical requirements" hint="Anything not represented by the options above.">
                  <Textarea rows={4} value={f.custom_technical_requirements} onChange={(e) => set("custom_technical_requirements", e.target.value)} />
                </Field>
              </Section>
              <Section title="General programming questions">
                <div className="flex items-start justify-between gap-6 rounded-md border bg-muted/40 p-4">
                  <div>
                    <Label htmlFor="gpq" className="font-medium">Include General Programming Technical Questions</Label>
                    <p className="mt-1 text-sm text-muted-foreground">Foundational questions suited to the candidate level and language, still connected to the company's requirements. Not generic trivia.</p>
                  </div>
                  <Switch id="gpq" checked={f.general_programming_questions} onCheckedChange={(v) => set("general_programming_questions", v)} />
                </div>
              </Section>
              <Section title="Difficulty" description={`Difficulty is interpreted relative to the candidate level (${levelLabel(f.candidate_level)}).`}>
                <Segmented options={DIFFICULTIES} value={f.difficulty} onChange={(v) => set("difficulty", v)} />
                {f.difficulty === "custom" && (
                  <Field label="Describe the desired difficulty" required>
                    <Input value={f.custom_difficulty} onChange={(e) => set("custom_difficulty", e.target.value)} />
                  </Field>
                )}
              </Section>
            </>
          )}

          {step === 3 && (
            <Section title="Personalize assessment using candidate experience"
              description="Optional. A resume lets the assessment focus on experience that overlaps with your requirements. Claimed experience is tested, not assumed, and unrelated resume content is ignored.">
              <Field label="Candidate name" hint="Optional.">
                <Input value={f.candidate_name} onChange={(e) => set("candidate_name", e.target.value)} />
              </Field>
              <Field label="Resume" hint="PDF, DOCX, or TXT, up to 10 MB.">
                <div className="flex flex-wrap items-center gap-3">
                  <Input type="file" accept={RESUME_TYPES.join(",")} className="max-w-sm"
                    onChange={(e) => { setResumeFile(e.target.files?.[0] ?? null); setInsights(null); }} />
                  <Button type="button" variant="secondary" disabled={!resumeFile || busy} onClick={uploadResume}>
                    {busy ? "Analyzing..." : "Upload and analyze"}
                  </Button>
                </div>
              </Field>
              {insights && <InsightsView insights={insights} />}
            </Section>
          )}

          {step === 4 && (
            <Section title="Additional Assessment Instructions" description="Describe exactly what you want the candidate to demonstrate. This is included verbatim in the specification.">
              <Textarea rows={8} value={f.custom_instructions} onChange={(e) => set("custom_instructions", e.target.value)}
                placeholder="Create a problem that tests whether the candidate understands how to retrieve data efficiently from a database. I want the candidate to explain their reasoning and demonstrate appropriate error handling." />
            </Section>
          )}

          {step >= 5 && <Review f={f} insights={insights} onEdit={setStep} />}

          {error && <div className="mt-4"><ErrorState message={error} /></div>}

          <div className="mt-6 flex justify-between">
            <Button variant="outline" disabled={step === 0 || busy} onClick={() => { setError(null); setStep((s) => s - 1); }}>Back</Button>
            {step < 5 ? <Button onClick={next} disabled={busy}>Continue</Button> : (
              <Button size="lg" onClick={generate} disabled={busy}>{busy ? "Generating specification..." : "Generate Assessment Specification"}</Button>
            )}
          </div>
        </div>

        <aside className="hidden lg:block">
          <Card className="sticky top-20">
            <CardHeader className="pb-2"><CardTitle className="text-sm">What the AI will use</CardTitle></CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Summary label="Company" value={f.company_name} />
              <Summary label="Position" value={f.position} />
              <Summary label="Level" value={levelLabel(f.candidate_level)} />
              <Summary label="Language" value={f.programming_language} />
              <Summary label="Difficulty" value={difficultyLabel(f.difficulty, f.custom_difficulty)} />
              <Summary label="Requirements" value={f.technical_requirements.length ? `${f.technical_requirements.length} selected` : ""} />
              <Summary label="General questions" value={f.general_programming_questions ? "Included" : "Not included"} />
              <Summary label="Resume" value={insights ? "Analyzed" : "Not provided"} />
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function Stepper({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  return (
    <ol className="mb-8 flex flex-wrap gap-y-2 overflow-x-auto rounded-md border bg-card">
      {STEPS.map((s, i) => (
        <li key={s} className="flex-1">
          <button type="button" onClick={() => onJump(i)}
            className={cn("flex w-full items-center gap-2 border-b-2 px-3 py-3 text-left text-sm",
              i === step ? "border-primary font-medium text-foreground" : i < step ? "border-primary/40 text-foreground" : "border-transparent text-muted-foreground")}>
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs",
              i <= step ? "bg-primary text-primary-foreground" : "bg-muted")}>{i + 1}</span>
            <span className="whitespace-nowrap">{s}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="mb-4">
      <CardHeader><CardTitle className="text-base">{title}</CardTitle>{description && <CardDescription>{description}</CardDescription>}</CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}

function CheckItem({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm", checked && "border-primary bg-accent")}>
      <Checkbox checked={checked} onCheckedChange={onChange} />{label}
    </label>
  );
}

function Segmented<T extends string>({ options, value, onChange, mono }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; mono?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.value} type="button" onClick={() => onChange(o.value)}
          className={cn("rounded-md border px-4 py-2 text-sm", mono && "font-mono",
            value === o.value ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b pb-1.5 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="truncate text-right font-medium">{value || "-"}</span>
    </div>
  );
}

function InsightsView({ insights }: { insights: ResumeInsights }) {
  return (
    <div className="rounded-md border bg-muted/40 p-4 text-sm">
      <div className="font-medium">Relevant experience discovered</div>
      <p className="mt-1 text-xs text-muted-foreground">From {insights.file_name}. Only experience overlapping your requirements is used.</p>
      <div className="mt-3"><span className="text-muted-foreground">Technologies: </span>{insights.technologies.join(", ") || "None"}</div>
      {insights.relevant_experience.length ? (
        <ul className="mt-3 space-y-1.5">
          {insights.relevant_experience.map((e) => (
            <li key={e.experience} className="flex flex-wrap gap-x-2">
              <span>{e.experience}</span><span className="text-muted-foreground">relates to</span><span className="font-medium">{e.related_requirement}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-3 text-muted-foreground">No overlap with the selected requirements.</p>}
    </div>
  );
}

function Review({ f, insights, onEdit }: { f: AssessmentInput; insights: ResumeInsights | null; onEdit: (s: number) => void }) {
  const focus = [...f.engineering_focus.filter((x) => x !== "Other"), f.engineering_focus_other].filter(Boolean).join(", ");
  const Block = ({ title, s, children }: { title: string; s: number; children: ReactNode }) => (
    <div className="border-b py-4 last:border-0">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        <button type="button" className="text-sm text-primary hover:underline" onClick={() => onEdit(s)}>Edit</button>
      </div>
      <div className="space-y-1 text-sm">{children}</div>
    </div>
  );
  const Row = ({ k, v }: { k: string; v: ReactNode }) => <div className="grid grid-cols-[160px_1fr] gap-3"><span className="text-muted-foreground">{k}</span><span className="whitespace-pre-wrap">{v || "-"}</span></div>;
  return (
    <Section title="Review" description="Everything below will be included in the Markdown specification.">
      <div>
        <Block title="Company" s={0}><Row k="Company name" v={f.company_name} /><Row k="Purpose" v={f.company_purpose} /><Row k="Engineering application" v={focus} /></Block>
        <Block title="Position" s={1}><Row k="Position" v={f.position} /><Row k="Candidate level" v={levelLabel(f.candidate_level)} /><Row k="Language" v={f.programming_language} /></Block>
        <Block title="Technical requirements" s={2}>
          <div className="flex flex-wrap gap-1.5">{f.technical_requirements.map((r) => <span key={r} className="rounded border bg-muted px-2 py-0.5 text-xs">{r}</span>)}</div>
          {f.custom_technical_requirements && <Row k="Custom" v={f.custom_technical_requirements} />}
        </Block>
        <Block title="Difficulty" s={2}><Row k="Difficulty" v={difficultyLabel(f.difficulty, f.custom_difficulty)} /></Block>
        <Block title="Candidate" s={3}>
          <Row k="Resume" v={insights ? `Uploaded (${insights.file_name})` : "Not uploaded"} />
          {insights && <Row k="Relevant experience" v={insights.relevant_experience.map((e) => `${e.experience} (${e.related_requirement})`).join("\n")} />}
        </Block>
        <Block title="General questions" s={2}><Row k="Status" v={f.general_programming_questions ? "Enabled" : "Disabled"} /></Block>
        <Block title="Custom instructions" s={4}><Row k="Instructions" v={f.custom_instructions} /></Block>
      </div>
    </Section>
  );
}
