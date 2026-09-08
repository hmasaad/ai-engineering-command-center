"use client";

import { useMemo, useState } from "react";
import { runDevelopmentService } from "@/lib/actions";
import type { GithubIssue, GithubPullRequest } from "@/lib/constants";
import { TASK_PRIORITIES } from "@/lib/constants";
import { Field, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export type DevelopmentProjectOption = {
  id: string;
  name: string;
  pullRequests: GithubPullRequest[];
  issues: GithubIssue[];
};

export function DevelopmentRunForm({
  projects,
  services,
  playbooks,
  defaultServiceSlug,
}: {
  projects: DevelopmentProjectOption[];
  services: Array<{ slug: string; name: string }>;
  playbooks: Array<{ id: string; name: string }>;
  defaultServiceSlug?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [serviceSlug, setServiceSlug] = useState(
    defaultServiceSlug || services[0]?.slug || "",
  );
  const [mode, setMode] = useState<"service" | "playbook">("service");
  const [focusKind, setFocusKind] = useState("none");
  const [focusRef, setFocusRef] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const project = useMemo(
    () => projects.find((item) => item.id === projectId),
    [projects, projectId],
  );
  const serviceName =
    services.find((item) => item.slug === serviceSlug)?.name || "service";

  function applyPullRequest(pr: GithubPullRequest) {
    setFocusKind("pr");
    setFocusRef(String(pr.number));
    setTitle(`Review PR #${pr.number}: ${pr.title}`);
    setDescription(
      pr.body ||
        `Review GitHub pull request #${pr.number} (${pr.title}) through the PR Reviewer service.`,
    );
  }

  function applyIssue(issue: GithubIssue) {
    setFocusKind("issue");
    setFocusRef(String(issue.number));
    setTitle(`Investigate #${issue.number}: ${issue.title}`);
    setDescription(
      `Investigate GitHub issue #${issue.number} (${issue.title}) through Bug Investigation.`,
    );
  }

  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted">
        Register a project first. Development Intelligence runs against Command
        Center projects, not as a standalone product.
      </p>
    );
  }

  return (
    <form
      action={async (formData) => {
        setError(null);
        const result = await runDevelopmentService(formData);
        if (result?.error) setError(result.error);
      }}
      className="space-y-4 rounded-xl border border-line bg-panel/80 p-5"
    >
      <input type="hidden" name="mode" value={mode} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Project">
          <select
            name="projectId"
            value={projectId}
            onChange={(event) => setProjectId(event.target.value)}
            className={fieldClass}
          >
            {projects.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Service">
          <select
            name="serviceSlug"
            value={serviceSlug}
            onChange={(event) => setServiceSlug(event.target.value)}
            className={fieldClass}
          >
            {services.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("service")}
          className={`rounded-full px-3 py-1 text-xs ${mode === "service" ? "bg-live/15 text-live" : "bg-panel-2 text-muted"}`}
        >
          Run this service
        </button>
        <button
          type="button"
          onClick={() => setMode("playbook")}
          className={`rounded-full px-3 py-1 text-xs ${mode === "playbook" ? "bg-live/15 text-live" : "bg-panel-2 text-muted"}`}
        >
          Run a playbook
        </button>
      </div>

      {mode === "playbook" ? (
        <Field label="Playbook">
          <select name="playbookId" required className={fieldClass}>
            {playbooks.map((playbook) => (
              <option key={playbook.id} value={playbook.id}>
                {playbook.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      {project && (project.pullRequests.length > 0 || project.issues.length > 0) ? (
        <div className="rounded-lg border border-line bg-background p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
            Attach GitHub context
          </div>
          {project.pullRequests.length > 0 ? (
            <div className="mb-2">
              <div className="mb-1 text-xs text-muted">Open PRs</div>
              <div className="flex flex-wrap gap-1.5">
                {project.pullRequests.slice(0, 6).map((pr) => (
                  <button
                    key={pr.number}
                    type="button"
                    onClick={() => applyPullRequest(pr)}
                    className="rounded-full border border-line px-2 py-0.5 text-xs hover:border-live/50"
                  >
                    #{pr.number} {pr.title.slice(0, 42)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {project.issues.length > 0 ? (
            <div>
              <div className="mb-1 text-xs text-muted">Open issues</div>
              <div className="flex flex-wrap gap-1.5">
                {project.issues.slice(0, 6).map((issue) => (
                  <button
                    key={issue.number}
                    type="button"
                    onClick={() => applyIssue(issue)}
                    className="rounded-full border border-line px-2 py-0.5 text-xs hover:border-live/50"
                  >
                    #{issue.number} {issue.title.slice(0, 42)}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Focus kind">
          <select
            name="focusKind"
            value={focusKind}
            onChange={(event) => setFocusKind(event.target.value)}
            className={fieldClass}
          >
            <option value="none">None</option>
            <option value="pr">Pull request</option>
            <option value="issue">Issue</option>
            <option value="test">Failing test</option>
          </select>
        </Field>
        <Field label="Focus ref">
          <input
            name="focusRef"
            value={focusRef}
            onChange={(event) => setFocusRef(event.target.value)}
            placeholder="#123 or test name"
            className={fieldClass}
          />
        </Field>
        <Field label="Priority">
          <select name="priority" defaultValue="medium" className={fieldClass}>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Title">
        <input
          name="title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={`Run ${serviceName}`}
          className={fieldClass}
        />
      </Field>
      <Field label="Brief">
        <textarea
          name="description"
          required
          rows={5}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What should this service look at, and how will we know it was useful?"
          className={fieldClass}
        />
      </Field>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <SubmitButton>
        {mode === "playbook" ? "Run playbook" : `Run ${serviceName}`}
      </SubmitButton>
    </form>
  );
}
