import { AgentForm } from "@/components/agent-form";
import { GhostLink, PageHeader } from "@/components/ui";

export default function NewAgentPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        kicker="Agent Registry"
        title="Register an agent"
        description="Id, tools, permissions, model, and risk live on the record. The orchestrator loads it — you do not ship a new specialist in code."
        actions={<GhostLink href="/agents">Back</GhostLink>}
      />
      <AgentForm />
    </div>
  );
}
