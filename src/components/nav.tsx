"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/lib/utils";

const items = [
  { href: "/", label: "Command Center", group: "top" },
  { href: "/architecture", label: "Architecture", group: "top" },
  { href: "/projects", label: "Projects", group: "registry" },
  { href: "/agents", label: "Agents", group: "registry" },
  { href: "/tasks", label: "Tasks", group: "registry" },
  { href: "/development", label: "Development", group: "intel" },
  { href: "/operations", label: "Operations", group: "intel" },
  { href: "/security", label: "Security", group: "intel" },
  { href: "/security/gateway", label: "Gateway", group: "intel" },
  { href: "/security/tools", label: "Tool Layer", group: "intel" },
  { href: "/autonomous", label: "Autonomous", group: "intel" },
  { href: "/workflows", label: "Workflows", group: "run" },
  { href: "/approvals", label: "HITL", group: "run" },
  { href: "/history", label: "History", group: "run" },
  { href: "/observability", label: "Observability", group: "telemetry" },
] as const;

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  if (
    href === "/security" &&
    (pathname.startsWith("/security/tools") ||
      pathname.startsWith("/security/gateway") ||
      pathname.startsWith("/security/permissions"))
  ) {
    return false;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function useHasMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}

export function SidebarNav({ pendingApprovals }: { pendingApprovals: number }) {
  const pathname = usePathname();
  const mounted = useHasMounted();
  return (
    <nav className="flex-1 space-y-5 p-3">
      <NavGroup
        title="Platform"
        group="top"
        pathname={mounted ? pathname : ""}
        pendingApprovals={pendingApprovals}
      />
      <NavGroup
        title="Registry"
        group="registry"
        pathname={mounted ? pathname : ""}
        pendingApprovals={pendingApprovals}
      />
      <NavGroup
        title="Intelligence"
        group="intel"
        pathname={mounted ? pathname : ""}
        pendingApprovals={pendingApprovals}
      />
      <NavGroup
        title="Orchestration"
        group="run"
        pathname={mounted ? pathname : ""}
        pendingApprovals={pendingApprovals}
      />
      <NavGroup
        title="Telemetry"
        group="telemetry"
        pathname={mounted ? pathname : ""}
        pendingApprovals={pendingApprovals}
      />
    </nav>
  );
}

function NavGroup({
  title,
  group,
  pathname,
  pendingApprovals,
}: {
  title: string;
  group: "top" | "registry" | "intel" | "run" | "telemetry";
  pathname: string;
  pendingApprovals: number;
}) {
  return (
    <div>
      <div className="px-2 pb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
        {title}
      </div>
      <div className="space-y-0.5">
        {items
          .filter((item) => item.group === group)
          .map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                "flex items-center justify-between rounded-lg px-2.5 py-2 text-sm",
                isActive(pathname, item.href)
                  ? "bg-live/10 text-foreground"
                  : "text-muted hover:bg-panel-2 hover:text-foreground",
              )}
            >
              <span>{item.label}</span>
              {item.href === "/approvals" && pendingApprovals > 0 ? (
                <span className="rounded-full bg-warn/20 px-1.5 font-mono text-[10px] text-warn">
                  {pendingApprovals}
                </span>
              ) : null}
            </Link>
          ))}
      </div>
    </div>
  );
}

export function MobileNav({ pendingApprovals }: { pendingApprovals: number }) {
  const pathname = usePathname();
  const mounted = useHasMounted();
  const current = mounted ? pathname : "";
  return (
    <div className="flex gap-2 overflow-x-auto border-b border-line px-3 py-2 md:hidden">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cx(
            "shrink-0 rounded-full px-3 py-1 text-xs",
            isActive(current, item.href)
              ? "bg-live/15 text-live"
              : "bg-panel text-muted",
          )}
        >
          {item.label}
          {item.href === "/approvals" && pendingApprovals > 0
            ? ` (${pendingApprovals})`
            : ""}
        </Link>
      ))}
    </div>
  );
}
