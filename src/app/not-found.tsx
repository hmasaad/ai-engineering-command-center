import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted">
        404
      </div>
      <h1 className="mt-2 text-2xl font-semibold">Not in the command center</h1>
      <p className="mt-2 text-sm text-muted">That record does not exist.</p>
      <Link href="/" className="mt-6 inline-block text-sm text-live hover:underline">
        Return to overview
      </Link>
    </div>
  );
}
