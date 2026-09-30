"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { updateRequest } from "@/lib/requests/actions";

const field = "mt-1 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ink";
const lbl = "block text-xs font-bold uppercase tracking-wider text-muted";
const grp = "text-xs font-bold uppercase tracking-wider text-olive";

export type EditRequestData = {
  id: number;
  contactName: string | null; phone: string | null; email: string | null;
  location: string | null; propertyType: string | null; area: number | null; units: number | null;
  services: string[] | null; style: string | null; kitchen: string | null; hvac: string | null;
  budgetPlan: string | null; message: string | null; kind: string;
  monthlyIncome: number | null; financeAmount: number | null; employment: string | null;
};

function SaveBtn() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream hover:bg-ink/90 disabled:opacity-60">
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}

export function EditRequest({ req, styles }: { req: EditRequestData; styles: { key: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-2xl border border-line bg-paper">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-6 py-4 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-bold">Edit customer details &amp; requirement</span>
        <span className="text-lg leading-none text-muted">{open ? "–" : "+"}</span>
      </button>
      {open && (
        <form action={updateRequest} className="space-y-5 border-t border-line p-6">
          <input type="hidden" name="id" value={req.id} />

          <div>
            <h3 className={grp}>Customer</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block"><span className={lbl}>Name</span><input name="contactName" defaultValue={req.contactName ?? ""} className={field} /></label>
              <label className="block"><span className={lbl}>Phone</span><input name="phone" defaultValue={req.phone ?? ""} className={field} /></label>
              <label className="block"><span className={lbl}>Email</span><input name="email" type="email" defaultValue={req.email ?? ""} className={field} /></label>
              <label className="block"><span className={lbl}>Location</span><input name="location" defaultValue={req.location ?? ""} className={field} /></label>
              <label className="block"><span className={lbl}>Property type</span><input name="propertyType" defaultValue={req.propertyType ?? ""} className={field} /></label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block"><span className={lbl}>Area (m²)</span><input name="area" type="number" defaultValue={req.area ?? ""} className={field} /></label>
                <label className="block"><span className={lbl}>Units</span><input name="units" type="number" defaultValue={req.units ?? ""} className={field} /></label>
              </div>
            </div>
          </div>

          <div>
            <h3 className={grp}>Requirement</h3>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <label className="block"><span className={lbl}>Services</span><input name="services" defaultValue={(req.services ?? []).join(", ")} placeholder="Finishing, Furnishing, Kitchen…" className={field} /></label>
              <label className="block"><span className={lbl}>Style</span>
                <select name="style" defaultValue={req.style ?? ""} className={field}>
                  <option value="">—</option>
                  {styles.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
                </select>
              </label>
              <label className="block"><span className={lbl}>Kitchen</span><input name="kitchen" defaultValue={req.kitchen ?? ""} className={field} /></label>
              <label className="block"><span className={lbl}>HVAC</span><input name="hvac" defaultValue={req.hvac ?? ""} className={field} /></label>
              <label className="block sm:col-span-2"><span className={lbl}>Financing / budget plan</span><input name="budgetPlan" defaultValue={req.budgetPlan ?? ""} className={field} /></label>
            </div>
            <label className="mt-4 block"><span className={lbl}>Message / notes</span><textarea name="message" rows={3} defaultValue={req.message ?? ""} className={field} /></label>
          </div>

          {req.kind === "financing" && (
            <div>
              <h3 className={grp}>Financing</h3>
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <label className="block"><span className={lbl}>Monthly income (EGP)</span><input name="monthlyIncome" type="number" defaultValue={req.monthlyIncome ?? ""} className={field} /></label>
                <label className="block"><span className={lbl}>Finance amount (EGP)</span><input name="financeAmount" type="number" defaultValue={req.financeAmount ?? ""} className={field} /></label>
                <label className="block"><span className={lbl}>Employment</span><input name="employment" defaultValue={req.employment ?? ""} className={field} /></label>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <SaveBtn />
            <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold hover:border-ink">Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}
