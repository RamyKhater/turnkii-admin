"use client";
import { useActionState } from "react";
import { ownerLogin, type OwnerLoginState } from "@/lib/owner/actions";

export function OwnerLoginForm() {
  const [state, action, pending] = useActionState<OwnerLoginState, FormData>(ownerLogin, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">Email</span>
        <input name="email" type="email" autoComplete="username" defaultValue="ramy@example.com" required
          className="rounded-xl border border-line bg-paper px-4 py-3 text-[15px] outline-none focus:border-ink" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-bold uppercase tracking-wider text-muted">Password</span>
        <input name="password" type="password" autoComplete="current-password" defaultValue="owner1234" required
          className="rounded-xl border border-line bg-paper px-4 py-3 text-[15px] outline-none focus:border-ink" />
      </label>
      {state.error && <p className="rounded-lg bg-crit/10 px-3 py-2 text-sm font-medium text-crit">{state.error}</p>}
      <button type="submit" disabled={pending}
        className="mt-1 rounded-full bg-ink px-6 py-3 text-[15px] font-bold text-cream transition-colors hover:bg-lime hover:text-ink disabled:opacity-60">
        {pending ? "Signing in…" : "Sign in"}
      </button>
      <p className="mt-2 text-xs text-muted">Demo owner: <code className="rounded bg-sand px-1.5 py-0.5 font-mono">ramy@example.com</code> · password <code className="rounded bg-sand px-1.5 py-0.5 font-mono">owner1234</code></p>
    </form>
  );
}
