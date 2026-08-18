"use client";
import { useState, useTransition, useActionState } from "react";
import { recordPayment, verifyPayment, voidPayment, addPayment, type PayState } from "@/lib/payments/actions";
import { ImageField } from "@/components/content/image-field";
import { fmtEGP, PAYMENT_STATE_META, paymentState, type PaymentState } from "@/lib/payments";
import type { Payment } from "@/lib/db/schema";

const input = "rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink";
const lbl = "text-xs font-bold uppercase tracking-wider text-muted";

function RecordDialog({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const [state, action, pending] = useActionState<PayState, FormData>(recordPayment, {});
  if (state.ok) onClose();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-line bg-paper p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-2xl">Record payment</h3>
        <p className="mt-1 text-sm text-sub">{payment.label} · {fmtEGP(payment.amount)}</p>
        <form action={action} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="id" value={payment.id} />
          <label className="flex flex-col gap-1.5">
            <span className={lbl}>Outcome</span>
            <select name="mode" defaultValue="paid" className={input + " font-semibold"}>
              <option value="paid">Mark as paid (verified)</option>
              <option value="pending">Log receipt · awaiting verification</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="flex flex-col gap-1.5">
              <span className={lbl}>Method</span>
              <select name="method" defaultValue="bank_transfer" className={input + " font-semibold"}>
                <option value="bank_transfer">Bank transfer</option><option value="cash">Cash</option>
                <option value="card">Card</option><option value="cheque">Cheque</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5"><span className={lbl}>Reference</span><input name="reference" placeholder="TRX-…" className={input} /></label>
          </div>
          <ImageField name="receiptUrl" label="Bank transfer receipt" defaultValue={payment.receiptUrl} />
          <label className="flex flex-col gap-1.5"><span className={lbl}>Note</span><input name="note" className={input} /></label>
          {state.error && <p className="text-sm font-medium text-crit">{state.error}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-full bg-ink px-5 py-2 text-sm font-bold text-cream hover:bg-lime hover:text-ink disabled:opacity-60">
              {pending ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PaymentActions({ payment }: { payment: Payment }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const { state } = paymentState(payment);

  return (
    <div className="flex items-center justify-end gap-2">
      {payment.receiptUrl && (
        <a href={payment.receiptUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-olive hover:text-ink" title="View receipt">Receipt</a>
      )}
      {state === "pending" && (
        <button onClick={() => start(() => verifyPayment(payment.id))} disabled={pending}
          className="rounded-full bg-ok/12 px-3 py-1.5 text-xs font-bold text-ok hover:bg-ok/20 disabled:opacity-50">Verify</button>
      )}
      {state !== "paid" && state !== "void" && (
        <button onClick={() => setOpen(true)} className="rounded-full bg-ink px-3 py-1.5 text-xs font-bold text-cream hover:bg-lime hover:text-ink">Record</button>
      )}
      {state !== "paid" && state !== "void" && (
        <button onClick={() => { if (confirm("Void this payment?")) start(() => voidPayment(payment.id)); }} disabled={pending}
          className="text-xs font-bold text-muted hover:text-crit disabled:opacity-50">Void</button>
      )}
      {open && <RecordDialog payment={payment} onClose={() => setOpen(false)} />}
    </div>
  );
}

export function PaymentStateBadge({ payment }: { payment: Pick<Payment, "status" | "dueDate"> }) {
  const { state, daysTillDue } = paymentState(payment);
  const m = PAYMENT_STATE_META[state];
  const suffix =
    state === "overdue" && daysTillDue != null ? ` · ${Math.abs(daysTillDue)}d over`
      : state === "due" && daysTillDue != null ? ` · in ${daysTillDue}d` : "";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${m.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}{suffix}
    </span>
  );
}

export function AddPaymentForm({ projectId }: { projectId: number }) {
  const [state, action, pending] = useActionState<PayState, FormData>(addPayment, {});
  return (
    <form action={action} key={state.ok ? Date.now() : "f"} className="flex flex-wrap items-end gap-3">
      <input type="hidden" name="projectId" value={projectId} />
      <label className="flex flex-col gap-1.5">
        <span className={lbl}>Kind</span>
        <select name="kind" defaultValue="milestone" className={input + " font-semibold"}>
          <option value="downpayment">Down payment</option><option value="milestone">Milestone</option>
          <option value="installment">Installment</option><option value="final">Final</option>
          <option value="service">Service</option><option value="other">Other</option>
        </select>
      </label>
      <label className="flex flex-1 flex-col gap-1.5"><span className={lbl}>Label</span><input name="label" required placeholder="e.g. Milestone 3 — joinery" className={input} /></label>
      <label className="flex flex-col gap-1.5"><span className={lbl}>Amount (EGP)</span><input name="amount" type="number" required className={input + " w-36"} /></label>
      <label className="flex flex-col gap-1.5"><span className={lbl}>Due date</span><input name="dueDate" type="date" className={input} /></label>
      <button type="submit" disabled={pending} className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-cream hover:bg-lime hover:text-ink disabled:opacity-60">Add</button>
      {state.error && <span className="w-full text-sm font-medium text-crit">{state.error}</span>}
    </form>
  );
}
