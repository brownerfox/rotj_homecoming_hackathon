// Page 0: Home and Sign In (Page_WorkFlow.md). The sign-in form itself lives at /auth.
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { CANDIDATE_STATUS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingRows, formatDate } from "@/components/app-ui";
import { DemoSignInButton } from "@/components/demo-sign-in";
import { BrandLogo } from "@/components/brand-logo";

export const Route = createFileRoute("/")({
  // Sign-in state lives in the browser, so this page renders there.
  ssr: false,
  head: () => ({
    meta: [
      { title: "Fit2Hire — Personalized Technical Exams" },
      { name: "description", content: "Turn a job posting, the hiring manager's priorities, and a resume into a personalized interview, then see how the candidate worked through it." },
      { property: "og:title", content: "Fit2Hire — Personalized Technical Exams" },
      { property: "og:description", content: "Personalized interviews and evidence-based candidate analysis for recruiters and hiring managers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

// The core pipeline from Page_WorkFlow.md, one card per page.
const STEPS: { lines: [string, string]; text: string }[] = [
  { lines: ["Set up", "the job"], text: "Add the public posting, the key priorities, and the hiring manager's context." },
  { lines: ["Add the", "candidate"], text: "Upload a resume and choose the technical interview style." },
  { lines: ["Run the", "interview"], text: "Get personalized questions and a technical problem. The candidate works outside this tool, then you upload their solution and process notes." },
  { lines: ["Review the", "analysis"], text: "See evidence on technical work, problem solving, role fit, collaboration, and what to follow up on." },
];

function Home() {
  const { user, loading, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-center px-6">
          <BrandLogo to="/" imgClassName="h-8" />
          <div className="absolute right-6">
            {user ? (
              <div className="flex items-center gap-3 text-sm">
                <span className="hidden text-muted-foreground sm:inline">{user.name}</span>
                <Button variant="outline" onClick={signOut}>Sign out</Button>
              </div>
            ) : !loading ? (
              <Button asChild variant="outline"><Link to="/auth">Sign in</Link></Button>
            ) : null}
          </div>
        </div>
      </header>
      {loading ? <div className="mx-auto max-w-6xl px-6 py-20"><LoadingRows /></div>
        : user ? <SignedInHome /> : <PublicHome />}
    </div>
  );
}

// Before signing in: what the product does, and the way in.
function PublicHome() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-20 text-center">
      <BrandLogo variant="lockup" imgClassName="mx-auto h-28 md:h-36" className="mb-8 justify-center" />
      <p className="text-sm font-medium uppercase tracking-wider text-primary">For recruiters and hiring managers</p>
      <h1 className="mx-auto mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
        Interviews built around the real job and the real candidate.
      </h1>
      <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
        Give us the job posting, what the hiring manager cares about, and a resume. We write a personalized
        interview, then analyze how the candidate worked through it.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button asChild size="lg"><Link to="/auth">Get started</Link></Button>
        <DemoSignInButton size="lg" />
      </div>
      {/* items-start lets only the hovered card grow. min-h reserves room so the page does not jump. */}
      <ol className="mt-16 grid min-h-80 grid-cols-2 items-start gap-4 md:grid-cols-4">
        {STEPS.map((step, i) => (
          <li key={step.text}
            className="group rounded-xl border bg-card px-6 py-8 transition-all duration-200 hover:-translate-y-1 hover:border-primary hover:bg-accent hover:shadow-md">
            <div className="font-mono text-sm text-muted-foreground transition-colors group-hover:text-primary">0{i + 1}</div>
            <div className="mt-3 text-lg font-semibold leading-snug">{step.lines[0]}<br />{step.lines[1]}</div>
            {/* The description is hidden until hover, then slides open under the title. */}
            <div className="grid grid-rows-[0fr] opacity-0 transition-all duration-200 group-hover:grid-rows-[1fr] group-hover:opacity-100">
              <div className="overflow-hidden">
                <p className="pt-3 text-sm text-muted-foreground">{step.text}</p>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

// After signing in: start a new job, or return to a candidate. The candidate works outside
// the app, so this list is how a recruiter gets back to upload their work.
function SignedInHome() {
  const candidates = useQuery({ queryKey: ["candidates"], queryFn: api.listCandidates });
  const jobs = useQuery({ queryKey: ["jobs"], queryFn: api.listJobs });
  const titles = new Map((jobs.data ?? []).map((j) => [j.id, j.title]));
  const error = candidates.error ?? jobs.error;

  return (
    <section className="mx-auto max-w-6xl px-6 py-12">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mt-1 text-sm text-muted-foreground">Start a new job, or pick up a candidate where you left off.</p>
        </div>
        <Button asChild size="lg"><Link to="/jobs/new">Start a new job</Link></Button>
      </div>

      <h2 className="mb-3 mt-8 text-lg font-semibold">Candidates in progress</h2>
      {candidates.isLoading || jobs.isLoading ? <LoadingRows />
        : error ? <ErrorState message={errorMessage(error)} />
        : !candidates.data?.length ? (
          <EmptyState title="No candidates yet" description="Start a new job to set up your first candidate." />
        ) : (
          <ul className="divide-y rounded-md border bg-card">
            {candidates.data.map((c) => {
              const status = CANDIDATE_STATUS[c.status];
              return (
                <li key={c.id}>
                  <Link
                    to={status.page === 4 ? "/candidates/$candidateId/analysis" : "/candidates/$candidateId/interview"}
                    params={{ candidateId: String(c.id) }}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 hover:bg-muted/50">
                    <div>
                      <div className="font-medium">{c.name}</div>
                      <div className="text-sm text-muted-foreground">{titles.get(c.job_id) ?? "Unknown position"}</div>
                    </div>
                    <div className="text-right text-sm">
                      <div>{status.label}</div>
                      <div className="text-xs text-muted-foreground">Updated {formatDate(c.updated_at)}</div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
    </section>
  );
}
