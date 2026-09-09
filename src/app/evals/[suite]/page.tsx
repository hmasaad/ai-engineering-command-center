import { notFound } from "next/navigation";
import {
  AgentEvalLive,
  AgentEvalSuiteAscii,
  AgentEvalsAscii,
} from "@/components/agent-evals";
import { GhostLink, PageHeader, PrimaryLink } from "@/components/ui";
import { EVAL_SUITES, getSuiteEvalLive, suiteForRole } from "@/lib/agent-evals";

export default async function AgentEvalSuitePage({
  params,
}: {
  params: Promise<{ suite: string }>;
}) {
  const { suite: suiteId } = await params;
  const suite =
    EVAL_SUITES.find((item) => item.id === suiteId) ||
    (suiteId === "generic" ? suiteForRole("generic") : null);
  if (!suite) notFound();
  const live = await getSuiteEvalLive(suite.id);

  return (
    <div>
      <PageHeader
        kicker="Agent Evals"
        title={suite.label}
        description={suite.why}
        actions={
          <>
            <GhostLink href="/evals">All evals</GhostLink>
            <PrimaryLink href="/observability">Traces</PrimaryLink>
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <AgentEvalSuiteAscii suite={suite} />
        <div className="space-y-3">
          <AgentEvalsAscii />
          <p className="text-sm text-muted">
            Roles in this suite: {suite.roles.join(", ")}. Every completed bound run is scored. A drop after a prompt or model change is a regression, not a vibe.
          </p>
        </div>
      </div>

      <div className="mt-8">
        {live ? (
          <AgentEvalLive card={live} />
        ) : (
          <p className="text-sm text-muted">
            No scored run for this suite yet. Run the specialist through the orchestrator.
          </p>
        )}
      </div>
    </div>
  );
}
