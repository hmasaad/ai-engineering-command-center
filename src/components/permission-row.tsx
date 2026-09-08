"use client";

import { updateToolPermission } from "@/lib/actions";
import { fieldClass } from "@/components/ui";

export function PermissionRow({
  id,
  mode,
}: {
  id: string;
  mode: string;
}) {
  return (
    <form
      action={async (formData) => {
        await updateToolPermission(formData);
      }}
    >
      <input type="hidden" name="id" value={id} />
      <select
        name="mode"
        defaultValue={mode}
        className={fieldClass}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
      >
        <option value="allow">Allow</option>
        <option value="require_approval">Human approval</option>
        <option value="deny">Deny</option>
      </select>
    </form>
  );
}
