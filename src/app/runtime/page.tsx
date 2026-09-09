import Link from "next/link";
import {
  AgentRuntimeAscii,
  AgentRuntimeDuties,
  AgentRuntimeLive,
  AgentRuntimeNodes,
  AgentRuntimeWalkAscii,
} from "@/components/agent-runtime";
import { GhostLink, PageHeader, PrimaryLink, StatusBadge } from "@/components/ui";
import { getRuntimeLive, getRuntimeSessions } from "@/lib/agent-runtime";

export default async function AgentRuntimePage() {
  const [session, sessions] = await Promise.all([
    getRuntimeLive(),
    getRuntimeSessions(),
  ]);

  return (
    <div>
      <PageHeader
        kicker="Control plane"
        title="Agent Runtime"
        description="The orchestrator schedules. The Agent Runtime is the layer that actually runs a specialist — identity, instructions, context, memory, routed model, tools, intercepts, retries, timeouts, tokens, security checks, state, and the final result."
        actions={
          <>
            <GhostLink href="/agents">Registry</GhostLink>
            <GhostLink href="/routing">Model Routing</GhostLink>
            <GhostLink href="/state">Agent State</GhostLink>
            <PrimaryLink href="/security/gateway">Gateway</PrimaryLink>
          </>
        }
      />

      <AgentRuntimeAscii />
      <p className="mt-3 max-w-3xl text-xs text-muted">
        Context, tools, and memory join here. Tool calls never skip the Security Gateway. Observability records what the bound run did.
      </p>

      <div className="mt-8">
        <AgentRuntimeDuties />
      </div>

      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        <AgentRuntimeWalkAscii />
        <div className="space-y-3 self-start">
          <p className="text-sm text-muted">
            Developer Agent is a registry record. The runtime loads that record, binds task context and memory, the Model Router picks the lane, grants declared tools, executes, and intercepts every tool call into the Security Gateway. The specialist continues only after the result returns.
          </p>
          <AgentRuntimeNodes />
        </div>
      </div>

      <div className="mt-8">
        {session ? (
          <AgentRuntimeLive session={session} />
        ) : (
          <p className="text-sm text-muted">
            Run a Developer step to see a live bound session.
          </p>
        )}
      </div>

      <section className="mt-8 rounded-xl border border-line bg-panel/80 p-5">
        <h2 className="mb-3 text-sm font-medium">Recent bound runs</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-muted">
            No Agent Runtime sessions yet. Start a workflow; every specialist executes here, not as a free-standing agent.
          </p>
        ) : (
          <ul className="space-y-2">
            {sessions.map((row) => (
              <li key={row.id}>
                <Link
                  href={row.href}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line bg-background px-3 py-2 text-sm hover:border-live/40"
                >
                  <span>
                    {row.agent} · {row.stepName}
                    <span className="block text-xs text-muted">
                      {row.project} · {row.title} · {row.model} · {row.tools} tools ·{" "}
                      {row.intercepts} intercepts
                      {row.tokens
                        ? ` · ${row.tokens.toLocaleString()} tok`
                        : ""}
                    </span>
                  </span>
                  <StatusBadge status={row.status} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
