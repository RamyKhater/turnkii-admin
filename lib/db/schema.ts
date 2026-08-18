import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  pgEnum,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", [
  "admin",
  "product_manager",
  "ops_manager",
  "agent",
  "content_editor",
]);

export const requestStatusEnum = pgEnum("request_status", [
  "new",
  "contacted",
  "survey_booked",
  "scoped",
  "quoted",
  "won",
  "lost",
]);

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("agent"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const requests = pgTable("requests", {
  id: serial("id").primaryKey(),
  ref: text("ref").notNull().unique(),
  contactName: text("contact_name"),
  phone: text("phone"),
  email: text("email"),
  propertyType: text("property_type"),
  area: integer("area"),
  units: integer("units"),
  location: text("location"),
  services: jsonb("services").$type<string[]>().notNull().default([]),
  style: text("style"),
  kitchen: text("kitchen"),
  hvac: text("hvac"),
  budgetPlan: text("budget_plan"),
  message: text("message"),
  status: requestStatusEnum("status").notNull().default("new"),
  priority: text("priority").notNull().default("normal"), // low | normal | high
  assignedTo: integer("assigned_to").references(() => users.id, {
    onDelete: "set null",
  }),
  propertyId: integer("property_id"),
  source: text("source").notNull().default("website"), // submission origin: website | phone | manual
  channel: text("channel").notNull().default("Direct"), // acquisition / traffic source
  referrer: text("referrer"),
  firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const services = pgTable("services", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  short: text("short"),
  description: text("description"),
  lead: text("lead"),
  priceFrom: text("price_from"),
  image: text("image"),
  published: boolean("published").notNull().default(true),
  enabled: boolean("enabled").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const properties = pgTable("properties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: integer("owner_id"),
  ownerName: text("owner_name"),
  ownerPhone: text("owner_phone"),
  ownerEmail: text("owner_email"),
  type: text("type"),
  location: text("location"),
  area: integer("area"),
  units: integer("units"),
  style: text("style"),
  status: text("status").notNull().default("active"), // active | in_progress | handed_over | on_hold
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const owners = pgTable("owners", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  phone: text("phone"),
  passwordHash: text("password_hash").notNull(),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const ownerSessions = pgTable("owner_sessions", {
  id: text("id").primaryKey(),
  ownerId: integer("owner_id").notNull().references(() => owners.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  propertyId: integer("property_id").references(() => properties.id, { onDelete: "set null" }),
  ownerId: integer("owner_id").references(() => owners.id, { onDelete: "set null" }),
  ownerName: text("owner_name"),
  ownerPhone: text("owner_phone"),
  ownerEmail: text("owner_email"),
  style: text("style"),
  services: jsonb("services").$type<string[]>().notNull().default([]),
  contractValue: integer("contract_value").notNull().default(0), // EGP
  status: text("status").notNull().default("active"), // active | on_hold | complete
  startDate: timestamp("start_date", { withTimezone: true }),
  dueDate: timestamp("due_date", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").references(() => projects.id, { onDelete: "cascade" }),
  propertyId: integer("property_id").references(() => properties.id, { onDelete: "set null" }),
  kind: text("kind").notNull().default("milestone"), // downpayment | milestone | installment | final | service | other
  label: text("label").notNull(),
  amount: integer("amount").notNull().default(0), // EGP
  dueDate: timestamp("due_date", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  status: text("status").notNull().default("due"), // due | pending | paid | void
  method: text("method"), // bank_transfer | cash | card | cheque
  reference: text("reference"),
  receiptUrl: text("receipt_url"), // proof of payment (bank transfer receipt)
  note: text("note"),
  recordedBy: integer("recorded_by").references(() => users.id, { onDelete: "set null" }),
  verifiedBy: integer("verified_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const projectUpdates = pgTable("project_updates", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  body: text("body"),
  kind: text("kind").notNull().default("progress"), // progress | milestone | photo | note
  image: text("image"),
  visibleToOwner: boolean("visible_to_owner").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notifications = pgTable("notifications", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // request.new | request.assigned | sla.breach | ...
  title: text("title").notNull(),
  body: text("body"),
  entity: text("entity"),
  entityId: text("entity_id"),
  href: text("href"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const siteSettings = pgTable("site_settings", {
  key: text("key").primaryKey(),
  label: text("label").notNull(),
  group: text("group").notNull().default("general"), // vertical | sla | general
  enabled: boolean("enabled").notNull().default(true),
  value: jsonb("value").$type<unknown>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const requestNotes = pgTable("request_notes", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id")
    .notNull()
    .references(() => requests.id, { onDelete: "cascade" }),
  authorId: integer("author_id").references(() => users.id, {
    onDelete: "set null",
  }),
  kind: text("kind").notNull().default("note"), // note | call | survey | status
  body: text("body").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const styles = pgTable("styles", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  blurb: text("blurb"),
  fromPrice: text("from_price"),
  leadTime: text("lead_time"),
  pieceCount: text("piece_count"),
  heroImage: text("hero_image"),
  palette: jsonb("palette").$type<{ name: string; hex: string }[]>().default([]),
  materials: jsonb("materials").$type<unknown[]>().default([]),
  furniture: jsonb("furniture").$type<unknown[]>().default([]),
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category"),
  spec: text("spec"),
  price: text("price"),
  stock: text("stock"),
  image: text("image"),
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const inspirationShots = pgTable("inspiration_shots", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(), // style key
  room: text("room"),
  title: text("title"),
  spec: text("spec"),
  image: text("image"),
  published: boolean("published").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const contentBlocks = pgTable("content_blocks", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  value: jsonb("value").$type<unknown>(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const activityLog = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  entity: text("entity"),
  entityId: text("entity_id"),
  meta: jsonb("meta").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type Request = typeof requests.$inferSelect;
export type RequestNote = typeof requestNotes.$inferSelect;
export type Style = typeof styles.$inferSelect;
export type Product = typeof products.$inferSelect;
export type InspirationShot = typeof inspirationShots.$inferSelect;
export type ContentBlock = typeof contentBlocks.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Property = typeof properties.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Payment = typeof payments.$inferSelect;
export type ProjectUpdate = typeof projectUpdates.$inferSelect;
export type Owner = typeof owners.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type SiteSetting = typeof siteSettings.$inferSelect;
export type Role = User["role"];
export type RequestStatus = Request["status"];
