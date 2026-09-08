import { AgentForm } from "@/components/agent-form";
import { GhostLink, PageHeader } from "@/components/ui";

export default function NewAgentPage() {
  return (
    <div className="max-w-2xl">
      <PageHeader
        kicker="Agents"
        title="Register a specialist"
        description="New agents join the same registry and can be dropped into workflows. They do not become separate products."
        actions={<GhostLink href="/agents">Back</GhostLink>}
      />
      <AgentForm />
    </div>
  );
}
