"use client";

import { useState } from "react";
import { runTaskWorkflow } from "@/lib/actions";
import { Field, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function RunExecutionForm({
  taskId,
  workflows,
}: {
  taskId: string;
  workflows: Array<{ id: string; name: string }>;
}) {
  const [error, setError] = useState<string | null>(null);

  if (workflows.length === 0) {
    return (
      <p className="text-sm text-muted">
        Create a workflow before running this task.
      </p>
    );
  }

  return (
    <form
      action={async (formData) => {
        setError(null);
        const result = await runTaskWorkflow(formData);
        if (result?.error) setError(result.error);
      }}
      className="space-y-3"
    >
      <input type="hidden" name="taskId" value={taskId} />
      <Field label="Workflow">
        <select name="workflowId" required className={fieldClass} defaultValue={workflows[0].id}>
          {workflows.map((workflow) => (
            <option key={workflow.id} value={workflow.id}>
              {workflow.name}
            </option>
          ))}
        </select>
      </Field>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <SubmitButton>Run through orchestrator</SubmitButton>
    </form>
  );
}
