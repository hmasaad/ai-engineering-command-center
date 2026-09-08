import Link from "next/link";
import { EmptyState, GhostLink, PageHeader, PrimaryLink, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDuration, formatUsd, hydrateMissingSpans } from "@/lib/observability";
import { formatRelative } from "@/lib/utils";

export default async function HistoryPage() {
  await hydrateMissingSpans();
  const executions = await db.execution.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      project: true,
      task: true,
      workflow: true,
    },
  });

  return (
    <div>
      <PageHeader
        kicker="System of record"
        title="Execution history"
        description="Every orchestrator run, pause, approval, and completion is recorded here — with duration, tokens, cost, and risk from Observability."
        actions={<GhostLink href="/observability">Observability</GhostLink>}
      />
      {executions.length === 0 ? (
        <EmptyState
          title="No runs yet"
          body="Run a workflow from a task to populate history."
          action={<PrimaryLink href="/tasks">Open tasks</PrimaryLink>}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="bg-panel font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              <tr>
                <th className="px-4 py-3">Task</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Workflow</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Duration</th>
                <th className="px-4 py-3">Tokens</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Risk</th>
                <th className="px-4 py-3">Started</th>
              </tr>
            </thead>
            <tbody className="bg-panel/60">
              {executions.map((execution) => (
                <tr key={execution.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <Link href={`/history/${execution.id}`} className="hover:text-live">
                      {execution.task.title}
                    </Link>
                    <div>
                      <Link
                        href={`/observability/${execution.id}`}
                        className="font-mono text-[10px] text-muted hover:text-live"
                      >
                        trace
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{execution.project.name}</td>
                  <td className="px-4 py-3 text-muted">{execution.workflow.name}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={execution.status} />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {formatDuration(execution.durationMs)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {execution.tokenTotal.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {formatUsd(execution.costUsd)}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {execution.maxRisk}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted">
                    {formatRelative(execution.startedAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
