import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Calibrate — Targeted Technical Assessments" },
      { name: "description", content: "Turn real engineering requirements and candidate experience into targeted coding assessments, then see clearly how candidates performed." },
      { property: "og:title", content: "Calibrate — Targeted Technical Assessments" },
      { property: "og:description", content: "Targeted coding assessment specifications and structured candidate evaluations for engineering hiring teams." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

const STEPS = [
  ["Define requirements", "Hiring managers describe the company, role, language, difficulty, and the technical skills that matter."],
  ["Generate the specification", "A structured Markdown specification is produced, reviewed, edited, and downloaded for the assessment workflow."],
  ["Evaluate submissions", "Recruiters upload completed code and receive a scored, criterion-by-criterion evaluation."],
];

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-center px-6">
          <BrandLogo to="/" imgClassName="h-8" />
          <Button asChild variant="outline" className="absolute right-6">
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
      </header>
      <section className="mx-auto max-w-6xl px-6 py-20 text-center">
        <BrandLogo variant="lockup" imgClassName="mx-auto h-28 md:h-36" className="mb-8 justify-center" />
        <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
          Turn real engineering requirements into targeted assessments.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
          Build coding assessment specifications grounded in your company's actual work and the candidate's relevant
          experience, then show recruiters exactly how well each candidate demonstrated those requirements.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild size="lg"><Link to="/auth">Get started</Link></Button>
          <Button asChild size="lg" variant="outline"><Link to="/dashboard">Go to dashboard</Link></Button>
        </div>
        <div className="mt-16 grid gap-px overflow-hidden rounded-lg border bg-border text-left md:grid-cols-3">
          {STEPS.map(([t, d], i) => (
            <div key={t} className="bg-card p-6">
              <div className="font-mono text-xs text-muted-foreground">0{i + 1}</div>
              <div className="mt-2 font-semibold">{t}</div>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
