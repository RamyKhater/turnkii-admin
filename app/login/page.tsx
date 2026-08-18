import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { homeSectionFor } from "@/lib/auth/rbac";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(homeSectionFor(user.role));

  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="flex flex-col justify-between bg-ink p-8 text-cream lg:p-12">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime font-serif text-lg font-bold text-ink">t</span>
          <span className="text-lg font-bold tracking-tight">Turnkii</span>
          <span className="ml-1 rounded-full border border-cream/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-cream/70">Admin</span>
        </div>
        <div className="hidden lg:block">
          <h1 className="max-w-[18ch] font-serif text-5xl leading-[1.02]">
            Run the pipeline from brief to <span className="italic text-lime">handover</span>.
          </h1>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-cream/60">
            Manage incoming requests, track team performance, and keep the site&apos;s
            styles, marketplace and copy up to date — with role-based access.
          </p>
        </div>
        <p className="text-xs text-cream/40">© Turnkii — internal use only</p>
      </section>

      <section className="flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-sm">
          <h2 className="font-serif text-3xl">Sign in</h2>
          <p className="mt-1 text-sm text-sub">Welcome back. Enter your details to continue.</p>
          <div className="mt-6">
            <LoginForm />
          </div>
          <p className="mt-6 border-t border-line pt-4 text-sm text-sub">
            Are you a property owner?{" "}
            <a href="/portal/login" className="font-bold text-olive hover:text-ink">Sign in to your portal →</a>
          </p>
        </div>
      </section>
    </main>
  );
}
