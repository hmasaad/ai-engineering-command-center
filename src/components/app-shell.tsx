import Link from "next/link";
import { cx } from "@/lib/utils";
import { MobileNav, SidebarNav } from "@/components/nav";

export function AppShell({
  children,
  pendingApprovals,
  running,
}: {
  children: React.ReactNode;
  pendingApprovals: number;
  running: number;
}) {
  return (
    <div className="flex min-h-full flex-col md:flex-row">
      <aside className="hidden w-64 shrink-0 border-r border-line bg-panel/70 md:flex md:flex-col">
        <div className="border-b border-line px-5 py-5">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-live">
            AECC · Phase 6
          </div>
          <div className="mt-1 text-sm font-semibold leading-snug">
            AI Engineering Command Center
          </div>
        </div>
        <SidebarNav pendingApprovals={pendingApprovals} />
        <div className="border-t border-line p-4 font-mono text-[11px] text-muted">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-live" />
            Policy before execution
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 border-b border-line bg-panel/60 px-4 py-3">
          <div className="flex items-center gap-3 md:hidden">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-live">
              AECC
            </span>
          </div>
          <div className="hidden items-center gap-2 font-mono text-[11px] text-muted md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-live" />
            LIVE
            <span className="text-line">/</span>
            {running} in flight
          </div>
          <Link
            href="/approvals"
            suppressHydrationWarning
            className={cx(
              "rounded-full px-3 py-1 font-mono text-[11px] uppercase tracking-wider",
              pendingApprovals > 0
                ? "bg-warn/15 text-warn"
                : "bg-panel-2 text-muted",
            )}
          >
            {pendingApprovals} awaiting approval
          </Link>
        </header>
        <MobileNav pendingApprovals={pendingApprovals} />
        <main className="flex-1 px-4 py-6 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
