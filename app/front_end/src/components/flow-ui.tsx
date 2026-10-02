// Shared layout pieces for Pages 1 to 4 (Page_WorkFlow.md).
import type { ReactNode } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Pages 1 to 4, in order. Page 0 is sign-in, so it is not a step.
// Do not add, remove, or reorder without updating Page_WorkFlow.md.
const STEPS = ["Job Setup", "Candidate Setup", "Interview", "Candidate Analysis"] as const;

export function FlowSteps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <ol className="mb-8 flex flex-wrap overflow-x-auto rounded-md border bg-card">
      {STEPS.map((label, i) => {
        const n = i + 1;
        return (
          <li key={label} aria-current={n === current ? "step" : undefined}
            className={cn("flex flex-1 items-center gap-2 border-b-2 px-3 py-3 text-sm",
              n === current ? "border-primary font-medium text-foreground"
                : n < current ? "border-primary/40 text-foreground" : "border-transparent text-muted-foreground")}>
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs",
              n <= current ? "bg-primary text-primary-foreground" : "bg-muted")}>{n}</span>
            <span className="whitespace-nowrap">{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function Section({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <Card className="mb-4">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-5">{children}</CardContent>
    </Card>
  );
}

export function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}{required && <span className="ml-0.5 text-destructive">*</span>}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  );
}
