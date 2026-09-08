import { PrismaClient } from "@prisma/client";
import type { ServiceDef } from "../src/lib/development";
import {
  ALL_SERVICES,
  DEVELOPMENT_PLAYBOOKS,
  DEVELOPMENT_SERVICES,
  OTHER_PLAYBOOKS,
} from "../src/lib/development";
import {
  OPERATIONS_PLAYBOOKS,
  OPERATIONS_SERVICES,
} from "../src/lib/operations";
import {
  AUTONOMOUS_PLAYBOOKS,
  AUTONOMOUS_SERVICES,
} from "../src/lib/autonomous";
import {
  DEFAULT_PERMISSIONS,
  DEFAULT_POLICIES,
  SECURITY_PLAYBOOKS,
  SECURITY_SERVICES,
} from "../src/lib/security";

const db = new PrismaClient();

async function upsertServiceWorkflow(
  bySlug: Record<string, { id: string }>,
  service: ServiceDef,
  domain: string,
) {
  const name = `Service: ${service.name}`;
  const existing = await db.workflow.findFirst({
    where: { serviceSlug: service.slug, kind: "service" },
  });
  const step = {
    order: 0,
    name: service.name,
    action: service.defaultAction,
    requiresApproval: service.requiresApproval,
    agentId: bySlug[service.slug].id,
  };
  if (existing) {
    await db.workflowStep.deleteMany({ where: { workflowId: existing.id } });
    await db.workflow.update({
      where: { id: existing.id },
      data: {
        name,
        description: `Run the ${service.name} service through the Command Center orchestrator.`,
        domain,
        kind: "service",
        serviceSlug: service.slug,
        isTemplate: true,
        steps: { create: [step] },
      },
    });
  } else {
    await db.workflow.create({
      data: {
        name,
        description: `Run the ${service.name} service through the Command Center orchestrator.`,
        domain,
        kind: "service",
        serviceSlug: service.slug,
        isTemplate: true,
        steps: { create: [step] },
      },
    });
  }
}

async function main() {
  const catalog = [
    ...ALL_SERVICES,
    ...SECURITY_SERVICES,
    ...OPERATIONS_SERVICES,
    ...AUTONOMOUS_SERVICES,
  ];
  for (const service of catalog) {
    await db.agent.upsert({
      where: { slug: service.slug },
      update: {
        name: service.name,
        role: service.role,
        domain: service.domain,
        description: service.description,
        capabilities: JSON.stringify(service.capabilities),
        systemPrompt: service.systemPrompt,
        status: "active",
      },
      create: {
        slug: service.slug,
        name: service.name,
        role: service.role,
        domain: service.domain,
        description: service.description,
        capabilities: JSON.stringify(service.capabilities),
        systemPrompt: service.systemPrompt,
      },
    });
  }

  const bySlug = Object.fromEntries(
    (await db.agent.findMany()).map((agent) => [agent.slug, agent]),
  );

  for (const service of DEVELOPMENT_SERVICES) {
    await upsertServiceWorkflow(bySlug, service, "development");
  }
  for (const service of SECURITY_SERVICES) {
    await upsertServiceWorkflow(bySlug, service, "security");
  }
  for (const service of OPERATIONS_SERVICES) {
    await upsertServiceWorkflow(bySlug, service, "operations");
  }
  for (const service of AUTONOMOUS_SERVICES) {
    await upsertServiceWorkflow(bySlug, service, "autonomous");
  }

  const playbooks = [
    ...DEVELOPMENT_PLAYBOOKS,
    ...OTHER_PLAYBOOKS,
    ...SECURITY_PLAYBOOKS,
    ...OPERATIONS_PLAYBOOKS,
    ...AUTONOMOUS_PLAYBOOKS,
  ];
  for (const template of playbooks) {
    const existing = await db.workflow.findFirst({
      where: { name: template.name, isTemplate: true, projectId: null },
    });
    const steps = template.steps.map((step, order) => ({
      order,
      name: step.name,
      action: step.action,
      requiresApproval: step.requiresApproval,
      instruction: step.instruction ?? null,
      agentId: bySlug[step.agent].id,
    }));
    if (existing) {
      await db.workflowStep.deleteMany({ where: { workflowId: existing.id } });
      await db.workflow.update({
        where: { id: existing.id },
        data: {
          description: template.description,
          domain: template.domain,
          kind: "playbook",
          isTemplate: true,
          steps: { create: steps },
        },
      });
    } else {
      await db.workflow.create({
        data: {
          name: template.name,
          description: template.description,
          domain: template.domain,
          kind: "playbook",
          isTemplate: true,
          steps: { create: steps },
        },
      });
    }
  }

  for (const policy of DEFAULT_POLICIES) {
    await db.securityPolicy.upsert({
      where: { slug: policy.slug },
      update: {
        name: policy.name,
        detector: policy.detector,
        weight: policy.weight,
        description: policy.description,
      },
      create: {
        slug: policy.slug,
        name: policy.name,
        detector: policy.detector,
        weight: policy.weight,
        description: policy.description,
        enabled: true,
      },
    });
  }

  for (const row of DEFAULT_PERMISSIONS) {
    await db.toolPermission.upsert({
      where: {
        agentSlug_toolName: { agentSlug: row.agentSlug, toolName: row.toolName },
      },
      update: { mode: row.mode, note: row.note },
      create: {
        agentSlug: row.agentSlug,
        toolName: row.toolName,
        mode: row.mode,
        note: row.note,
      },
    });
  }

  console.log(
    "Seeded Development, Security, Operations, Autonomous services, gateway policies, and tool permissions.",
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
