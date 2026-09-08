"use client";

import { useMemo, useState } from "react";
import { createWorkflow } from "@/lib/actions";
import { STEP_ACTIONS } from "@/lib/constants";
import { Field, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

type DraftStep = {
  agentId: string;
  name: string;
  action: string;
  requiresApproval: boolean;
  instruction: string;
};

export function WorkflowForm({
  agents,
  projects,
}: {
  agents: Array<{ id: string; name: string; role: string }>;
  projects: Array<{ id: string; name: string }>;
}) {
  const defaultAgent = agents[0]?.id ?? "";
  const [error, setError] = useState<string | null>(null);
  const [steps, setSteps] = useState<DraftStep[]>([
    {
      agentId: defaultAgent,
      name: "Draft technical plan",
      action: "plan",
      requiresApproval: true,
      instruction: "",
    },
  ]);

  const payload = useMemo(() => JSON.stringify(steps), [steps]);

  function update(index: number, patch: Partial<DraftStep>) {
    setSteps((current) =>
      current.map((step, i) => (i === index ? { ...step, ...patch } : step)),
    );
  }

  function move(index: number, direction: -1 | 1) {
    setSteps((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  return (
    <form
      action={async (formData) => {
        setError(null);
        const result = await createWorkflow(formData);
        if (result?.error) setError(result.error);
      }}
      className="space-y-4"
    >
      <div className="space-y-4 rounded-xl border border-line bg-panel/80 p-5">
        <Field label="Name">
          <input name="name" required placeholder="Feature delivery" className={fieldClass} />
        </Field>
        <Field label="Description">
          <textarea name="description" required rows={3} className={fieldClass} />
        </Field>
        <Field label="Scope" hint="Leave as template to reuse across projects.">
          <select name="projectId" defaultValue="" className={fieldClass}>
            <option value="">Global template</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name} only
              </option>
            ))}
          </select>
        </Field>
        <input type="hidden" name="steps" value={payload} />
      </div>

      <div className="space-y-3">
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
          Steps
        </div>
        {steps.map((step, index) => (
          <div key={index} className="rounded-xl border border-line bg-panel/80 p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted">Step {index + 1}</span>
              <div className="flex gap-1">
                <button type="button" className="rounded border border-line px-2 py-1 text-xs" onClick={() => move(index, -1)}>
                  Up
                </button>
                <button type="button" className="rounded border border-line px-2 py-1 text-xs" onClick={() => move(index, 1)}>
                  Down
                </button>
                <button
                  type="button"
                  className="rounded border border-line px-2 py-1 text-xs text-danger"
                  onClick={() => setSteps((current) => current.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Agent">
                <select
                  value={step.agentId}
                  onChange={(event) => update(index, { agentId: event.target.value })}
                  className={fieldClass}
                >
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Action">
                <select
                  value={step.action}
                  onChange={(event) => update(index, { action: event.target.value })}
                  className={fieldClass}
                >
                  {STEP_ACTIONS.map((action) => (
                    <option key={action.value} value={action.value}>
                      {action.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Step name">
                <input
                  value={step.name}
                  onChange={(event) => update(index, { name: event.target.value })}
                  className={fieldClass}
                />
              </Field>
              <label className="flex items-end gap-2 pb-2 text-sm">
                <input
                  type="checkbox"
                  checked={step.requiresApproval}
                  onChange={(event) =>
                    update(index, { requiresApproval: event.target.checked })
                  }
                  className="accent-warn"
                />
                Human approval after this step
              </label>
              <div className="sm:col-span-2">
                <Field label="Instruction (optional)">
                  <input
                    value={step.instruction}
                    onChange={(event) =>
                      update(index, { instruction: event.target.value })
                    }
                    className={fieldClass}
                  />
                </Field>
              </div>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() =>
            setSteps((current) => [
              ...current,
              {
                agentId: defaultAgent,
                name: "Next specialist step",
                action: "review",
                requiresApproval: false,
                instruction: "",
              },
            ])
          }
          className="rounded-lg border border-dashed border-line px-3 py-2 text-sm text-muted hover:text-foreground"
        >
          Add step
        </button>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <SubmitButton>Create workflow</SubmitButton>
    </form>
  );
}
