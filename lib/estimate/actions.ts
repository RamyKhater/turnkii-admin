"use server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { estimates, requests, owners } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";
import { notifyRoles } from "@/lib/notifications";
import { emitToFlpp } from "@/lib/flpp/emit";
import { getEstimateConfig } from "@/lib/estimate/store";
import { autoCost, type EstimateBrief } from "@/lib/estimate/engine";
import { sendEmail, emailEnabled, layout, button, appUrl, facts } from "@/lib/email/send";

const SLA_HOURS = 24;

async function nextEstRef(db: Awaited<ReturnType<typeof getDb>>): Promise<number> {
  const [{ maxn }] = await db.select({ maxn: sql<number>`coalesce(max(split_part(ref, '-', 2)::int), 1000)` }).from(estimates);
  return Math.max(1001, Number(maxn ?? 1000) + 1);
}

/** Kick off a costed-estimate request: snapshot the brief, auto-cost it
 *  internally (seeds FLPP + sanity-checks), open the estimate with a 24h SLA
 *  measured from the client's original submission, and push it to FLPP. */
export async function requestEstimate(requestId: number): Promise<{ error?: string; ref?: string }> {
  const user = await assertCap("estimates:request");
  const db = await getDb();
  const [r] = await db.select().from(requests).where(eq(requests.id, requestId)).limit(1);
  if (!r) return { error: "Request not found." };
  const [existing] = await db.select().from(estimates).where(eq(estimates.requestId, requestId)).limit(1);
  if (existing) return { ref: existing.ref }; // one estimate per request

  const brief: EstimateBrief = {
    propertyType: r.propertyType, area: r.area, units: r.units, services: r.services ?? [],
    style: r.style, package: r.pkg, budgetPlan: r.budgetPlan, materials: r.materials ?? [],
  };
  const { rates } = await getEstimateConfig();
  const ac = autoCost(brief, rates);
  const slaDueAt = new Date(r.createdAt.getTime() + SLA_HOURS * 3600_000);

  let seq = await nextEstRef(db);
  let row: typeof estimates.$inferSelect | undefined;
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      [row] = await db.insert(estimates).values({
        ref: `EST-${seq}`, requestId: r.id, ownerId: r.ownerId ?? null,
        brief: { ...brief, propertyType: brief.propertyType, contactName: r.contactName, location: r.location },
        tier: ac.tier, autoQuotation: ac.quotation, autoBreakdown: ac.lines as unknown as Record<string, unknown>[],
        status: "requested", slaDueAt,
      }).returning();
      break;
    } catch (e) {
      const code = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
      if (code === "23505" && attempt < 19) { seq++; continue; }
      throw e;
    }
  }
  if (!row) return { error: "Could not open the estimate." };

  await emitToFlpp("estimate.requested", null, {
    requestRef: r.ref, estimateRef: row.ref, autoQuotation: ac.quotation, tier: ac.tier,
    brief: { client: r.contactName, unit: r.propertyType, area: ac.area, units: ac.units, services: r.services ?? [], style: r.style },
  });
  await db.update(requests).set({ flppSharedAt: new Date(), updatedAt: new Date() }).where(eq(requests.id, r.id));
  await logActivity(user.id, "estimate.request", "estimate", row.id, { requestId, autoQuotation: ac.quotation });
  await notifyRoles(["ops_manager", "project_manager"], {
    type: "estimate.requested", title: `Estimate requested · ${row.ref}`,
    body: `${r.contactName ?? "Client"} · due ${slaDueAt.toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`,
    entity: "request", entityId: requestId, href: `/requests/${requestId}`,
  });
  revalidatePath(`/requests/${requestId}`);
  return { ref: row.ref };
}

/** Sign off the FLPP-confirmed estimate and publish it to the customer. Requires
 *  a confirmed quotation; mints the share token, emails the customer the link. */
export async function signOffEstimate(estimateId: number): Promise<{ error?: string; url?: string }> {
  const user = await assertCap("estimates:signoff");
  const db = await getDb();
  const [e] = await db.select().from(estimates).where(eq(estimates.id, estimateId)).limit(1);
  if (!e) return { error: "Not found." };
  if (e.status === "published") return { url: e.customerUrl ?? undefined };
  if (e.status !== "confirmed" || !e.confirmedQuotation) return { error: "Waiting on FLPP to confirm the figure first." };

  const token = e.token ?? randomBytes(24).toString("hex");
  const customerUrl = `${appUrl()}/estimate/${token}`;
  await db.update(estimates).set({
    status: "published", signedOffBy: user.id, signedOffAt: new Date(),
    token, customerUrl, sentAt: new Date(), updatedAt: new Date(),
  }).where(eq(estimates.id, estimateId));
  await logActivity(user.id, "estimate.signoff", "estimate", estimateId, { ref: e.ref });

  // Email the customer their estimate + payment options.
  let to: string | null = null;
  if (e.ownerId) { const [o] = await db.select({ email: owners.email }).from(owners).where(eq(owners.id, e.ownerId)).limit(1); to = o?.email ?? null; }
  if (!to && e.requestId) { const [r] = await db.select({ email: requests.email }).from(requests).where(eq(requests.id, e.requestId)).limit(1); to = r?.email ?? null; }
  if (to && emailEnabled()) {
    const egp = (n: number) => `EGP ${Math.round(n).toLocaleString("en-US")}`;
    await sendEmail({
      to,
      subject: "Your Turnkii estimate & payment options",
      html: layout({
        heading: "Your costed estimate is ready",
        intro: "We've prepared your estimate with a full breakdown and flexible payment options. Open it any time with the link below.",
        body: facts([["Reference", e.ref], ["Project estimate", egp(e.confirmedQuotation)]]) + button("View your estimate", customerUrl),
        preheader: "Your Turnkii estimate and payment options are ready.",
      }),
    });
  }
  if (e.requestId) revalidatePath(`/requests/${e.requestId}`);
  revalidatePath(`/estimates/${estimateId}`);
  return { url: customerUrl };
}
