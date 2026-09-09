import Link from "next/link";
import { ActionEventJson, CommandCenterBoard } from "@/components/command-center-board";
import {
  ObservabilityAscii,
  ObservabilityCaptureTree,
  ObservabilityExampleLog,
  ObservabilityQuestions,
} from "@/components/observability-layer";
import { FeedbackLoopAscii, FeedbackLoopWalkAscii } from "@/components/feedback-loop";
import { SpanTree } from "@/components/span-tree";
import { EmptyState, GhostLink, PageHeader, StatusBadge } from "@/components/ui";
import {
  formatDuration,
  formatUsd,
  getCommandCenterBoard,
  getObservabilityDashboard,
  TOKEN_RATES,
} from "@/lib/observability";
import { formatRelative } from "@/lib/utils";

export default async function ObservabilityPage() {
  const [data, board] = await Promise.all([
    getObservabilityDashboard(),
    getCommandCenterBoard(),
  ]);
  const maxAgentTotal = Math.max(1, ...data.agentStats.map((row) => row.total));

  return (
    <div>
      <PageHeader
        kicker="Observability"
        title="Agent Observability"
        description="Security asks whether an action should be allowed. Observability asks what the AI system actually did — which agent, which tools, what the model received, tokens, cost, duration, and why."
        actions={<GhostLink href="/history">Execution history</GhostLink>}
      />

      <div className="mb-8 space-y-6">
        <ObservabilityAscii />
        <div className="grid gap-3 lg:grid-cols-2">
          <FeedbackLoopAscii />
          <FeedbackLoopWalkAscii />
        </div>
        <ObservabilityQuestions />
        <ObservabilityCaptureTree />
        <ObservabilityExampleLog />
      </div>

      <CommandCenterBoard
        workflows={board.workflows}
        agents={board.agents}
        approvals={board.approvals}
        metrics={board.metrics}
      />

      <p className="mt-3 max-w-3xl text-xs text-muted">
        Tokens and cost are estimated ({TOKEN_RATES.charsPerToken} chars/token, $
        {TOKEN_RATES.inputPerMillion}/M input, ${TOKEN_RATES.outputPerMillion}/M output).
        Specialists emit artifacts; they are not live model calls yet.{" "}
        {data.totals.spans} spans · {data.totals.tokens.toLocaleString()} tokens ·{" "}
        {formatUsd(data.totals.costUsd)}. Active workflows {data.kpis.activeWorkflows} · running
        agents {data.kpis.runningAgents} · security blocks {data.kpis.securityBlocks}.
      </p>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium">Workflow traces</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Workflow → Agent → Result
            </span>
          </div>
          {data.executions.length === 0 ? (
            <EmptyState
              title="No traces yet"
              body="Run a development, operations, or security service to persist agent spans."
            />
          ) : (
            <div className="space-y-5">
              {data.executions.map((execution) => (
                <article
                  key={execution.id}
                  className="rounded-lg border border-line bg-background p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
                    <span>
                      {execution.project.name} · {execution.task.title}
                    </span>
                    <span className="font-mono">
                      {formatDuration(execution.durationMs)} · {execution.tokenTotal.toLocaleString()} tok ·{" "}
                      {formatUsd(execution.costUsd)} · risk {execution.maxRisk}
                    </span>
                  </div>
                  <SpanTree
                    workflowName={execution.workflow.name}
                    result={execution.status}
                    spans={execution.spans}
                    href={`/observability/${execution.id}`}
                  />
                </article>
              ))}
            </div>
          )}
        </section>

        <div className="space-y-6">
          <section className="rounded-xl border border-line bg-panel/80 p-5">
            <h2 className="mb-1 text-sm font-medium">Action events</h2>
            <p className="mb-4 text-xs text-muted">
              One JSON object per agent action. Tool, risk band, duration, tokens, status.
            </p>
            {board.events.length === 0 ? (
              <p className="text-sm text-muted">Events appear as specialists run.</p>
            ) : (
              <div className="space-y-3">
                {board.events.slice(0, 6).map((event, index) => (
                  <ActionEventJson key={`${event.workflow_id}-${event.agent}-${index}`} event={event} />
                ))}
              </div>
            )}
          </section>

          <section className="rounded-xl border border-line bg-panel/80 p-5">
            <h2 className="mb-4 text-sm font-medium">Per-agent load</h2>
            {data.agentStats.length === 0 ? (
              <p className="text-sm text-muted">Spans will group here by specialist.</p>
            ) : (
              <ul className="space-y-3">
                {data.agentStats.map((agent) => (
                  <li key={agent.name}>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span>{agent.name}</span>
                      <span className="font-mono text-[11px] text-muted">
                        {agent.completed}/{agent.total} · {formatUsd(agent.costUsd)}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel-2">
                      <div
                        className="h-full rounded-full bg-live/80"
                        style={{ width: `${Math.round((agent.total / maxAgentTotal) * 100)}%` }}
                      />
                    </div>
                    <div className="mt-1 font-mono text-[10px] text-muted">
                      {agent.tokens.toLocaleString()} tok · {formatDuration(agent.durationMs)} · avg risk{" "}
                      {Math.round(agent.avgRisk)}
                      {agent.failed ? ` · ${agent.failed} failed` : ""}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-line bg-panel/80 p-5">
            <h2 className="mb-4 text-sm font-medium">Recent spans</h2>
            {data.recentSpans.length === 0 ? (
              <p className="text-sm text-muted">No agent executions recorded.</p>
            ) : (
              <ul className="space-y-2">
                {data.recentSpans.map((span) => (
                  <li key={span.id}>
                    <Link
                      href={`/observability/${span.executionId}`}
                      className="block rounded-lg border border-line bg-background px-3 py-2 hover:border-live/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm">{span.agent.name}</span>
                        <StatusBadge status={span.result} />
                      </div>
                      <div className="mt-1 font-mono text-[11px] text-muted">
                        {span.execution.workflow.name} · {formatDuration(span.durationMs)} ·{" "}
                        {span.tokenTotal.toLocaleString()} tok · {formatUsd(span.costUsd)} · risk{" "}
                        {span.riskScore} · {formatRelative(span.createdAt)}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
