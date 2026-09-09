import Link from "next/link";
import {
  AgentStateAscii,
  AgentStateExampleJson,
  AgentStateLive,
  AgentStateNodes,
  AgentStateUnsafeAscii,
} from "@/components/agent-state";
import { GhostLink, PageHeader, PrimaryLink, StatusBadge } from "@/components/ui";
import { getLiveWorkflowState, getRecentWorkflowStates } from "@/lib/agent-state";

export default async function AgentStatePage() {
  const [live, recent] = await Promise.all([
    getLiveWorkflowState(),
    getRecentWorkflowStates(),
  ]);

  return (
    <div>
      <PageHeader
        kicker="Control plane"
        title="Agent State"
        description="Agents are not stateless chatbots. Every workflow keeps durable state: goal, plan, tasks, current task, agent states, tool results, decisions, errors, approvals, and the final result — even after an execution pauses."
        actions={
          <>
            <GhostLink href="/runtime">Agent Runtime</GhostLink>
            <GhostLink href="/routing">Model Routing</GhostLink>
            <PrimaryLink href="/history">History</PrimaryLink>
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <AgentStateAscii />
        <AgentStateUnsafeAscii />
      </div>
      <p className="mt-3 max-w-3xl text-xs text-muted">
        The Agent Runtime runs one specialist. Agent State is what the workflow still knows when that specialist finishes.
      </p>
      <div className="mt-4">
        <AgentStateNodes />
      </div>

      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        <AgentStateExampleJson />
        {live ? (
          <AgentStateLive
            title={live.title}
            status={live.document.status}
            href={live.href}
            historyHref={live.historyHref}
            compact={live.compact}
          />
        ) : (
          <p className="self-center text-sm text-muted">
            Run Production alert to persist a live workflow state document.
          </p>
        )}
      </div>

      <section className="mt-8 rounded-xl border border-line bg-panel/80 p-5">
        <h2 className="mb-3 text-sm font-medium">Recent workflow state</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-muted">
            No executions yet. Start a workflow and the state document is written on every pause.
          </p>
        ) : (
          <ul className="space-y-2">
            {recent.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line bg-background px-3 py-2 text-sm hover:border-live/40"
                >
                  <span>
                    {row.compact.workflow}
                    <span className="block text-xs text-muted">
                      {row.project} · {row.title}
                      {row.compact.current_task
                        ? ` · ${row.compact.current_task}`
                        : ""}
                    </span>
                  </span>
                  <StatusBadge status={row.compact.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
