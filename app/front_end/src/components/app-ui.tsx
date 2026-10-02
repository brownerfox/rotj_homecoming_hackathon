import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS } from "@/lib/constants";
import type { AssessmentStatus, CoverageResult, SubmissionStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b pb-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const statusTone: Record<string, string> = {
  draft: "bg-muted text-muted-foreground border-border",
  specification_generated: "bg-accent text-accent-foreground border-transparent",
  ready_for_candidate: "bg-accent text-accent-foreground border-transparent",
  candidate_submitted: "bg-warning-soft text-warning border-transparent",
  evaluation_complete: "bg-success-soft text-success border-transparent",
  uploaded: "bg-muted text-muted-foreground border-border",
  evaluating: "bg-warning-soft text-warning border-transparent",
  failed: "bg-danger-soft text-destructive border-transparent",
};

const subLabels: Record<SubmissionStatus, string> = {
  uploaded: "Uploaded", evaluating: "Evaluating", evaluation_complete: "Evaluation Complete", failed: "Failed",
};

export function StatusBadge({ status }: { status: AssessmentStatus | SubmissionStatus }) {
  const label = (STATUS_LABELS as Record<string, string>)[status] ?? subLabels[status as SubmissionStatus] ?? status;
  return <Badge variant="outline" className={cn("font-medium", statusTone[status])}>{label}</Badge>;
}

const coverageTone: Record<CoverageResult, { label: string; cls: string }> = {
  met: { label: "Met", cls: "bg-success-soft text-success" },
  partially_met: { label: "Partially Met", cls: "bg-warning-soft text-warning" },
  not_met: { label: "Not Met", cls: "bg-danger-soft text-destructive" },
};

export function CoverageBadge({ result }: { result: CoverageResult }) {
  const t = coverageTone[result];
  return <Badge variant="outline" className={cn("border-transparent font-medium", t.cls)}>{t.label}</Badge>;
}

export function scoreTone(score: number, max = 100) {
  const pct = score / max;
  return pct >= 0.8 ? "text-success" : pct >= 0.6 ? "text-warning" : "text-destructive";
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-danger-soft p-4 text-sm text-destructive">{message}</div>
  );
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="rounded-md border border-dashed bg-card p-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function LoadingRows() {
  return <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}</div>;
}

export const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
