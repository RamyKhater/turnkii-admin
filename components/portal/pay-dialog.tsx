"use client";
import { useState, useActionState } from "react";
import { submitOwnerReceipt, type ReceiptState } from "@/lib/owner/actions";
import { ImageField } from "@/components/content/image-field";
import { fmtEGP } from "@/lib/payments";
import type { Payment } from "@/lib/db/schema";

const input = "rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink";
const lbl = "text-xs font-bold uppercase tracking-wider text-muted";

function Dialog({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const [state, action, pending] = useActionState<ReceiptState, FormData>(submitOwnerReceipt, {});
  if (state.ok) onClose();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl border border-line bg-paper p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-serif text-2xl">Submit your payment</h3>
        <p className="mt-1 text-sm text-sub">{payment.label} · <span className="font-bold text-ink">{fmtEGP(payment.amount)}</span></p>
        <div className="mt-3 rounded-xl bg-sand/60 p-3 text-xs text-sub">
          Make the bank transfer to <strong className="text-ink">Turnkii Ltd · NBE ****9920</strong>, then attach the receipt below. We&apos;ll verify it and mark this paid.
        </div>
        <form action={action} className="mt-4 flex flex-col gap-3">
          <input type="hidden" name="id" value={payment.id} />
          <label className="flex flex-col gap-1.5"><span className={lbl}>Transfer reference (optional)</span><input name="reference" placeholder="Bank reference / TRX no." className={input} /></label>
          <ImageField name="receiptUrl" label="Bank transfer receipt" />
          <label className="flex flex-col gap-1.5"><span className={lbl}>Note (optional)</span><input name="note" className={input} /></label>
          {state.error && <p className="text-sm font-medium text-crit">{state.error}</p>}
          <div className="mt-1 flex justify-end gap-2">
            <button type="button" onClick={onClose} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink">Cancel</button>
            <button type="submit" disabled={pending} className="rounded-full bg-ink px-5 py-2 text-sm font-bold text-cream hover:bg-lime hover:text-ink disabled:opacity-60">
              {pending ? "Submitting…" : "Submit receipt"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PayButton({ payment }: { payment: Payment }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-full bg-ink px-4 py-1.5 text-xs font-bold text-cream hover:bg-lime hover:text-ink">
        Pay now
      </button>
      {open && <Dialog payment={payment} onClose={() => setOpen(false)} />}
    </>
  );
}
