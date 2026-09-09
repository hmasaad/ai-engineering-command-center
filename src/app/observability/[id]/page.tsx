import { notFound } from "next/navigation";
import { ActionEventJson } from "@/components/command-center-board";
import { SpanTree } from "@/components/span-tree";
import { GhostLink, PageHeader, StatusBadge } from "@/components/ui";
import { parseActionEvent, toActionEvent } from "@/lib/action-event";
import {
  formatDuration,
  formatUsd,
  getExecutionTrace,
  type ToolTrace,
} from "@/lib/observability";
import { formatDateTime, parseJson } from "@/lib/utils";

export default async function ObservabilityTracePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const execution = await getExecutionTrace(id);
  if (!execution) notFound();

  const stored = (execution.events || [])
    .map((row) => parseActionEvent(row.payload))
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const events =
    stored.length > 0
      ? stored
      : execution.spans.map((span) => {
          const tools = parseJson<ToolTrace[]>(span.tools, []);
          return toActionEvent({
            workflowId: execution.id,
            agent: span.agent.slug || span.agent.role,
            action: span.step?.name.replace(/\s+/g, "_").toLowerCase() || "run",
            tool: tools[0]?.name,
            riskScore: span.riskScore,
            durationMs: span.durationMs,
            tokens: span.tokenTotal,
            status: span.result,
          });
        });

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

      <section className="mb-6 rounded-xl border border-line bg-panel/80 p-5">
        <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Action events
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-muted">No action events on this run yet.</p>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {events.map((event, index) => (
              <ActionEventJson key={`${event.agent}-${event.action}-${index}`} event={event} />
            ))}
          </div>
        )}
      </section>

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
