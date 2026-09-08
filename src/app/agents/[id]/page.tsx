import Link from "next/link";
import { notFound } from "next/navigation";
import { ToggleAgentButton } from "@/components/toggle-agent-button";
import { GhostLink, PageHeader, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { parseJson } from "@/lib/utils";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await db.agent.findUnique({
    where: { id },
    include: {
      workflowSteps: {
        include: { workflow: true },
        take: 12,
      },
    },
  });
  if (!agent) notFound();
  const capabilities = parseJson<string[]>(agent.capabilities, []);

  return (
    <div className="max-w-3xl">
      <PageHeader
        kicker={agent.role}
        title={agent.name}
        description={agent.description}
        actions={
          <>
            <GhostLink href="/agents">All agents</GhostLink>
            <ToggleAgentButton agentId={agent.id} status={agent.status} />
          </>
        }
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <StatusBadge status={agent.status} />
        <span className="rounded-full bg-panel px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
          {agent.domain}
        </span>
      </div>
      <section className="rounded-xl border border-line bg-panel/80 p-5">
        <h2 className="text-sm font-medium">Capabilities</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {capabilities.map((cap) => (
            <span key={cap} className="rounded-full bg-panel-2 px-3 py-1 text-xs">
              {cap}
            </span>
          ))}
        </div>
        <h2 className="mt-6 text-sm font-medium">Charter</h2>
        <p className="mt-2 text-sm text-muted">{agent.systemPrompt}</p>
      </section>
      <section className="mt-6 rounded-xl border border-line bg-panel/80 p-5">
        <h2 className="mb-3 text-sm font-medium">Used in workflows</h2>
        {agent.workflowSteps.length === 0 ? (
          <p className="text-sm text-muted">Not attached to a workflow yet.</p>
        ) : (
          <ul className="space-y-2">
            {agent.workflowSteps.map((step) => (
              <li key={step.id}>
                <Link href={`/workflows/${step.workflowId}`} className="text-sm hover:text-live">
                  {step.workflow.name}
                  <span className="text-muted"> · {step.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
