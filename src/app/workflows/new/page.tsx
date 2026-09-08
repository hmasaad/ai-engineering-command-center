import { WorkflowForm } from "@/components/workflow-form";
import { EmptyState, GhostLink, PageHeader, PrimaryLink } from "@/components/ui";
import { db } from "@/lib/db";

export default async function NewWorkflowPage() {
  const [agents, projects] = await Promise.all([
    db.agent.findMany({
      where: { enabled: true },
      orderBy: { name: "asc" },
    }),
    db.project.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="max-w-3xl">
      <PageHeader
        kicker="Workflows"
        title="Create a workflow"
        description="Sequence specialist capabilities. Mark a step as a human gate to pause the orchestrator until someone in the approval queue acts."
        actions={<GhostLink href="/workflows">Back</GhostLink>}
      />
      {agents.length === 0 ? (
        <EmptyState
          title="No active agents"
          body="Register or seed specialists before composing a workflow."
          action={<PrimaryLink href="/agents">Open registry</PrimaryLink>}
        />
      ) : (
        <WorkflowForm agents={agents} projects={projects} />
      )}
    </div>
  );
}
