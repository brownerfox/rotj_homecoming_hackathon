import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api, errorMessage } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { AssessmentsTable } from "@/components/assessments-table";
import { EmptyState, ErrorState, LoadingRows, PageHeader } from "@/components/app-ui";

export const Route = createFileRoute("/_authenticated/assessments/")({
  head: () => ({
    meta: [
      { title: "Assessments — Calibrate" },
      { name: "description", content: "All technical assessments created by your hiring team." },
      { property: "og:title", content: "Assessments — Calibrate" },
      { property: "og:description", content: "All technical assessments created by your hiring team." },
    ],
  }),
  component: AssessmentsPage,
});

function AssessmentsPage() {
  const q = useQuery({ queryKey: ["assessments"], queryFn: api.listAssessments });
  return (
    <div>
      <PageHeader title="Assessments" description="Every assessment, its specification status, and how many candidates have been evaluated."
        actions={<Button asChild><Link to="/assessments/new">Create Assessment</Link></Button>} />
      {q.isLoading ? <LoadingRows /> : q.error ? <ErrorState message={errorMessage(q.error)} /> :
        !q.data?.length ? <EmptyState title="No assessments yet" description="Create an assessment to get started." /> :
        <AssessmentsTable items={q.data} />}
    </div>
  );
}
