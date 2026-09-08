"use client";

import { useState } from "react";
import { createTask } from "@/lib/actions";
import { TASK_PRIORITIES, TASK_TYPES } from "@/lib/constants";
import { Field, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function TaskForm({
  projects,
  workflows,
  defaultProjectId,
}: {
  projects: Array<{ id: string; name: string }>;
  workflows: Array<{ id: string; name: string }>;
  defaultProjectId?: string;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setError(null);
        const result = await createTask(formData);
        if (result?.error) setError(result.error);
      }}
      className="space-y-4 rounded-xl border border-line bg-panel/80 p-5"
    >
      <Field label="Project">
        <select
          name="projectId"
          required
          defaultValue={defaultProjectId || projects[0]?.id || ""}
          className={fieldClass}
        >
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Title">
        <input name="title" required placeholder="Add SSO to the billing portal" className={fieldClass} />
      </Field>
      <Field label="Description">
        <textarea
          name="description"
          required
          rows={5}
          placeholder="What should change, and how we will know it worked."
          className={fieldClass}
        />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Type">
          <select name="type" defaultValue="feature" className={fieldClass}>
            {TASK_TYPES.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
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
      <Field label="Workflow" hint="Optional. Check “run now” to send it through the orchestrator immediately.">
        <select name="workflowId" className={fieldClass} defaultValue="">
          <option value="">Don’t run yet</option>
          {workflows.map((workflow) => (
            <option key={workflow.id} value={workflow.id}>
              {workflow.name}
            </option>
          ))}
        </select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="runNow" className="accent-live" />
        Run the selected workflow now
      </label>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <SubmitButton>Create task</SubmitButton>
    </form>
  );
}
