import { getCurrentUser } from "@/lib/auth/session";
import { can } from "@/lib/auth/rbac";
import { getDb } from "@/lib/db";
import { requests, users, services, payments, projects, properties, type Request } from "@/lib/db/schema";
import { sourceInsights, serviceInsights, userInsights, toCsv } from "@/lib/insights";
import { firstResponseSla, resolutionSla } from "@/lib/sla";
import { paymentState, KIND_LABEL } from "@/lib/payments";
import { getSiteConfig } from "@/lib/settings";

const fmt = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "");
const round = (n: number, p = 1) => (n ? Number(n.toFixed(p)) : 0);

export async function GET(req: Request2) {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "analytics:view")) {
    return Response.json({ error: "Not authorized" }, { status: 403 });
  }
  const dataset = new URL(req.url).searchParams.get("dataset") || "requests";

  const db = await getDb();
  const rows: Request[] = await db.select().from(requests);
  const us = await db.select({ id: users.id, name: users.name, role: users.role, active: users.active }).from(users);
  const nameOf = new Map(us.map((u) => [u.id, u.name]));
  const serviceNames = (await db.select({ name: services.name }).from(services)).map((s) => s.name);
  const { sla } = await getSiteConfig();

  let headers: string[] = [];
  let data: (string | number | null)[][] = [];

  if (dataset === "sources") {
    headers = ["Traffic source", "Requests", "Won", "Lost", "Won rate %", "Avg first response (h)", "Avg resolution (days)"];
    data = sourceInsights(rows).map((r) => [r.channel, r.requests, r.won, r.lost, r.wonRate, round(r.avgFirstResponseH), round(r.avgResolveDays)]);
  } else if (dataset === "services") {
    headers = ["Service type", "Requests", "Won", "Won rate %"];
    data = serviceInsights(rows, serviceNames).map((r) => [r.service, r.requests, r.won, r.wonRate]);
  } else if (dataset === "users") {
    headers = ["Name", "Role", "Active", "Open assigned", "Won", "Lost", "Won rate %", "Avg resolution (days)"];
    data = userInsights(rows, us).map((r) => [r.name, r.roleLabel, r.active ? "yes" : "no", r.assignedOpen, r.won, r.lost, r.wonRate, round(r.avgResolveDays)]);
  } else if (dataset === "payments") {
    const payRows = await db.select().from(payments);
    const projRows = await db.select({ id: projects.id, name: projects.name }).from(projects);
    const propRows = await db.select({ id: properties.id, name: properties.name }).from(properties);
    const pjName = new Map(projRows.map((p) => [p.id, p.name]));
    const ppName = new Map(propRows.map((p) => [p.id, p.name]));
    headers = ["Project", "Property", "Kind", "Label", "Amount EGP", "Due", "Status", "Days till due", "Method", "Reference", "Paid at", "Has receipt"];
    data = payRows
      .sort((a, b) => (a.dueDate ? new Date(a.dueDate).getTime() : 0) - (b.dueDate ? new Date(b.dueDate).getTime() : 0))
      .map((p) => {
        const st = paymentState(p);
        return [
          p.projectId ? pjName.get(p.projectId) ?? "" : "", p.propertyId ? ppName.get(p.propertyId) ?? "" : "",
          KIND_LABEL[p.kind] ?? p.kind, p.label, p.amount, fmt(p.dueDate), st.state,
          st.daysTillDue ?? "", p.method ?? "", p.reference ?? "", fmt(p.paidAt), p.receiptUrl ? "yes" : "no",
        ];
      });
  } else {
    headers = ["Ref", "Contact", "Phone", "Email", "Property", "Area m2", "Units", "Location", "Services", "Style", "Traffic source", "Campaign", "UTM source", "UTM medium", "UTM content", "Origin", "Status", "Priority", "Owner", "Received", "First response", "Resolved", "First-response SLA", "Resolution SLA"];
    data = rows
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => [
        r.ref, r.contactName, r.phone, r.email, r.propertyType, r.area, r.units, r.location,
        (r.services ?? []).join("; "), r.style, r.channel, r.utmCampaign, r.utmSource, r.utmMedium, r.utmContent, r.source, r.status, r.priority,
        r.assignedTo ? nameOf.get(r.assignedTo) ?? "" : "", fmt(r.createdAt), fmt(r.firstResponseAt), fmt(r.resolvedAt),
        firstResponseSla(r, sla.firstResponseHours).state, resolutionSla(r, sla.resolveDays).state,
      ]);
  }

  const csv = toCsv(headers, data);
  const filename = `turnkii-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

// alias to avoid clashing with the Drizzle `Request` type name in this file
type Request2 = globalThis.Request;
