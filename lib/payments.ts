import type { Payment } from "@/lib/db/schema";

const DAY = 86_400_000;

export function fmtEGP(n: number | null | undefined): string {
  const v = Math.round(Number(n ?? 0));
  return "EGP " + v.toLocaleString("en-US");
}

export type PaymentState = "paid" | "pending" | "overdue" | "due" | "void";

/** Derived state + days until due (negative = days overdue). */
export function paymentState(p: Pick<Payment, "status" | "dueDate">): { state: PaymentState; daysTillDue: number | null } {
  const daysTillDue = p.dueDate ? Math.ceil((new Date(p.dueDate).getTime() - Date.now()) / DAY) : null;
  if (p.status === "paid") return { state: "paid", daysTillDue };
  if (p.status === "void") return { state: "void", daysTillDue };
  if (p.status === "pending") return { state: "pending", daysTillDue };
  // status === "due"
  if (p.dueDate && new Date(p.dueDate).getTime() < Date.now()) return { state: "overdue", daysTillDue };
  return { state: "due", daysTillDue };
}

export const PAYMENT_STATE_META: Record<PaymentState, { label: string; chip: string; dot: string }> = {
  paid: { label: "Paid", chip: "bg-ok/12 text-ok", dot: "bg-ok" },
  pending: { label: "Pending verification", chip: "bg-info/10 text-info", dot: "bg-info" },
  due: { label: "Due", chip: "bg-sand text-sub", dot: "bg-muted" },
  overdue: { label: "Overdue", chip: "bg-crit/10 text-crit", dot: "bg-crit" },
  void: { label: "Void", chip: "bg-sand text-muted line-through", dot: "bg-line" },
};

export const KIND_LABEL: Record<string, string> = {
  downpayment: "Down payment", milestone: "Milestone", installment: "Installment",
  final: "Final payment", service: "Service", other: "Other",
};

export type MoneySummary = {
  contractValue: number; scheduled: number; collected: number;
  pending: number; outstanding: number; overdue: number;
  nextDue: { dueDate: Date | null; amount: number; daysTillDue: number | null } | null;
  progress: number; // 0-100
};

export function summarize(payments: Payment[], contractValue = 0): MoneySummary {
  const live = payments.filter((p) => p.status !== "void");
  const scheduled = live.reduce((a, p) => a + p.amount, 0);
  const collected = live.filter((p) => p.status === "paid").reduce((a, p) => a + p.amount, 0);
  const pending = live.filter((p) => p.status === "pending").reduce((a, p) => a + p.amount, 0);
  const overdue = live.filter((p) => paymentState(p).state === "overdue").reduce((a, p) => a + p.amount, 0);
  const contract = contractValue || scheduled;
  const outstanding = Math.max(0, contract - collected);

  const upcoming = live
    .filter((p) => p.status !== "paid" && p.dueDate)
    .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())[0];
  const nextDue = upcoming
    ? { dueDate: upcoming.dueDate, amount: upcoming.amount, daysTillDue: paymentState(upcoming).daysTillDue }
    : null;

  return {
    contractValue: contract, scheduled, collected, pending, outstanding, overdue,
    nextDue, progress: contract ? Math.round((collected / contract) * 100) : 0,
  };
}
