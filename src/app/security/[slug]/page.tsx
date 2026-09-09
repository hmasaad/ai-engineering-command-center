import { notFound } from "next/navigation";
import { GatewayPipeline } from "@/components/gateway-pipeline";
import { SecurityGatewayAscii, SecurityGatewayExamples } from "@/components/security-gateway";
import { SecurityRunForm } from "@/components/security-run-form";
import { EmptyState, GhostLink, PageHeader, PrimaryLink } from "@/components/ui";
import { db } from "@/lib/db";
import { SECURITY_PLAYBOOKS, SECURITY_SERVICES } from "@/lib/security";

export default async function SecurityServicePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const service = SECURITY_SERVICES.find((item) => item.slug === slug);
  if (!service) notFound();

  const [agent, projects, playbooks] = await Promise.all([
    db.agent.findUnique({ where: { slug } }),
    db.project.findMany({ orderBy: { name: "asc" } }),
    db.workflow.findMany({
      where: { domain: "security", kind: "playbook", isTemplate: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const related = SECURITY_PLAYBOOKS.filter((playbook) =>
    playbook.steps.some((step) => step.agent === slug),
  );

  return (
    <div className="max-w-3xl">
      <PageHeader
        kicker="Security service"
        title={service.name}
        description={service.description}
        actions={
          <>
            <GhostLink href="/security/gateway">Security Gateway</GhostLink>
            <GhostLink href="/security">All services</GhostLink>
          </>
        }
      />
      {slug === "security-gateway" ? (
        <div className="mb-6 space-y-6">
          <SecurityGatewayAscii />
          <SecurityGatewayExamples />
          <GatewayPipeline />
        </div>
      ) : null}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {service.capabilities.map((cap) => (
          <span
            key={cap}
            className="rounded-full bg-panel-2 px-3 py-1 font-mono text-[10px] text-muted"
          >
            {cap}
          </span>
        ))}
      </div>
      <p className="mb-6 text-sm text-muted">{service.systemPrompt}</p>

      {related.length > 0 ? (
        <section className="mb-6 rounded-xl border border-line bg-panel/80 p-5">
          <h2 className="mb-2 text-sm font-medium">Playbooks that include this service</h2>
          <ul className="space-y-1 text-sm text-muted">
            {related.map((playbook) => (
              <li key={playbook.name}>{playbook.name} — {playbook.description}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {projects.length === 0 || !agent ? (
        <EmptyState
          title="Nothing to run against"
          body="Register a project, then run this service through the orchestrator and gateway."
          action={<PrimaryLink href="/projects/new">Register project</PrimaryLink>}
        />
      ) : (
        <SecurityRunForm
          defaultServiceSlug={slug}
          projects={projects.map((project) => ({ id: project.id, name: project.name }))}
          services={SECURITY_SERVICES.map((item) => ({
            slug: item.slug,
            name: item.name,
          }))}
          playbooks={playbooks}
        />
      )}
    </div>
  );
}
