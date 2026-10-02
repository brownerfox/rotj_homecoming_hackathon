import { Link } from "@tanstack/react-router";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { difficultyLabel, levelLabel } from "@/lib/constants";
import type { Assessment } from "@/lib/types";
import { StatusBadge, formatDate } from "./app-ui";

export function AssessmentsTable({ items }: { items: Assessment[] }) {
  return (
    <div className="overflow-x-auto rounded-md border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Assessment</TableHead>
            <TableHead>Position</TableHead>
            <TableHead>Language</TableHead>
            <TableHead>Difficulty</TableHead>
            <TableHead>Created</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Evaluated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <Link to="/assessments/$id" params={{ id: a.id }} className="font-medium text-primary hover:underline">{a.name}</Link>
              </TableCell>
              <TableCell>
                <div>{a.position}</div>
                <div className="text-xs text-muted-foreground">{levelLabel(a.candidate_level)}</div>
              </TableCell>
              <TableCell className="font-mono text-sm">{a.programming_language}</TableCell>
              <TableCell>{difficultyLabel(a.difficulty)}</TableCell>
              <TableCell className="text-muted-foreground">{formatDate(a.created_at)}</TableCell>
              <TableCell><StatusBadge status={a.status} /></TableCell>
              <TableCell className="text-right tabular-nums">{a.candidates_evaluated}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
