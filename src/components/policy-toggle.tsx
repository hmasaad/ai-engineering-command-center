"use client";

import { toggleSecurityPolicy } from "@/lib/actions";

export function PolicyToggle({
  id,
  enabled,
}: {
  id: string;
  enabled: boolean;
}) {
  return (
    <form
      action={async (formData) => {
        await toggleSecurityPolicy(formData);
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase ${
          enabled ? "bg-live/15 text-live" : "bg-panel-2 text-muted"
        }`}
      >
        {enabled ? "On" : "Off"}
      </button>
    </form>
  );
}
