import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/session";
import { homeSectionFor } from "@/lib/auth/rbac";

export default async function DeniedPage() {
  const user = await getCurrentUser();
  const home = user ? homeSectionFor(user.role) : "/login";
  return (
    <main className="grid min-h-dvh place-items-center p-8">
      <div className="max-w-md text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">403</p>
        <h1 className="mt-2 font-serif text-4xl">Not your access level</h1>
        <p className="mt-3 text-sm leading-relaxed text-sub">
          Your role doesn&apos;t have permission for that section. If you think this is
          a mistake, ask an admin to adjust your access.
        </p>
        <Link
          href={home}
          className="mt-6 inline-block rounded-full bg-ink px-6 py-3 text-sm font-bold text-cream hover:bg-lime hover:text-ink"
        >
          Back to your workspace
        </Link>
      </div>
    </main>
  );
}
