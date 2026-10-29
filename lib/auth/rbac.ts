import type { Role } from "@/lib/db/schema";

export const ROLES: { value: Role; label: string; blurb: string }[] = [
  { value: "admin", label: "Admin", blurb: "Full access to everything, including users and settings." },
  { value: "product_manager", label: "Product manager", blurb: "Performance analytics and all site content." },
  { value: "ops_manager", label: "Operations manager", blurb: "Assign and manage all requests; track the team." },
  { value: "project_manager", label: "Project manager", blurb: "Run live projects — updates, record payments and handover; no settings or users." },
  { value: "finance", label: "Finance", blurb: "Verify and clear client payments, and reconcile the money. Cannot clear a payment they recorded." },
  { value: "agent", label: "Sales / field agent", blurb: "Own assigned requests; log calls, surveys and notes." },
  { value: "content_editor", label: "Content editor", blurb: "Edit site content — styles, marketplace, copy, inspiration." },
];

export const ROLE_LABEL: Record<Role, string> = Object.fromEntries(
  ROLES.map((r) => [r.value, r.label]),
) as Record<Role, string>;

// Capabilities are the unit of authorization. Enforced server-side.
export type Capability =
  | "requests:view_all"
  | "requests:view_assigned"
  | "requests:create"
  | "requests:assign"
  | "requests:update"
  | "requests:delete"
  | "requests:note"
  | "analytics:view"
  | "content:edit"
  | "properties:view"
  | "properties:edit"
  | "payments:view"
  | "payments:manage"
  | "payments:record"  // raise a payment / log a receipt (pending)
  | "payments:verify"  // clear/verify a payment to paid — separation of duties
  | "projects:manage"
  | "estimates:request"  // kick off a costed-estimate request to FLPP
  | "estimates:signoff"  // approve the confirmed estimate before the client sees it
  | "pricing:manage"
  | "proposals:manage"
  | "showcases:manage"
  | "tasks:manage"
  | "settings:manage"
  | "users:manage";

const MATRIX: Record<Role, Capability[]> = {
  admin: [
    "requests:view_all", "requests:create", "requests:assign", "requests:update",
    "requests:delete", "requests:note", "analytics:view", "content:edit",
    "properties:view", "properties:edit", "payments:view", "payments:manage", "payments:record", "payments:verify",
    "projects:manage", "estimates:request", "estimates:signoff", "pricing:manage", "proposals:manage", "showcases:manage", "tasks:manage",
    "settings:manage", "users:manage",
  ],
  product_manager: ["requests:view_all", "analytics:view", "content:edit", "properties:view", "payments:view", "pricing:manage", "showcases:manage", "tasks:manage"],
  ops_manager: [
    "requests:view_all", "requests:create", "requests:assign", "requests:update",
    "requests:note", "analytics:view", "properties:view", "properties:edit",
    "payments:view", "payments:manage", "payments:record", "projects:manage", "estimates:request", "proposals:manage", "showcases:manage", "tasks:manage",
  ],
  project_manager: [
    "requests:view_all", "requests:update", "requests:note", "analytics:view",
    "properties:view", "payments:view", "payments:manage", "payments:record", "projects:manage",
    "estimates:request", "estimates:signoff", "proposals:manage", "showcases:manage", "tasks:manage",
  ],
  finance: [
    "requests:view_all", "analytics:view", "properties:view",
    "payments:view", "payments:record", "payments:verify", "estimates:signoff",
  ],
  agent: ["requests:view_assigned", "requests:update", "requests:note", "proposals:manage", "showcases:manage"],
  content_editor: ["content:edit"],
};

export function can(role: Role, cap: Capability): boolean {
  return MATRIX[role]?.includes(cap) ?? false;
}

/** Whether a role can reach a given section of the app at all. */
export type Section =
  | "dashboard" | "requests" | "properties" | "projects" | "pricing" | "payments"
  | "proposals" | "showcases" | "projectShowcases" | "tasks" | "content" | "customers" | "users" | "settings";

export function canAccessSection(role: Role, section: Section): boolean {
  switch (section) {
    case "dashboard":
      return can(role, "analytics:view") || can(role, "requests:view_assigned");
    case "requests":
      return can(role, "requests:view_all") || can(role, "requests:view_assigned");
    case "properties":
      return can(role, "properties:view");
    case "projects":
      return can(role, "projects:manage") || can(role, "payments:view") || can(role, "properties:view");
    case "pricing":
      return can(role, "pricing:manage");
    case "proposals":
      return can(role, "proposals:manage");
    case "showcases":
      return can(role, "showcases:manage");
    case "projectShowcases":
      return can(role, "showcases:manage");
    case "tasks":
      return true; // everyone has a personal "my tasks" view; managers manage all
    case "payments":
      return can(role, "payments:view");
    case "content":
      return can(role, "content:edit");
    case "customers":
      // Customer accounts + their requests/projects/payments — managers & admin.
      return can(role, "requests:view_all") || can(role, "payments:view");
    case "users":
      return can(role, "users:manage");
    case "settings":
      return can(role, "settings:manage");
  }
}

/** First landing section for a role after login. */
export function homeSectionFor(role: Role): string {
  if (canAccessSection(role, "dashboard")) return "/dashboard";
  if (canAccessSection(role, "requests")) return "/requests";
  if (canAccessSection(role, "payments")) return "/payments";
  if (canAccessSection(role, "content")) return "/content";
  if (canAccessSection(role, "properties")) return "/properties";
  if (canAccessSection(role, "settings")) return "/settings";
  if (canAccessSection(role, "users")) return "/users";
  return "/dashboard";
}
