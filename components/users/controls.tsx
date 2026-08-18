"use client";
import { useTransition, useActionState } from "react";
import { setRole, setActive, createUser, type CreateUserState } from "@/lib/users/actions";
import { ROLES } from "@/lib/auth/rbac";
import type { Role } from "@/lib/db/schema";

export function RoleSelect({ id, role, disabled }: { id: number; role: Role; disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <select
      value={role}
      disabled={disabled || pending}
      onChange={(e) => start(() => setRole(id, e.target.value as Role))}
      className="rounded-full border border-line bg-paper px-3 py-1.5 text-sm font-semibold outline-none focus:border-ink disabled:opacity-50"
    >
      {ROLES.map((r) => (
        <option key={r.value} value={r.value}>{r.label}</option>
      ))}
    </select>
  );
}

export function ActiveToggle({ id, active, disabled }: { id: number; active: boolean; disabled?: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      onClick={() => start(() => setActive(id, !active))}
      disabled={disabled || pending}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold transition-colors disabled:opacity-40 ${
        active ? "bg-ok/12 text-ok hover:bg-ok/20" : "bg-crit/10 text-crit hover:bg-crit/20"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-ok" : "bg-crit"}`} />
      {active ? "Active" : "Disabled"}
    </button>
  );
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState<CreateUserState, FormData>(createUser, {});
  return (
    <form action={action} className="grid gap-3 sm:grid-cols-2" key={state.ok ? Date.now() : "f"}>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">Name</span>
        <input name="name" required className="rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">Email</span>
        <input name="email" type="email" required className="rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">Role</span>
        <select name="role" defaultValue="agent" className="rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-ink">
          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">Temp password</span>
        <input name="password" type="text" required minLength={8} placeholder="min 8 characters" className="rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink" />
      </label>
      <div className="sm:col-span-2 flex items-center gap-3">
        <button type="submit" disabled={pending} className="rounded-full bg-ink px-6 py-2.5 text-sm font-bold text-cream hover:bg-lime hover:text-ink disabled:opacity-60">
          {pending ? "Creating…" : "Create user"}
        </button>
        {state.error && <span className="text-sm font-medium text-crit">{state.error}</span>}
        {state.ok && <span className="text-sm font-medium text-ok">User created.</span>}
      </div>
    </form>
  );
}
