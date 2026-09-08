import Link from "next/link";
import { notFound } from "next/navigation";
import { ToggleAgentButton } from "@/components/toggle-agent-button";
import { GhostLink, PageHeader, StatusBadge } from "@/components/ui";
import { getRegistryAgent, specToPublicJson } from "@/lib/registry";

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await getRegistryAgent(id);
  if (!agent) notFound();
  const spec = agent.spec;
  const json = specToPublicJson(spec);

  return (
    <div className="max-w-3xl">
      <PageHeader
        kicker="Agent Registry"
        title={spec.name}
        description={spec.description}
        actions={
          <>
            <GhostLink href="/agents">All agents</GhostLink>
            <ToggleAgentButton agentId={agent.id} enabled={spec.enabled} />
          </>
        }
      />
      <div className="mb-6 flex flex-wrap gap-2">
        <StatusBadge status={spec.enabled ? "active" : "disabled"} />
        <StatusBadge status={spec.riskLevel} />
        <span className="rounded-full bg-panel px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
          {spec.id}
        </span>
        <span className="rounded-full bg-panel px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
          {spec.domain}
        </span>
        <span className="rounded-full bg-panel px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-muted">
          {spec.model}
        </span>
      </div>

      <section className="rounded-xl border border-line bg-panel/80 p-5">
        <h2 className="text-sm font-medium">Registry record</h2>
        <p className="mt-1 text-xs text-muted">
          The orchestrator and policy engine read this record. Adding an agent does not require a code change.
        </p>
        <pre className="mt-4 overflow-x-auto rounded-lg border border-line bg-[#070d14] p-4 font-mono text-[12px] leading-6 text-live">
          {JSON.stringify(json, null, 2)}
        </pre>
      </section>

      <section className="mt-6 rounded-xl border border-line bg-panel/80 p-5">
        <h2 className="text-sm font-medium">Capabilities</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {spec.capabilities.map((cap) => (
            <span key={cap} className="rounded-full bg-panel-2 px-3 py-1 text-xs">
              {cap}
            </span>
          ))}
        </div>
        <h2 className="mt-6 text-sm font-medium">Tools</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {spec.tools.map((tool) => (
            <span key={tool} className="rounded-full border border-live/30 bg-panel-2 px-3 py-1 font-mono text-xs text-live">
              {tool}
            </span>
          ))}
        </div>
        <h2 className="mt-6 text-sm font-medium">Permissions</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {spec.permissions.map((permission) => (
            <span key={permission} className="rounded-full bg-panel-2 px-3 py-1 font-mono text-xs">
              {permission}
            </span>
          ))}
        </div>
        <h2 className="mt-6 text-sm font-medium">Charter</h2>
        <p className="mt-2 text-sm text-muted">{spec.systemPrompt}</p>
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
