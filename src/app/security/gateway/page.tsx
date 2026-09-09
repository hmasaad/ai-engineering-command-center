import Link from "next/link";
import {
  GatewayPipeline,
  SecurityGatewayAscii,
  SecurityGatewayChecks,
  SecurityGatewayExampleAscii,
  SecurityGatewayExamples,
} from "@/components/security-gateway";
import { GhostLink, PageHeader, PrimaryLink, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import type { GatewayCheck } from "@/lib/security-gateway";
import { parseJson } from "@/lib/utils";

export default async function SecurityGatewayPage() {
  const events = await db.gatewayEvent.findMany({
    orderBy: { createdAt: "desc" },
    take: 8,
    include: { agent: true, execution: { include: { task: true } } },
  });
  const latest = events[0];
  const checks = latest ? parseJson<GatewayCheck[]>(latest.checks, []) : [];

  return (
    <div>
      <PageHeader
        kicker="Security boundary"
        title="Security Gateway"
        description="Agents will have GitHub, databases, AWS, Kubernetes, CI/CD, production logs, filesystems, MCP, and APIs. They cannot call those directly. Every tool request is authenticated, authorized, scored, and scanned — then Allow, Deny, or Human Approval."
        actions={
          <>
            <GhostLink href="/security/tools">Tool Layer</GhostLink>
            <PrimaryLink href="/security/permissions">Policy table</PrimaryLink>
          </>
        }
      />

      <SecurityGatewayAscii />

      <p className="mt-3 max-w-3xl text-xs text-muted">
        Prompt injection, MCP security, agent hijacking, and data exfiltration are not a separate product. They are checks inside this gateway.
      </p>

      <div className="mt-8">
        <SecurityGatewayExampleAscii />
      </div>

      <div className="mt-8">
        <SecurityGatewayExamples />
      </div>

      <div className="mt-8">
        <SecurityGatewayChecks checks={checks.length > 0 ? checks : undefined} />
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <GatewayPipeline
          verdict={latest?.verdict}
          riskScore={latest?.riskScore}
          toolName={latest?.toolName}
          checks={checks}
        />
        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Live decisions
          </div>
          <p className="mt-2 text-sm text-muted">
            The orchestrator never invokes a tool until this boundary returns allow. Deny stops the run. Human holds the queue.
          </p>
          <div className="mt-4 grid gap-2">
            {events.length === 0 ? (
              <p className="text-sm text-muted">
                No tool requests yet. Run a specialist, or intercept AI Developer with a hostile brief.
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
