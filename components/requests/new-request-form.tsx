"use client";
import { useActionState } from "react";
import { createRequest, type CreateRequestState } from "@/lib/requests/actions";

export function NewRequestForm({
  owners,
  styles,
  services,
}: {
  owners: { id: number; name: string }[];
  styles: { key: string; name: string }[];
  services: { key: string; name: string }[];
}) {
  const [state, action, pending] = useActionState<CreateRequestState, FormData>(createRequest, {});
  const input = "rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink";
  const lbl = "text-xs font-bold uppercase tracking-wider text-muted";

  return (
    <form action={action} className="space-y-5">
      <div className="rounded-2xl border border-line bg-paper p-6">
        <h2 className="text-sm font-bold">Contact</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5"><span className={lbl}>Name *</span><input name="contactName" required className={input} /></label>
          <label className="flex flex-col gap-1.5"><span className={lbl}>Phone *</span><input name="phone" required className={input} /></label>
          <label className="flex flex-col gap-1.5 sm:col-span-2"><span className={lbl}>Email</span><input name="email" type="email" className={input} /></label>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-paper p-6">
        <h2 className="text-sm font-bold">Property</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5"><span className={lbl}>Type</span><input name="propertyType" placeholder="Apartment" className={input} /></label>
          <label className="flex flex-col gap-1.5"><span className={lbl}>Area m²</span><input name="area" type="number" className={input} /></label>
          <label className="flex flex-col gap-1.5"><span className={lbl}>Units</span><input name="units" type="number" defaultValue={1} className={input} /></label>
          <label className="flex flex-col gap-1.5 sm:col-span-2"><span className={lbl}>Location</span><input name="location" placeholder="City / compound" className={input} /></label>
          <label className="flex flex-col gap-1.5">
            <span className={lbl}>Style</span>
            <select name="style" className={input + " font-semibold"}>
              <option value="">—</option>
              {styles.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
            </select>
          </label>
        </div>
        <div className="mt-4">
          <span className={lbl}>Services</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {services.map((s) => (
              <label key={s.key} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-sm font-semibold hover:border-ink">
                <input type="checkbox" name="services" value={s.name} className="h-4 w-4 accent-ink" />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-paper p-6">
        <h2 className="text-sm font-bold">Handling</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className={lbl}>Priority</span>
            <select name="priority" defaultValue="normal" className={input + " font-semibold"}>
              <option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={lbl}>Assign to</span>
            <select name="assignedTo" className={input + " font-semibold"}>
              <option value="">Unassigned</option>
              {owners.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={lbl}>Financing</span>
            <select name="budgetPlan" className={input + " font-semibold"}>
              <option value="">—</option>
              <option>Milestone plan</option><option>Bank financing</option><option>Rent-backed</option><option>Save ahead</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={lbl}>Traffic source</span>
            <select name="channel" defaultValue="Direct" className={input + " font-semibold"}>
              {["Direct", "Organic search", "Paid search", "Paid social", "Organic social", "Referral", "Email", "WhatsApp", "Walk-in"].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 sm:col-span-3"><span className={lbl}>Notes</span><textarea name="message" rows={3} className={input} /></label>
        </div>
      </div>

      {state.error && <p className="text-sm font-medium text-crit">{state.error}</p>}
      <button type="submit" disabled={pending} className="rounded-full bg-ink px-6 py-3 text-sm font-bold text-cream hover:bg-lime hover:text-ink disabled:opacity-60">
        {pending ? "Creating…" : "Create request"}
      </button>
    </form>
  );
}
