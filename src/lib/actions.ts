"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { fetchGithubRepo, parseGithubRepo } from "@/lib/github";
import { ALL_SERVICES } from "@/lib/development";
import { parseEngineeringIntent } from "@/lib/autonomous";
import { OPERATIONS_SERVICES } from "@/lib/operations";
import { SECURITY_SERVICES } from "@/lib/security";
import { startExecution, resolveApproval } from "@/lib/orchestrator/engine";
import { uniqueSlug } from "@/lib/utils";

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

function revalidateAll() {
  revalidatePath("/", "layout");
}

export async function previewGithubRepo(url: string) {
  const parsed = parseGithubRepo(url);
  if (!parsed) {
    return { error: "Use owner/repo or a github.com URL." };
  }
  try {
    const data = await fetchGithubRepo(parsed.owner, parsed.repo);
    return { data };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "GitHub lookup failed.",
    };
  }
}

export async function createProject(formData: FormData) {
  const name = text(formData, "name");
  const description = text(formData, "description");
  const github = text(formData, "github");

  if (!name) {
    return { error: "Project name is required." };
  }

  let githubOwner: string | null = null;
  let githubRepo: string | null = null;
  let githubUrl: string | null = null;
  let defaultBranch: string | null = null;
  let githubMeta: string | null = null;
  let lastSyncedAt: Date | null = null;

  if (github) {
    const parsed = parseGithubRepo(github);
    if (!parsed) {
      return { error: "GitHub value must be owner/repo or a github.com URL." };
    }
    githubOwner = parsed.owner;
    githubRepo = parsed.repo;
    githubUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;
    try {
      const meta = await fetchGithubRepo(parsed.owner, parsed.repo);
      githubMeta = JSON.stringify(meta);
      defaultBranch = meta.defaultBranch;
      lastSyncedAt = new Date();
      githubUrl = meta.htmlUrl;
    } catch (error) {
      return {
        error:
          error instanceof Error
            ? error.message
            : "Could not sync the GitHub repository.",
      };
    }
  }

  const project = await db.project.create({
    data: {
      name,
      slug: uniqueSlug(name),
      description: description || null,
      githubOwner,
      githubRepo,
      githubUrl,
      defaultBranch,
      githubMeta,
      lastSyncedAt,
    },
  });

  revalidateAll();
  redirect(`/projects/${project.id}`);
}

export async function syncProjectGithub(projectId: string) {
  const project = await db.project.findUnique({ where: { id: projectId } });
  if (!project?.githubOwner || !project.githubRepo) {
    return { error: "This project has no GitHub repository linked." };
  }
  try {
    const meta = await fetchGithubRepo(project.githubOwner, project.githubRepo);
    await db.project.update({
      where: { id: projectId },
      data: {
        githubMeta: JSON.stringify(meta),
        githubUrl: meta.htmlUrl,
        defaultBranch: meta.defaultBranch,
        lastSyncedAt: new Date(),
      },
    });
    revalidateAll();
    return { ok: true as const };
  } catch (error) {
    return {
      error: error instanceof Error ? error.message : "GitHub sync failed.",
    };
  }
}

export async function createAgent(formData: FormData) {
  const name = text(formData, "name");
  const role = text(formData, "role") || "architect";
  const domain = text(formData, "domain") || "development";
  const description = text(formData, "description");
  const capabilities = text(formData, "capabilities");
  const systemPrompt = text(formData, "systemPrompt");

  if (!name || !description) {
    return { error: "Name and description are required." };
  }

  const capabilityList = capabilities
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const agent = await db.agent.create({
    data: {
      name,
      slug: uniqueSlug(name),
      role,
      domain,
      description,
      capabilities: JSON.stringify(capabilityList),
      systemPrompt:
        systemPrompt ||
        `You are the ${name} capability inside the AI Engineering Command Center.`,
    },
  });

  revalidateAll();
  redirect(`/agents/${agent.id}`);
}

export async function toggleAgentStatus(agentId: string) {
  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) return;
  await db.agent.update({
    where: { id: agentId },
    data: { status: agent.status === "active" ? "inactive" : "active" },
  });
  revalidateAll();
}

export async function createTask(formData: FormData) {
  const projectId = text(formData, "projectId");
  const title = text(formData, "title");
  const description = text(formData, "description");
  const type = text(formData, "type") || "feature";
  const priority = text(formData, "priority") || "medium";
  const focusKindRaw = text(formData, "focusKind");
  const focusKind =
    !focusKindRaw || focusKindRaw === "none" ? null : focusKindRaw;
  const focusRef = text(formData, "focusRef") || null;
  const workflowId = text(formData, "workflowId");
  const runNow = text(formData, "runNow") === "on";

  if (!projectId || !title || !description) {
    return { error: "Project, title, and description are required." };
  }

  const task = await db.task.create({
    data: {
      projectId,
      title,
      description,
      type,
      priority,
      focusKind: focusKind || null,
      focusRef: focusRef || null,
    },
  });

  if (runNow && workflowId) {
    const result = await startExecution(task.id, workflowId);
    revalidateAll();
    redirect(`/history/${result.executionId}`);
  }

  revalidateAll();
  redirect(`/tasks/${task.id}`);
}

const workflowStepSchema = z.object({
  agentId: z.string().min(1),
  name: z.string().min(1),
  action: z.string().min(1),
  requiresApproval: z.boolean(),
  instruction: z.string().optional(),
});

export async function createWorkflow(formData: FormData) {
  const name = text(formData, "name");
  const description = text(formData, "description");
  const projectId = text(formData, "projectId") || null;
  const rawSteps = text(formData, "steps");

  if (!name || !description) {
    return { error: "Name and description are required." };
  }

  let steps: z.infer<typeof workflowStepSchema>[];
  try {
    steps = z.array(workflowStepSchema).min(1).parse(JSON.parse(rawSteps));
  } catch {
    return { error: "Add at least one valid workflow step." };
  }

  const workflow = await db.workflow.create({
    data: {
      name,
      description,
      projectId,
      isTemplate: !projectId,
      steps: {
        create: steps.map((step, index) => ({
          agentId: step.agentId,
          name: step.name,
          action: step.action,
          requiresApproval: step.requiresApproval,
          instruction: step.instruction?.trim() || null,
          order: index,
        })),
      },
    },
  });

  revalidateAll();
  redirect(`/workflows/${workflow.id}`);
}

export async function runTaskWorkflow(formData: FormData) {
  const taskId = text(formData, "taskId");
  const workflowId = text(formData, "workflowId");
  if (!taskId || !workflowId) {
    return { error: "Choose a workflow to run." };
  }
  const result = await startExecution(taskId, workflowId);
  revalidateAll();
  redirect(`/history/${result.executionId}`);
}

export async function decideApproval(formData: FormData) {
  const approvalId = text(formData, "approvalId");
  const decision = text(formData, "decision");
  const comment = text(formData, "comment");
  const resolvedBy = text(formData, "resolvedBy") || "operator";

  if (decision !== "approved" && decision !== "rejected") {
    return { error: "Invalid decision." };
  }

  const result = await resolveApproval(
    approvalId,
    decision,
    comment,
    resolvedBy,
  );
  revalidateAll();
  redirect(`/history/${result.executionId}`);
}

export async function runDevelopmentService(formData: FormData) {
  const projectId = text(formData, "projectId");
  const mode = text(formData, "mode") || "service";
  const serviceSlug = text(formData, "serviceSlug");
  const playbookId = text(formData, "playbookId");
  const title = text(formData, "title");
  const description = text(formData, "description");
  const priority = text(formData, "priority") || "medium";
  const focusKindRaw = text(formData, "focusKind");
  const focusKind =
    !focusKindRaw || focusKindRaw === "none" ? null : focusKindRaw;
  const focusRef = text(formData, "focusRef") || null;

  if (!projectId || !title || !description) {
    return { error: "Project, title, and description are required." };
  }

  const service = ALL_SERVICES.find((item) => item.slug === serviceSlug);
  const workflow =
    mode === "playbook" && playbookId
      ? await db.workflow.findUnique({ where: { id: playbookId } })
      : await db.workflow.findFirst({
          where: { kind: "service", serviceSlug },
        });

  if (!workflow) {
    return {
      error: "No Command Center workflow is registered for that service.",
    };
  }

  const task = await db.task.create({
    data: {
      projectId,
      title,
      description,
      type: service?.taskType || "feature",
      priority,
      focusKind: focusKind || null,
      focusRef: focusRef || null,
    },
  });

  const result = await startExecution(task.id, workflow.id);
  revalidateAll();
  redirect(`/history/${result.executionId}`);
}

export async function runSecurityService(formData: FormData) {
  const projectId = text(formData, "projectId");
  const mode = text(formData, "mode") || "service";
  const serviceSlug = text(formData, "serviceSlug");
  const playbookId = text(formData, "playbookId");
  const title = text(formData, "title");
  const description = text(formData, "description");
  const priority = text(formData, "priority") || "medium";
  const focusKindRaw = text(formData, "focusKind");
  const focusKind =
    !focusKindRaw || focusKindRaw === "none" ? null : focusKindRaw;
  const focusRef = text(formData, "focusRef") || null;

  if (!projectId || !title || !description) {
    return { error: "Project, title, and description are required." };
  }

  const service = SECURITY_SERVICES.find((item) => item.slug === serviceSlug);
  const workflow =
    mode === "playbook" && playbookId
      ? await db.workflow.findUnique({ where: { id: playbookId } })
      : await db.workflow.findFirst({
          where: { kind: "service", serviceSlug },
        });

  if (!workflow) {
    return {
      error: "No Command Center workflow is registered for that service.",
    };
  }

  const task = await db.task.create({
    data: {
      projectId,
      title,
      description,
      type: service?.taskType || "security",
      priority,
      focusKind: focusKind || null,
      focusRef: focusRef || null,
    },
  });

  const result = await startExecution(task.id, workflow.id);
  revalidateAll();
  redirect(`/history/${result.executionId}`);
}

export async function runOperationsService(formData: FormData) {
  const projectId = text(formData, "projectId");
  const mode = text(formData, "mode") || "service";
  const serviceSlug = text(formData, "serviceSlug");
  const playbookId = text(formData, "playbookId");
  const title = text(formData, "title");
  const description = text(formData, "description");
  const priority = text(formData, "priority") || "high";
  const focusKindRaw = text(formData, "focusKind");
  const focusKind =
    !focusKindRaw || focusKindRaw === "none" ? null : focusKindRaw;
  const focusRef = text(formData, "focusRef") || null;

  if (!projectId || !title || !description) {
    return { error: "Project, title, and description are required." };
  }

  const service = OPERATIONS_SERVICES.find((item) => item.slug === serviceSlug);
  const workflow =
    mode === "playbook" && playbookId
      ? await db.workflow.findUnique({ where: { id: playbookId } })
      : await db.workflow.findFirst({
          where: { kind: "service", serviceSlug },
        });

  if (!workflow) {
    return {
      error: "No Command Center workflow is registered for that service.",
    };
  }

  const task = await db.task.create({
    data: {
      projectId,
      title,
      description,
      type: service?.taskType || "incident",
      priority,
      focusKind: focusKind || null,
      focusRef: focusRef || null,
    },
  });

  const result = await startExecution(task.id, workflow.id);
  revalidateAll();
  redirect(`/history/${result.executionId}`);
}

export async function runGatewayIntercept(formData: FormData) {
  const projectId = text(formData, "projectId");
  const title = text(formData, "title");
  const description = text(formData, "description");
  const priority = text(formData, "priority") || "high";

  if (!projectId || !title || !description) {
    return { error: "Project, title, and description are required." };
  }

  const workflow = await db.workflow.findFirst({
    where: { kind: "service", serviceSlug: "developer" },
  });
  if (!workflow) {
    return { error: "AI Developer is not registered as a Command Center service." };
  }

  const task = await db.task.create({
    data: {
      projectId,
      title,
      description,
      type: "security",
      priority,
    },
  });

  const result = await startExecution(task.id, workflow.id);
  revalidateAll();
  redirect(`/history/${result.executionId}`);
}

export async function runAutonomousIntent(formData: FormData) {
  const projectId = text(formData, "projectId");
  const intent = text(formData, "intent");
  const notes = text(formData, "notes");
  const priority = text(formData, "priority") || "high";

  if (!projectId || !intent) {
    return { error: "Project and intent are required." };
  }

  const parsed = parseEngineeringIntent(intent);
  if (!parsed) {
    return {
      error: "Could not expand that intent. Try “Prepare release 2.4.0”.",
    };
  }

  const workflow = await db.workflow.findFirst({
    where: { name: parsed.playbookName, isTemplate: true, projectId: null },
  });
  if (!workflow) {
    return {
      error: `No Command Center playbook named “${parsed.playbookName}” is registered. Run seed.`,
    };
  }

  const description = notes
    ? `${parsed.description}\n\nAdditional notes:\n${notes}`
    : parsed.description;

  const task = await db.task.create({
    data: {
      projectId,
      title: parsed.title,
      description,
      type: parsed.id === "hotfix" ? "incident" : "release",
      priority: parsed.id === "hotfix" ? "critical" : priority,
    },
  });

  const result = await startExecution(task.id, workflow.id);
  revalidateAll();
  redirect(`/history/${result.executionId}`);
}

export async function updateToolPermission(formData: FormData) {
  const id = text(formData, "id");
  const mode = text(formData, "mode");
  if (!id || !["allow", "deny", "require_approval"].includes(mode)) {
    return { error: "Invalid permission update." };
  }
  await db.toolPermission.update({
    where: { id },
    data: { mode },
  });
  revalidateAll();
}

export async function toggleSecurityPolicy(formData: FormData) {
  const id = text(formData, "id");
  if (!id) return { error: "Missing policy." };
  const policy = await db.securityPolicy.findUnique({ where: { id } });
  if (!policy) return { error: "Policy not found." };
  await db.securityPolicy.update({
    where: { id },
    data: { enabled: !policy.enabled },
  });
  revalidateAll();
}
