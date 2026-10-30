"use server";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { estimates, requests, owners } from "@/lib/db/schema";
import { assertCap } from "@/lib/auth/guard";
import { logActivity } from "@/lib/activity";
import { openEstimateForRequest } from "@/lib/estimate/open";
import { sendEmail, emailEnabled, layout, button, appUrl, facts } from "@/lib/email/send";

/** Ops kicks off a costed-estimate request for a request. */
export async function requestEstimate(requestId: number): Promise<{ error?: string; ref?: string }> {
  const user = await assertCap("estimates:request");
  const res = await openEstimateForRequest(requestId, user.id);
  revalidatePath(`/requests/${requestId}`);
  return res;
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
