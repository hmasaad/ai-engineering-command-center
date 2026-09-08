import Link from "next/link";
import { GatewayPipeline } from "@/components/gateway-pipeline";
import { ToolLayerAscii, ToolLayerGroups } from "@/components/tool-layer-catalog";
import { GhostLink, PageHeader, PrimaryLink, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";

export default async function ToolLayerPage() {
  const events = await db.gatewayEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { agent: true, execution: { include: { task: true } } },
  });
  const latest = events[0];

  return (
    <div>
      <PageHeader
        kicker="Tool Layer"
        title="Controlled tools"
        description="Agents do not call GitHub, CI, or observability directly. Every request goes through the Tool Gateway, then the Policy Engine, then Allow, Deny, or Approval."
        actions={
          <>
            <GhostLink href="/security">Security</GhostLink>
            <PrimaryLink href="/security/permissions">Policy table</PrimaryLink>
          </>
        }
      />

      <ToolLayerAscii />

      <p className="mt-3 max-w-3xl text-xs text-muted">
        Shell, secrets, deploy apply, and MCP are not in this catalog. Requesting them is a default deny unless a detector is auditing the attempt.
      </p>

      <div className="mt-8">
        <ToolLayerGroups />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <GatewayPipeline
          verdict={latest?.verdict}
          riskScore={latest?.riskScore}
          toolName={latest?.toolName}
        />
        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Live requests
          </div>
          <p className="mt-2 text-sm text-muted">
            The gateway records every tool name the orchestrator proposed. Unknown names never reach GitHub or CI.
          </p>
          <div className="mt-4 grid gap-2">
            {events.length === 0 ? (
              <p className="text-sm text-muted">
                No tool requests yet. Run a specialist to create the first decision.
              </p>
            ) : (
              events.map((event) => (
                <Link
                  key={event.id}
                  href={`/history/${event.executionId}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-line bg-background px-3 py-2 text-sm hover:border-live/40"
                >
                  <span>
                    {event.agent.name} · {event.toolName}
                    <span className="block text-xs text-muted">
                      {event.execution.task.title} · risk {event.riskScore}
                    </span>
                  </span>
                  <StatusBadge
                    status={
                      event.verdict === "human"
                        ? "awaiting_gateway"
                        : event.verdict === "allow"
                          ? "allowed"
                          : "denied"
                    }
                  />
                </Link>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
