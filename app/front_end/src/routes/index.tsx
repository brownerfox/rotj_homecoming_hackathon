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
      { title: "Calibrate — Personalized Technical Interviews" },
      { name: "description", content: "Turn a job posting, the hiring manager's priorities, and a resume into a personalized interview, then see how the candidate worked through it." },
      { property: "og:title", content: "Calibrate — Personalized Technical Interviews" },
      { property: "og:description", content: "Personalized interviews and evidence-based candidate analysis for recruiters and hiring managers." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

// The core pipeline from Page_WorkFlow.md, one card per page.
const STEPS = [
  ["Set up the job", "Add the public posting, the key priorities, and the hiring manager's context."],
  ["Add the candidate", "Upload a resume and choose the technical interview style."],
  ["Run the interview", "Get personalized questions and a technical problem. The candidate works outside this tool, then you upload their solution and process notes."],
  ["Review the analysis", "See evidence on technical work, problem solving, role fit, collaboration, and what to follow up on."],
];

function Home() {
  const { user, loading, signOut } = useAuth();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <span className="text-lg font-semibold tracking-tight">Calibrate</span>
          {user ? (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">{user.name}</span>
              <Button variant="outline" onClick={signOut}>Sign out</Button>
            </div>
          ) : !loading && <Button asChild variant="outline"><Link to="/auth">Sign in</Link></Button>}
        <div className="relative mx-auto flex h-16 max-w-6xl items-center justify-center px-6">
          <BrandLogo to="/" imgClassName="h-8" />
          <Button asChild variant="outline" className="absolute right-6">
            <Link to="/auth">Sign in</Link>
          </Button>
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
    <section className="mx-auto max-w-6xl px-6 py-20">
      <p className="text-sm font-medium uppercase tracking-wider text-primary">For recruiters and hiring managers</p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold leading-tight tracking-tight md:text-5xl">
        Interviews built around the real job and the real candidate.
      </h1>
      <p className="mt-5 max-w-2xl text-lg text-muted-foreground">
        Give Calibrate the job posting, what the hiring manager cares about, and a resume. It writes a personalized
        interview, then analyzes how the candidate worked through it.
      </p>
      <div className="mt-8 flex flex-wrap gap-3">
        <Button asChild size="lg"><Link to="/auth">Get started</Link></Button>
        <DemoSignInButton size="lg" />
      </div>
      <div className="mt-16 grid gap-px overflow-hidden rounded-lg border bg-border md:grid-cols-4">
        {STEPS.map(([title, text], i) => (
          <div key={title} className="bg-card p-6">
            <div className="font-mono text-xs text-muted-foreground">0{i + 1}</div>
            <div className="mt-2 font-semibold">{title}</div>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
          </div>
        ))}
      </div>
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
