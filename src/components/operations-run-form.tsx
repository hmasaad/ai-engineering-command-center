"use client";

import { useMemo, useState } from "react";
import { runOperationsService } from "@/lib/actions";
import { TASK_PRIORITIES } from "@/lib/constants";
import { ALERT_EXAMPLES } from "@/lib/operations";
import { Field, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function OperationsRunForm({
  projects,
  services,
  playbooks,
  defaultServiceSlug,
  defaultPlaybookId,
}: {
  projects: Array<{ id: string; name: string }>;
  services: Array<{ slug: string; name: string }>;
  playbooks: Array<{ id: string; name: string }>;
  defaultServiceSlug?: string;
  defaultPlaybookId?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState(projects[0]?.id || "");
  const [serviceSlug, setServiceSlug] = useState(
    defaultServiceSlug || services[0]?.slug || "",
  );
  const [mode, setMode] = useState<"service" | "playbook">(
    defaultPlaybookId ? "playbook" : "service",
  );
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");

  const serviceName =
    services.find((item) => item.slug === serviceSlug)?.name || "service";
  const examples = useMemo(() => ALERT_EXAMPLES, []);

  if (projects.length === 0) {
    return (
      <p className="text-sm text-muted">
        Register a project first. Operations runs against Command Center
        projects, through the orchestrator and the security gateway.
      </p>
    );
  }

  return (
    <form
      action={async (formData) => {
        setError(null);
        const result = await runOperationsService(formData);
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
          onClick={() => setMode("playbook")}
          className={`rounded-full px-3 py-1 text-xs ${mode === "playbook" ? "bg-live/15 text-live" : "bg-panel-2 text-muted"}`}
        >
          Run a playbook
        </button>
        <button
          type="button"
          onClick={() => setMode("service")}
          className={`rounded-full px-3 py-1 text-xs ${mode === "service" ? "bg-live/15 text-live" : "bg-panel-2 text-muted"}`}
        >
          Run this service
        </button>
      </div>

      {mode === "playbook" ? (
        <Field label="Playbook">
          <select
            name="playbookId"
            required
            defaultValue={defaultPlaybookId}
            className={fieldClass}
          >
            {playbooks.map((playbook) => (
              <option key={playbook.id} value={playbook.id}>
                {playbook.name}
              </option>
            ))}
          </select>
        </Field>
      ) : null}

      <div className="rounded-lg border border-line bg-background p-3">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
          Sample alerts
        </div>
        <div className="flex flex-wrap gap-1.5">
          {examples.map((example) => (
            <button
              key={example.id}
              type="button"
              onClick={() => {
                setTitle(example.title);
                setDescription(example.description);
              }}
              className="rounded-full border border-line px-2 py-0.5 text-xs hover:border-warn/50"
            >
              {example.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Focus kind">
          <select name="focusKind" defaultValue="none" className={fieldClass}>
            <option value="none">None</option>
            <option value="deploy">Deploy / SHA</option>
            <option value="pr">Pull request</option>
            <option value="issue">Issue</option>
          </select>
        </Field>
        <Field label="Priority">
          <select name="priority" defaultValue="critical" className={fieldClass}>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority.value} value={priority.value}>
                {priority.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <input type="hidden" name="focusRef" value="" />

      <Field label="Title">
        <input
          name="title"
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder={
            mode === "playbook" ? "Production alert" : `Run ${serviceName}`
          }
          className={fieldClass}
        />
      </Field>
      <Field label="Alert / brief">
        <textarea
          name="description"
          required
          rows={5}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="What fired, which SLO, when the last deploy landed, and how we will know it recovered."
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
