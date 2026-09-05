import Link from "next/link";
import { redirect } from "next/navigation";
import { and, eq, or, ilike, isNull, desc, type SQL } from "drizzle-orm";
import { requireUser } from "@/lib/auth/guard";
import { canAccessSection, can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { requests, users, styles } from "@/lib/db/schema";
import { PageHeader, StatusBadge, Card, Avatar } from "@/components/ui";
import { FilterBar } from "@/components/requests/filter-bar";
import { ClickableRow } from "@/components/requests/clickable-row";

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; owner?: string; kind?: string; source?: string; channel?: string; q?: string }>;
}) {
  const user = await requireUser();
  if (!canAccessSection(user.role, "requests")) redirect("/denied");
  const isAgent = user.role === "agent";
  const sp = await searchParams;

  const db = await getDb();
  const us = await db.select({ id: users.id, name: users.name, role: users.role }).from(users);
  const nameOf = new Map(us.map((u) => [u.id, u.name]));
  const owners = us.filter((u) => u.role === "agent" || u.role === "ops_manager");
  const styleRows = await db.select({ key: styles.key, name: styles.name }).from(styles);
  const styleName = new Map(styleRows.map((s) => [s.key, s.name]));

  const conds: SQL[] = [];
  if (isAgent) conds.push(eq(requests.assignedTo, user.id));
  else if (sp.owner === "unassigned") conds.push(isNull(requests.assignedTo));
  else if (sp.owner) conds.push(eq(requests.assignedTo, Number(sp.owner)));
  if (sp.status) conds.push(eq(requests.status, sp.status as typeof requests.status.enumValues[number]));
  if (sp.kind) conds.push(eq(requests.kind, sp.kind));
  if (sp.source) conds.push(eq(requests.source, sp.source));
  if (sp.channel) conds.push(eq(requests.channel, sp.channel));
  if (sp.q) {
    const like = `%${sp.q}%`;
    conds.push(or(ilike(requests.ref, like), ilike(requests.contactName, like), ilike(requests.location, like), ilike(requests.referredByCode, like))!);
  }

  const rows = await db
    .select()
    .from(requests)
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(requests.createdAt));

  return (
    <>
      <PageHeader
        eyebrow={isAgent ? "Your queue" : "Pipeline"}
        title="Requests"
        sub={isAgent ? "Requests assigned to you." : "Every incoming brief across the pipeline."}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FilterBar owners={owners} showOwner={!isAgent} />
            {can(user.role, "requests:create") && (
              <Link href="/requests/new" className="rounded-full bg-ink px-4 py-2 text-sm font-bold text-cream hover:bg-lime hover:text-ink">
                + New request
              </Link>
            )}
          </div>
        }
      />

      <div className="p-6 lg:p-8">
        <p className="mb-3 text-sm text-sub">
          <span className="font-bold text-ink tabular">{rows.length}</span> request{rows.length === 1 ? "" : "s"}
        </p>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead>
                <tr className="border-b border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-bold">Ref</th>
                  <th className="px-3 py-3 font-bold">Contact</th>
                  <th className="px-3 py-3 font-bold">Property</th>
                  <th className="px-3 py-3 font-bold">Style</th>
                  <th className="px-3 py-3 font-bold">Owner</th>
                  <th className="px-3 py-3 font-bold">Received</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <ClickableRow key={r.id} href={`/requests/${r.id}`} className="border-b border-line last:border-0 hover:bg-sand/30">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Link href={`/requests/${r.id}`} className="font-bold text-ink hover:text-olive">{r.ref}</Link>
                        {r.kind === "financing" && (
                          <span className="rounded-full bg-olive/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-olive">Financing</span>
                        )}
                        {r.kind === "service" && (
                          <span className="rounded-full bg-info/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-info">Service</span>
                        )}
                      </div>
                      <div className="text-xs text-muted"><span className="capitalize">{r.source}</span> · {r.channel}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="font-semibold">{r.contactName}</div>
                      <div className="text-xs text-muted">{r.phone}</div>
                    </td>
                    <td className="px-3 py-3 text-sub">
                      {r.kind === "financing" ? (
                        <>
                          {r.indicativeLimit ? `EGP ${r.indicativeLimit.toLocaleString("en-US")}` : "—"}
                          <div className="text-xs text-muted">{r.employment ?? "Pre-approval"}</div>
                        </>
                      ) : r.kind === "service" ? (
                        <>
                          {r.services?.length ? r.services.join(", ") : "Service request"}
                          <div className="text-xs text-muted">{r.location}</div>
                        </>
                      ) : (
                        <>
                          {r.propertyType} · {r.area}m²
                          <div className="text-xs text-muted">{r.location}</div>
                        </>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sub">{r.kind === "financing" ? (r.budgetPlan ?? "—") : r.kind === "service" ? (r.channel ?? "—") : (r.style ? styleName.get(r.style) ?? r.style : "—")}</td>
                    <td className="px-3 py-3">
                      {r.assignedTo ? (
                        <span className="inline-flex items-center gap-2">
                          <Avatar name={nameOf.get(r.assignedTo) ?? "?"} />
                          <span className="text-sub">{nameOf.get(r.assignedTo)}</span>
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-warn">Unassigned</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-sub tabular">
                      {r.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                    </td>
                    <td className="px-5 py-3"><StatusBadge status={r.status} /></td>
                  </ClickableRow>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted">
                      No requests match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
