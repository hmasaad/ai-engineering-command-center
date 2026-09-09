import {
  AgentEvalBoardRows,
  AgentEvalFeaturedSuites,
  AgentEvalLive,
  AgentEvalsAscii,
  AgentEvalsUnsafeAscii,
} from "@/components/agent-evals";
import { GhostLink, PageHeader, PrimaryLink } from "@/components/ui";
import { getAgentEvalBoard } from "@/lib/agent-evals";

export default async function AgentEvalsPage() {
  const board = await getAgentEvalBoard();

  return (
    <div>
      <PageHeader
        kicker="Control plane"
        title="Agent Evals"
        description="Is this agent actually good? Observability records what ran. Evals score the specialist — so a change to prompts, models, tools, or orchestration is measured automatically on the next bound run."
        actions={
          <>
            <GhostLink href="/routing">Model Routing</GhostLink>
            <GhostLink href="/observability">Traces</GhostLink>
            <PrimaryLink href="/agents">Registry</PrimaryLink>
          </>
        }
      />

      <div className="grid gap-3 lg:grid-cols-2">
        <AgentEvalsAscii />
        <AgentEvalsUnsafeAscii />
      </div>
      <p className="mt-3 max-w-3xl text-xs text-muted">
        The Model Router picks a lane. Agent Evals ask whether that lane, that prompt, and that tool set actually produced a good specialist.
      </p>

      <div className="mt-8">
        <AgentEvalFeaturedSuites />
      </div>

      <div className="mt-8 grid gap-3 lg:grid-cols-2">
        {board.prReviewer ? (
          <AgentEvalLive card={board.prReviewer} />
        ) : (
          <p className="self-center text-sm text-muted">
            Run PR Reviewer to score bug detection, security, false positives, and recommendation quality.
          </p>
        )}
        {board.incident ? (
          <AgentEvalLive card={board.incident} />
        ) : (
          <p className="self-center text-sm text-muted">
            Run Production alert to score RCA accuracy, evidence, hallucination, recovery, and escalation.
          </p>
        )}
      </div>

      <div className="mt-8">
        <AgentEvalBoardRows rows={board.rows} />
      </div>
    </div>
  );
}
