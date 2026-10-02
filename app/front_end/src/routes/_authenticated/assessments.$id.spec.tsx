import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api";
import type { Assessment } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ErrorState, LoadingRows, PageHeader, StatusBadge } from "@/components/app-ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assessments/$id/spec")({
  head: () => ({
    meta: [
      { title: "Specification Editor — Calibrate" },
      { name: "description", content: "Review, edit, and download the Markdown assessment specification." },
      { property: "og:title", content: "Specification Editor — Calibrate" },
      { property: "og:description", content: "Review, edit, and download the Markdown assessment specification." },
    ],
  }),
  component: SpecEditor,
});

function fileName(a: Assessment) {
  const slug = a.position.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "") || "assessment";
  return `assessment_${slug}_${new Date().toISOString().slice(0, 10)}.md`;
}

function SpecEditor() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["assessment", id], queryFn: () => api.getAssessment(id) });
  const [text, setText] = useState("");
  const [view, setView] = useState<"split" | "edit" | "preview">("split");
  const [confirmRegen, setConfirmRegen] = useState(false);
  const saved = q.data?.markdown_specification ?? "";
  const dirty = text !== saved;

  useEffect(() => { if (q.data) setText(q.data.markdown_specification ?? ""); }, [q.data?.markdown_specification]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault(); };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const save = useMutation({
    mutationFn: () => api.saveSpecification(id, text),
    onSuccess: (a) => { qc.setQueryData(["assessment", id], a); qc.invalidateQueries({ queryKey: ["assessments"] }); toast.success("Specification saved"); },
    onError: (e) => toast.error(errorMessage(e)),
  });
  const regen = useMutation({
    mutationFn: () => api.generateSpecification(id),
    onSuccess: (a) => { qc.setQueryData(["assessment", id], a); setText(a.markdown_specification ?? ""); toast.success("Specification regenerated"); },
    onError: (e) => toast.error(`Regeneration failed. ${errorMessage(e)}`),
  });

  function download() {
    if (!q.data) return;
    if (dirty) toast.message("Downloading the current editor contents. Remember to save your changes.");
    const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = fileName(q.data); a.click();
    URL.revokeObjectURL(url);
  }

  if (q.isLoading) return <LoadingRows />;
  if (q.error || !q.data) return <ErrorState message={errorMessage(q.error)} />;
  const a = q.data;

  return (
    <div>
      <PageHeader title="Markdown Specification"
        description="This exact document is what you download and pass to the external assessment-generation workflow."
        actions={<Button asChild variant="outline"><Link to="/assessments/$id" params={{ id }}>Assessment details</Link></Button>} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card p-3">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <span className="font-medium">{a.name}</span>
          <StatusBadge status={a.status} />
          <span className={cn("text-xs", dirty ? "text-warning" : "text-muted-foreground")}>
            {dirty ? "Unsaved changes" : a.spec_manually_edited ? "Saved with manual edits" : "Saved"}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={view} onValueChange={(v) => setView(v as typeof view)}>
            <TabsList><TabsTrigger value="edit">Edit</TabsTrigger><TabsTrigger value="split">Split</TabsTrigger><TabsTrigger value="preview">Preview</TabsTrigger></TabsList>
          </Tabs>
          <Button variant="outline" disabled={regen.isPending}
            onClick={() => (dirty || a.spec_manually_edited ? setConfirmRegen(true) : regen.mutate())}>
            {regen.isPending ? "Regenerating..." : "Regenerate"}
          </Button>
          <Button variant="outline" onClick={download} disabled={!text}>Download Markdown</Button>
          <Button onClick={() => save.mutate()} disabled={!dirty || save.isPending}>{save.isPending ? "Saving..." : "Save"}</Button>
        </div>
      </div>

      <div className={cn("grid gap-4", view === "split" && "lg:grid-cols-2")}>
        {view !== "preview" && (
          <div className="flex flex-col rounded-md border bg-card">
            <div className="border-b px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Markdown</div>
            <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false}
              className="min-h-[70vh] flex-1 resize-none bg-transparent p-4 font-mono text-[13px] leading-relaxed outline-none" />
          </div>
        )}
        {view !== "edit" && (
          <div className="rounded-md border bg-card">
            <div className="border-b px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</div>
            <div className="md-preview max-h-[70vh] overflow-auto p-6 text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{text || "_No specification yet._"}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={confirmRegen} onOpenChange={setConfirmRegen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Replace the current specification?</AlertDialogTitle>
            <AlertDialogDescription>
              This specification contains manual edits{dirty ? " and unsaved changes" : ""}. Regenerating will replace it with a new version built from the assessment settings. Consider downloading a copy first.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current</AlertDialogCancel>
            <AlertDialogAction onClick={() => regen.mutate()}>Regenerate</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
