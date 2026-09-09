import Link from "next/link";
import { GatewayPipeline } from "@/components/gateway-pipeline";
import { SecurityRunForm } from "@/components/security-run-form";
import { EmptyState, GhostLink, PageHeader, PrimaryLink, StatusBadge } from "@/components/ui";
import { db } from "@/lib/db";
import { SECURITY_SERVICES } from "@/lib/security";
import type { GatewayCheck } from "@/lib/security-gateway";
import { formatRelative, parseJson } from "@/lib/utils";

export default async function SecurityPage() {
  const [projects, playbooks, recent, events, denied] = await Promise.all([
    db.project.findMany({ orderBy: { name: "asc" } }),
    db.workflow.findMany({
      where: { domain: "security", kind: "playbook", isTemplate: true },
      orderBy: { name: "asc" },
    }),
    db.execution.findMany({
      where: { workflow: { domain: "security" } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { project: true, task: true, workflow: true },
    }),
    db.gatewayEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { agent: true, execution: { include: { task: true } } },
    }),
    db.gatewayEvent.count({ where: { verdict: "deny" } }),
  ]);

  const latest = events[0];
  const latestChecks = latest ? parseJson<GatewayCheck[]>(latest.checks, []) : [];

  return (
    <div>
      <PageHeader
        kicker="Phase 3"
        title="Security"
        description="Prompt injection, hijack, RAG poisoning, MCP, and exfil are checks inside the Security Gateway — not a sidecar product. Every agent tool request is authenticated, authorized, scored, and scanned before Allow, Deny, or Human Approval."
        actions={
          <>
            <GhostLink href="/security/gateway">Security Gateway</GhostLink>
            <GhostLink href="/security/tools">Tool Layer</GhostLink>
            <PrimaryLink href="/security/permissions">Tool permissions</PrimaryLink>
          </>
        }
      />

      <div className="mb-8 grid gap-6 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
        <GatewayPipeline
          verdict={latest?.verdict}
          riskScore={latest?.riskScore}
          toolName={latest?.toolName}
          checks={latestChecks}
        />
        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
            Live gateway
          </div>
          <p className="mt-2 text-sm text-muted">
            {denied} denials recorded. The gateway is not a sidecar product — it sits on the orchestrator path for Development and Security alike.
          </p>
          <div className="mt-4 grid gap-2">
            {events.length === 0 ? (
              <p className="text-sm text-muted">No tool requests yet. Run any specialist to create the first decision.</p>
            ) : (
              events.slice(0, 5).map((event) => (
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
                  <StatusBadge status={event.verdict === "human" ? "awaiting_gateway" : event.verdict === "allow" ? "allowed" : "denied"} />
                </Link>
              ))
            )}
          </div>
        </section>
      </div>

      <div className="mb-8 rounded-xl border border-line bg-panel/80 p-5">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
          Security
        </div>
        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {SECURITY_SERVICES.map((service) => (
            <Link
              key={service.slug}
              href={`/security/${service.slug}`}
              className="rounded-lg border border-line bg-background px-4 py-3 hover:border-live/40"
            >
              <div className="text-sm font-medium">{service.name}</div>
              <p className="mt-1 text-xs text-muted">{service.description}</p>
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
        <div>
          <h2 className="mb-3 text-sm font-medium">Run a service</h2>
          {projects.length === 0 ? (
            <EmptyState
              title="Register a project first"
              body="Security is a layer on Command Center projects, not a standalone scanner."
              action={<PrimaryLink href="/projects/new">Register project</PrimaryLink>}
            />
          ) : (
            <SecurityRunForm
              projects={projects.map((project) => ({ id: project.id, name: project.name }))}
              services={SECURITY_SERVICES.map((service) => ({
                slug: service.slug,
                name: service.name,
              }))}
              playbooks={playbooks}
            />
          )}
        </div>
        <section className="rounded-xl border border-line bg-panel/80 p-5">
          <h2 className="mb-3 text-sm font-medium">Recent security runs</h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted">
              No security executions yet. Run a detector, or send a hostile brief through Developer to watch the gateway hold.
            </p>
          ) : (
            <ul className="space-y-2">
              {recent.map((execution) => (
                <li key={execution.id}>
                  <Link
                    href={`/history/${execution.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-line bg-background px-3 py-2 text-sm hover:border-live/40"
                  >
                    <span>
                      {execution.task.title}
                      <span className="block text-xs text-muted">
                        {execution.workflow.name} · {formatRelative(execution.createdAt)}
                      </span>
                    </span>
                    <StatusBadge status={execution.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
