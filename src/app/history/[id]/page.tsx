import Link from "next/link";
import { notFound } from "next/navigation";
import { ApprovalActions } from "@/components/approval-actions";
import { GatewayPipeline } from "@/components/gateway-pipeline";
import { GraphTaskRecord, LiveTaskGraph } from "@/components/task-graph";
import { GhostLink, PageHeader, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { formatDuration, formatUsd, hydrateMissingSpans } from "@/lib/observability";
import type { DetectorHit } from "@/lib/security";
import { formatDateTime, parseJson } from "@/lib/utils";

export default async function ExecutionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await hydrateMissingSpans();
  const execution = await db.execution.findUnique({
    where: { id },
    include: {
      project: true,
      task: true,
      workflow: true,
      steps: { include: { agent: true, approvals: true, gatewayEvents: true, span: true }, orderBy: { order: "asc" } },
      graphTasks: { include: { agent: true }, orderBy: { order: "asc" } },
      events: { orderBy: { createdAt: "asc" } },
      gatewayEvents: { include: { agent: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!execution) notFound();

  const pending = execution.steps
    .flatMap((step) => step.approvals)
    .find((approval) => approval.status === "pending");
  const latestGateway = execution.gatewayEvents.at(-1);

  return (
    <div>
      <PageHeader
        kicker="Execution"
        title={execution.task.title}
        description={`${execution.project.name} · ${execution.workflow.name}`}
        actions={
          <>
            <GhostLink href={`/observability/${execution.id}`}>Trace</GhostLink>
            <GhostLink href="/history">All history</GhostLink>
          </>
        }
      />
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={execution.status} />
        <span className="font-mono text-xs text-muted">
          started {formatDateTime(execution.startedAt)}
          {execution.completedAt ? ` · finished ${formatDateTime(execution.completedAt)}` : ""}
          {` · ${formatDuration(execution.durationMs)} · ${execution.tokenTotal.toLocaleString()} tok · ${formatUsd(execution.costUsd)} · risk ${execution.maxRisk}`}
        </span>
      </div>

      {pending ? (
        <section className="mb-6 rounded-xl border border-warn/30 bg-panel/80 p-5">
          <h2 className="text-sm font-medium text-warn">
            {pending.kind === "gateway"
              ? "Gateway hold — human approval required"
              : "Human approval required"}
          </h2>
          <p className="mt-1 text-sm text-muted">{pending.summary}</p>
          <div className="mt-4">
            <ApprovalActions approvalId={pending.id} />
          </div>
        </section>
      ) : null}

      {latestGateway ? (
        <div className="mb-6">
          <GatewayPipeline
            verdict={latestGateway.verdict}
            riskScore={latestGateway.riskScore}
            toolName={latestGateway.toolName}
          />
        </div>
      ) : null}

      {execution.graphTasks.length > 0 ? (
        <div className="mb-6">
          <LiveTaskGraph nodes={execution.graphTasks} />
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="space-y-4">
          {execution.steps.map((step, index) => {
            const graphNode = execution.graphTasks.find((node) => node.stepId === step.id);
            return (
            <article key={step.id} className="rounded-xl border border-line bg-panel/80 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                    Task #{index + 1} · {step.agent.name}
                  </div>
                  <h2 className="mt-1 font-medium">{step.name}</h2>
                </div>
                <StatusBadge status={step.status} />
              </div>
              {graphNode ? <GraphTaskRecord node={graphNode} /> : null}
              {step.span ? (
                <div className="mt-3 grid gap-2 font-mono text-[11px] text-muted sm:grid-cols-4">
                  <div>Duration {formatDuration(step.span.durationMs)}</div>
                  <div>
                    Tokens {step.span.tokenTotal.toLocaleString()} (in {step.span.tokenInput} / out{" "}
                    {step.span.tokenOutput})
                  </div>
                  <div>Cost {formatUsd(step.span.costUsd)}</div>
                  <div>Risk {step.span.riskScore}</div>
                </div>
              ) : null}
              {step.output ? (
                <pre className="artifact mt-4 max-h-[28rem] overflow-auto rounded-lg border border-line bg-background p-4">
                  {step.output}
                </pre>
              ) : (
                <p className="mt-3 text-sm text-muted">No artifact yet.</p>
              )}
              {step.gatewayEvents.length > 0 ? (
                <div className="mt-4 space-y-2 rounded-lg border border-line bg-background p-3">
                  <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                    Gateway
                  </div>
                  {step.gatewayEvents.map((event) => {
                    const detectors = parseJson<DetectorHit[]>(event.detectors, []);
                    return (
                      <div key={event.id} className="text-xs">
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge
                            status={
                              event.verdict === "allow"
                                ? "allowed"
                                : event.verdict === "deny"
                                  ? "denied"
                                  : "awaiting_gateway"
                            }
                          />
                          <span className="font-mono text-muted">
                            {event.phase} · {event.toolName} · risk {event.riskScore}
                          </span>
                        </div>
                        {detectors.length > 0 ? (
                          <ul className="mt-1 list-disc pl-4 text-muted">
                            {detectors.slice(0, 4).map((hit) => (
                              <li key={`${event.id}-${hit.detail}`}>{hit.name}: {hit.detail}</li>
                            ))}
                          </ul>
                        ) : (
                          <p className="mt-1 text-muted">No detector hits.</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </article>
            );
          })}
        </section>
        <aside className="rounded-xl border border-line bg-panel/80 p-5">
          <h2 className="mb-3 text-sm font-medium">Timeline</h2>
          <ol className="space-y-3">
            {execution.events.map((event) => (
              <li key={event.id} className="flex gap-3">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-live" />
                <div>
                  <div className="text-sm">{event.message}</div>
                  <div className="font-mono text-[11px] text-muted">
                    {event.type} · {formatDateTime(event.createdAt)}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <Link
            href={`/tasks/${execution.taskId}`}
            className="mt-6 inline-block text-xs text-muted hover:text-foreground"
          >
            Back to task →
          </Link>
        </aside>
      </div>
    </div>
  );
}
