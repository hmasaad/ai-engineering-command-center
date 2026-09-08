import { notFound } from "next/navigation";
import { SpanTree } from "@/components/span-tree";
import { GhostLink, PageHeader, StatusBadge } from "@/components/ui";
import {
  formatDuration,
  formatUsd,
  getExecutionTrace,
} from "@/lib/observability";
import { formatDateTime } from "@/lib/utils";

export default async function ObservabilityTracePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const execution = await getExecutionTrace(id);
  if (!execution) notFound();

  return (
    <div>
      <PageHeader
        kicker="Trace"
        title={execution.task.title}
        description={`${execution.project.name} · ${execution.workflow.name}`}
        actions={
          <>
            <GhostLink href={`/history/${execution.id}`}>History record</GhostLink>
            <GhostLink href="/observability">All traces</GhostLink>
          </>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3 font-mono text-xs text-muted">
        <StatusBadge status={execution.status} />
        <span>{formatDuration(execution.durationMs)}</span>
        <span>{execution.tokenTotal.toLocaleString()} tokens</span>
        <span>{formatUsd(execution.costUsd)}</span>
        <span>max risk {execution.maxRisk}</span>
        <span>started {formatDateTime(execution.startedAt)}</span>
      </div>

      <section className="rounded-xl border border-line bg-panel/80 p-5">
        <h2 className="mb-4 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Workflow · Agent · Input · Context · Tools · Output · Tokens · Cost · Duration · Risk · Result
        </h2>
        <SpanTree
          workflowName={execution.workflow.name}
          result={execution.status}
          spans={execution.spans}
          expanded
        />
      </section>
    </div>
  );
}
