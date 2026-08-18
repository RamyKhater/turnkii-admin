import Link from "next/link";
import { asc } from "drizzle-orm";
import { requireCap } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { users, styles, services } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui";
import { NewRequestForm } from "@/components/requests/new-request-form";

export default async function NewRequestPage() {
  await requireCap("requests:create");
  const db = await getDb();
  const us = await db.select({ id: users.id, name: users.name, role: users.role, active: users.active }).from(users);
  const owners = us.filter((u) => u.active && (u.role === "agent" || u.role === "ops_manager")).map((u) => ({ id: u.id, name: u.name }));
  const styleRows = await db.select({ key: styles.key, name: styles.name }).from(styles).orderBy(asc(styles.sortOrder));
  const serviceRows = await db.select({ key: services.key, name: services.name }).from(services).orderBy(asc(services.sortOrder));

  return (
    <>
      <PageHeader
        eyebrow="Requests"
        title="New request"
        sub="Log a request that came in by phone, WhatsApp or in person, and assign it."
        actions={<Link href="/requests" className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">← Requests</Link>}
      />
      <div className="max-w-2xl p-6 lg:p-8">
        <NewRequestForm owners={owners} styles={styleRows} services={serviceRows} />
      </div>
    </>
  );
}
