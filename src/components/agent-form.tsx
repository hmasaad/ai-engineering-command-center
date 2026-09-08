"use client";

import { useState } from "react";
import { createAgent } from "@/lib/actions";
import { AGENT_ROLES } from "@/lib/constants";
import { DOMAINS } from "@/lib/development";
import { Field, fieldClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function AgentForm() {
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      action={async (formData) => {
        setError(null);
        const result = await createAgent(formData);
        if (result?.error) setError(result.error);
      }}
      className="space-y-4 rounded-xl border border-line bg-panel/80 p-5"
    >
      <Field label="Name">
        <input name="name" required placeholder="Release captain" className={fieldClass} />
      </Field>
      <Field label="Role">
        <select name="role" className={fieldClass} defaultValue="architect">
          {AGENT_ROLES.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Domain">
        <select name="domain" className={fieldClass} defaultValue="development">
          {DOMAINS.map((domain) => (
            <option key={domain.value} value={domain.value}>
              {domain.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Description">
        <textarea name="description" required rows={3} className={fieldClass} />
      </Field>
      <Field label="Capabilities" hint="Comma-separated.">
        <input
          name="capabilities"
          placeholder="planning, ADRs, interface design"
          className={fieldClass}
        />
      </Field>
      <Field label="Charter / system prompt">
        <textarea name="systemPrompt" rows={4} className={fieldClass} />
      </Field>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      <SubmitButton>Register agent</SubmitButton>
    </form>
  );
}
