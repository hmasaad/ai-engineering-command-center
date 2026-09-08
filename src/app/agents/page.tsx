import Link from "next/link";
import {
  EmptyState,
  PageHeader,
  PrimaryLink,
  StatusBadge,
} from "@/components/ui";
import { db } from "@/lib/db";
import { DOMAINS } from "@/lib/development";
import { parseJson } from "@/lib/utils";

export default async function AgentsPage() {
  const agents = await db.agent.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { workflowSteps: true, executionSteps: true } } },
  });

  return (
    <div>
      <PageHeader
        kicker="Registry"
        title="Agents"
        description="Development Intelligence, Operations, and Security services live here. They are capabilities of the Command Center, not independent products."
        actions={<PrimaryLink href="/agents/new">Register agent</PrimaryLink>}
      />
      {agents.length === 0 ? (
        <EmptyState
          title="Agent registry is empty"
          body="Run npm run setup to seed the built-in specialists."
        />
      ) : (
        <div className="space-y-8">
          {DOMAINS.map((domain) => {
            const group = agents.filter((agent) => agent.domain === domain.value);
            if (group.length === 0) return null;
            return (
              <section key={domain.value}>
                <h2 className="mb-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                  {domain.label}
                </h2>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {group.map((agent) => {
                    const capabilities = parseJson<string[]>(agent.capabilities, []);
                    return (
                      <Link
                        key={agent.id}
                        href={`/agents/${agent.id}`}
                        className="rounded-xl border border-line bg-panel/80 p-5 hover:border-live/40"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
                              {agent.role}
                            </div>
                            <h3 className="mt-1 font-medium">{agent.name}</h3>
                          </div>
                          <StatusBadge status={agent.status} />
                        </div>
                        <p className="mt-2 text-sm text-muted">{agent.description}</p>
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {capabilities.map((cap) => (
                            <span
                              key={cap}
                              className="rounded-full bg-panel-2 px-2 py-0.5 font-mono text-[10px] text-muted"
                            >
                              {cap}
                            </span>
                          ))}
                        </div>
                        <div className="mt-4 font-mono text-[11px] text-muted">
                          {agent._count.workflowSteps} workflow steps ·{" "}
                          {agent._count.executionSteps} runs
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
