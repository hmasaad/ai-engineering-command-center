import { db } from "@/lib/db";
import { parseJson } from "@/lib/utils";
import type { GithubMeta } from "@/lib/constants";

export async function getNavCounts() {
  const [pendingApprovals, running] = await Promise.all([
    db.approval.count({ where: { status: "pending" } }),
    db.execution.count({
      where: { status: { in: ["running", "awaiting_approval"] } },
    }),
  ]);
  return { pendingApprovals, running };
}

export async function getCommandCenterData() {
  const [
    projectCount,
    agentCount,
    openTasks,
    pendingApprovals,
    running,
    completed,
    projects,
    agents,
    pendingApprovalRows,
    recentExecutions,
    recentEvents,
    workflows,
  ] = await Promise.all([
    db.project.count(),
    db.agent.count({ where: { status: "active" } }),
    db.task.count({
      where: { status: { in: ["open", "in_progress", "awaiting_approval"] } },
    }),
    db.approval.count({ where: { status: "pending" } }),
    db.execution.count({
      where: { status: { in: ["running", "awaiting_approval"] } },
    }),
    db.execution.count({ where: { status: "completed" } }),
    db.project.findMany({
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: { _count: { select: { tasks: true, executions: true } } },
    }),
    db.agent.findMany({ orderBy: { name: "asc" } }),
    db.approval.findMany({
      where: { status: "pending" },
      orderBy: { requestedAt: "asc" },
      take: 6,
      include: {
        execution: {
          include: {
            task: true,
            project: true,
            workflow: true,
          },
        },
        step: { include: { agent: true } },
      },
    }),
    db.execution.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        project: true,
        task: true,
        workflow: true,
      },
    }),
    db.executionEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        execution: { include: { project: true, task: true } },
      },
    }),
    db.workflow.count(),
  ]);

  return {
    projectCount,
    agentCount,
    openTasks,
    pendingApprovals,
    running,
    completed,
    workflows,
    projects,
    agents,
    pendingApprovalRows,
    recentExecutions,
    recentEvents,
  };
}

export function projectGithubMeta(project: { githubMeta: string | null }) {
  const meta = parseJson<GithubMeta | null>(project.githubMeta, null);
  if (!meta) return null;
  return {
    ...meta,
    commits: meta.commits || [],
    pullRequests: meta.pullRequests || [],
    issues: meta.issues || [],
  };
}
