import Link from "next/link";
import {
  EmptyState,
  GhostLink,
  PageHeader,
  PrimaryLink,
  StatusBadge,
} from "@/components/ui";
import { listRegistryAgents, MVP_AGENT_IDS, ORCHESTRATOR_MVP_ASCII } from "@/lib/registry";
import { DOMAINS } from "@/lib/development";
import { cx } from "@/lib/utils";

export default async function AgentsPage() {
  const agents = await listRegistryAgents();
  const mvp = MVP_AGENT_IDS.map((id) => agents.find((agent) => agent.spec.id === id)).filter(
    (agent): agent is (typeof agents)[number] => Boolean(agent),
  );

  return (
    <div>
      <PageHeader
        kicker="Orchestrator MVP"
        title="Agent Registry"
        description="Agents are records, not code. Register a specialist with tools, permissions, a default model, and risk — then drop it into a workflow. The Agent Runtime loads this table; the Model Router picks the live model for the task."
        actions={
          <>
            <GhostLink href="/runtime">Agent Runtime</GhostLink>
            <GhostLink href="/routing">Model Routing</GhostLink>
            <GhostLink href="/evals">Agent Evals</GhostLink>
            <PrimaryLink href="/agents/new">Register agent</PrimaryLink>
          </>
        }
      />

      <div className="overflow-x-auto rounded-xl border border-live/35 bg-[#070d14] p-5 shadow-[0_0_48px_rgba(61,220,151,0.08)]">
        <pre className="min-w-[22rem] text-center font-mono text-[11px] leading-6 text-live sm:text-[12px]">
          {ORCHESTRATOR_MVP_ASCII}
        </pre>
      </div>
      <p className="mt-3 max-w-3xl text-xs text-muted">
        First working slice: Architect, Developer, and QA are registry entries. Verification and human approval still sit in front of Result.
      </p>

      {agents.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="Agent registry is empty"
            body="Run npm run setup to seed the built-in specialists, or register an agent now."
          />
        </div>
      ) : (
        <>
          {mvp.length > 0 ? (
            <section className="mt-8">
              <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                Orchestrator slice
              </h2>
              <div className="grid gap-3 md:grid-cols-3">
                {mvp.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} highlight />
                ))}
              </div>
            </section>
          ) : null}

          <div className="mt-10 space-y-8">
            {DOMAINS.map((domain) => {
              const group = agents.filter((agent) => agent.spec.domain === domain.value);
              if (group.length === 0) return null;
              return (
                <section key={domain.value}>
                  <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                    {domain.label}
                  </h2>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {group.map((agent) => (
                      <AgentCard key={agent.id} agent={agent} />
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function AgentCard({
  agent,
  highlight,
}: {
  agent: Awaited<ReturnType<typeof listRegistryAgents>>[number];
  highlight?: boolean;
}) {
  const spec = agent.spec;
  return (
    <Link
      href={`/agents/${agent.id}`}
      className={cx(
        "rounded-xl border bg-panel/80 p-5 hover:border-live/40",
        highlight ? "border-live/35" : "border-line",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            {spec.id}
          </div>
          <h3 className="mt-1 font-medium">{spec.name}</h3>
        </div>
        <div className="flex flex-col items-end gap-1">
          <StatusBadge status={spec.enabled ? "active" : "disabled"} />
          <StatusBadge status={spec.riskLevel} />
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">{spec.description}</p>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {spec.tools.slice(0, 4).map((tool) => (
          <span
            key={tool}
            className="rounded-full bg-panel-2 px-2 py-0.5 font-mono text-[10px] text-live"
          >
            {tool}
          </span>
        ))}
        {spec.capabilities.slice(0, 3).map((cap) => (
          <span
            key={cap}
            className="rounded-full bg-panel-2 px-2 py-0.5 font-mono text-[10px] text-muted"
          >
            {cap}
          </span>
        ))}
      </div>
      <div className="mt-4 font-mono text-[11px] text-muted">
        {spec.model} · {agent._count.workflowSteps} workflows · {agent._count.executionSteps}{" "}
        runs
      </div>
    </Link>
  );
}
