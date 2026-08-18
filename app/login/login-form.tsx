"use client";
import { useActionState } from "react";
import { login, type LoginState } from "@/lib/auth/actions";

const DEMO = [
  ["Admin", "admin@turnkii.test"],
  ["Product manager", "pm@turnkii.test"],
  ["Operations manager", "ops@turnkii.test"],
  ["Sales / field agent", "sara@turnkii.test"],
  ["Content editor", "content@turnkii.test"],
];

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});

  return (
    <div className="w-full max-w-sm">
      <form action={action} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Email</span>
          <input
            name="email"
            type="email"
            autoComplete="username"
            defaultValue="admin@turnkii.test"
            required
            className="rounded-xl border border-line bg-paper px-4 py-3 text-[15px] outline-none focus:border-ink"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-bold uppercase tracking-wider text-muted">Password</span>
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            defaultValue="turnkii1234"
            required
            className="rounded-xl border border-line bg-paper px-4 py-3 text-[15px] outline-none focus:border-ink"
          />
        </label>

        {state.error && (
          <p className="rounded-lg bg-crit/10 px-3 py-2 text-sm font-medium text-crit">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="mt-1 rounded-full bg-ink px-6 py-3 text-[15px] font-bold text-cream transition-colors hover:bg-lime hover:text-ink disabled:opacity-60"
        >
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-line bg-sand/60 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-muted">Demo accounts</p>
        <p className="mt-1 text-xs text-sub">
          Password <code className="rounded bg-paper px-1.5 py-0.5 font-mono">turnkii1234</code> for all. Click to fill.
        </p>
        <div className="mt-3 flex flex-col gap-1">
          {DEMO.map(([role, email]) => (
            <button
              key={email}
              type="button"
              onClick={() => {
                const el = document.querySelector<HTMLInputElement>('input[name="email"]');
                if (el) el.value = email;
              }}
              className="flex items-center justify-between rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-paper"
            >
              <span className="font-semibold text-ink">{role}</span>
              <span className="font-mono text-xs text-muted">{email}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
