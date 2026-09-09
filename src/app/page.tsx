import Link from "next/link";
import { ArchitectureMap } from "@/components/architecture-map";
import { CommandCenterBoard } from "@/components/command-center-board";
import { RefreshButton } from "@/components/submit-button";
import {
  EmptyState,
  PageHeader,
  PrimaryLink,
  StatusBadge,
} from "@/components/ui";
import {
  FeedbackLoopAscii,
  FeedbackLoopLive,
  FeedbackLoopWalkAscii,
} from "@/components/feedback-loop";
import {
  AgentRuntimeAscii,
  AgentRuntimeWalkAscii,
} from "@/components/agent-runtime";
import {
  AgentStateAscii,
  AgentStateLive,
} from "@/components/agent-state";
import {
  ModelRouterAscii,
  ModelRouterCompact,
} from "@/components/model-router";
import {
  AgentEvalLive,
  AgentEvalsAscii,
} from "@/components/agent-evals";
import { getCommandCenterBoard } from "@/lib/observability";
import { getCommandCenterData } from "@/lib/queries";
import { getFeedbackLoopLive } from "@/lib/feedback-loop";
import { getLiveWorkflowState } from "@/lib/agent-state";
import { getModelRouteLedger } from "@/lib/model-router";
import { getAgentEvalBoard } from "@/lib/agent-evals";
import { formatRelative } from "@/lib/utils";

export default async function CommandCenterPage() {
  const [data, board, loop, routing, evals, state] = await Promise.all([
    getCommandCenterData(),
    getCommandCenterBoard(),
    getFeedbackLoopLive(),
    getModelRouteLedger(),
    getAgentEvalBoard(),
    getLiveWorkflowState(),
  ]);

  return (
    <div>
      <PageHeader
        kicker="Observability"
        title="Command Center"
        description="Observability, the Security Gateway, incident response, and agent execution are one loop around the orchestrator — not four products."
        actions={
          <>
            <RefreshButton />
            <PrimaryLink href="/observability">Traces</PrimaryLink>
          </>
        }
      />

      <CommandCenterBoard
        workflows={board.workflows}
        agents={board.agents}
        approvals={board.approvals}
        metrics={board.metrics}
      />

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <FeedbackLoopAscii />
        <div className="space-y-3">
          <FeedbackLoopWalkAscii />
          {loop ? (
            <FeedbackLoopLive
              title={loop.title}
              status={loop.status}
              href={loop.href}
              historyHref={loop.historyHref}
              stages={loop.stages}
            />
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <AgentRuntimeAscii />
        <div className="space-y-3">
          <AgentRuntimeWalkAscii />
          <Link href="/runtime" className="text-xs text-muted hover:text-live">
            Open Agent Runtime
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <ModelRouterAscii />
        {routing ? (
          <ModelRouterCompact ledger={routing} />
        ) : (
          <p className="self-center text-sm text-muted">
            Run Production alert to see the Model Router split fast, reasoning, and specialized lanes.
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <AgentEvalsAscii />
        {evals.incident ? (
          <AgentEvalLive card={evals.incident} compact />
        ) : evals.prReviewer ? (
          <AgentEvalLive card={evals.prReviewer} compact />
        ) : (
          <p className="self-center text-sm text-muted">
            Run PR Reviewer or Production alert to score whether the agent is actually good.
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-3 lg:grid-cols-2">
        <AgentStateAscii />
        {state ? (
          <AgentStateLive
            title={state.title}
            status={state.document.status}
            href={state.href}
            historyHref={state.historyHref}
            compact={state.compact}
          />
        ) : (
          <p className="self-center text-sm text-muted">
            Run a workflow to persist Agent State.
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <ArchitectureMap
          projects={data.projectCount}
          agents={data.agentCount}
          tasks={data.openTasks}
          approvals={data.pendingApprovals}
        />

        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Approval queue</h2>
            <Link href="/approvals" className="text-xs text-muted hover:text-foreground">
              View all
            </Link>
          </div>
          {data.pendingApprovalRows.length === 0 ? (
            <p className="text-sm text-muted">No human gates waiting.</p>
          ) : (
            <ul className="space-y-3">
              {data.pendingApprovalRows.map((row) => (
                <li key={row.id} className="rounded-lg border border-line bg-background p-3">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/approvals`} className="text-sm font-medium hover:text-live">
                      {row.step.agent.name} · {row.execution.task.title}
                    </Link>
                    <StatusBadge status={row.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    {row.execution.project.name} · {formatRelative(row.requestedAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Development Intelligence</h2>
            <Link href="/development" className="text-xs text-muted hover:text-foreground">
              Open
            </Link>
          </div>
          <p className="mb-3 text-sm text-muted">
            Nine engineering services of this platform — Architect through Documentation — not a row of isolated agents.
          </p>
          <PrimaryLink href="/development">Run a development service</PrimaryLink>
        </section>
        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Operations</h2>
            <Link href="/operations" className="text-xs text-muted hover:text-foreground">
              Open
            </Link>
          </div>
          <p className="mb-3 text-sm text-muted">
            Production alert → incident agent → evidence → analyze → RCA → remediation → security → fix → test → human approval → deploy → monitor.
          </p>
          <PrimaryLink href="/operations">Run a production alert</PrimaryLink>
        </section>
        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Security</h2>
            <Link href="/security" className="text-xs text-muted hover:text-foreground">
              Open
            </Link>
          </div>
          <p className="mb-3 text-sm text-muted">
            Detectors, MCP, permissions, and threat response — plus the gateway that allow / deny / holds every agent tool request.
          </p>
          <PrimaryLink href="/security">Open the gateway</PrimaryLink>
        </section>
        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Autonomous Engineering</h2>
            <Link href="/autonomous" className="text-xs text-muted hover:text-foreground">
              Open
            </Link>
          </div>
          <p className="mb-3 text-sm text-muted">
            “Prepare release 2.4.0” expands into a workflow. Low-risk steps run automatically. Medium waits for approval. High is mandatory human — not unconstrained execution.
          </p>
          <PrimaryLink href="/autonomous">Prepare a release</PrimaryLink>
        </section>
        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Observability</h2>
            <Link href="/observability" className="text-xs text-muted hover:text-foreground">
              Open
            </Link>
          </div>
          <p className="mb-3 text-sm text-muted">
            First-class traces for every agent step: tools, tokens, cost, duration, risk, and the workflow result.
          </p>
          <PrimaryLink href="/observability">Open the dashboard</PrimaryLink>
        </section>
        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">Recent executions</h2>
            <Link href="/history" className="text-xs text-muted hover:text-foreground">
              History
            </Link>
          </div>
          {data.recentExecutions.length === 0 ? (
            <EmptyState
              title="No executions yet"
              body="Register a project, create a task, then run a workflow. Specialists execute inside the orchestrator, not as isolated agents."
              action={<PrimaryLink href="/tasks/new">Create a task</PrimaryLink>}
            />
          ) : (
            <ul className="space-y-2">
              {data.recentExecutions.map((execution) => (
                <li key={execution.id}>
                  <Link
                    href={`/history/${execution.id}`}
                    className="flex items-center justify-between gap-3 rounded-lg border border-line bg-background px-3 py-2 hover:border-live/40"
                  >
                    <div>
                      <div className="text-sm">{execution.task.title}</div>
                      <div className="text-xs text-muted">
                        {execution.project.name} · {execution.workflow.name}
                      </div>
                    </div>
                    <StatusBadge status={execution.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <h2 className="mb-3 text-sm font-medium">Activity</h2>
          {data.recentEvents.length === 0 ? (
            <p className="text-sm text-muted">Execution events will land here.</p>
          ) : (
            <ol className="space-y-3">
              {data.recentEvents.map((event) => (
                <li key={event.id} className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-live" />
                  <div>
                    <Link
                      href={`/history/${event.executionId}`}
                      className="text-sm hover:text-live"
                    >
                      {event.message}
                    </Link>
                    <div className="font-mono text-[11px] text-muted">
                      {event.execution.project.name} · {formatRelative(event.createdAt)}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  );
}
