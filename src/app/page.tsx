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
import { getCommandCenterBoard } from "@/lib/observability";
import { getCommandCenterData } from "@/lib/queries";
import { formatRelative } from "@/lib/utils";

export default async function CommandCenterPage() {
  const [data, board] = await Promise.all([
    getCommandCenterData(),
    getCommandCenterBoard(),
  ]);

  return (
    <div>
      <PageHeader
        kicker="Observability"
        title="Command Center"
        description="Every agent action is an event — workflow, agent, tool, risk, duration, tokens, status. The board is that stream, not a chatbot log."
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
            Production alert → incident → logs → deploy inspect → RCA → fix → QA → security gate → deploy → monitor → recovery.
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
            “Prepare release 2.4.0” expands into analyze, notes, review, security, tests, build, a human gate, deploy, monitor, and verify.
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
