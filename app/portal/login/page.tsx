import { redirect } from "next/navigation";
import { getCurrentOwner } from "@/lib/owner/session";
import { OwnerLoginForm } from "@/components/portal/login-form";

export default async function OwnerLoginPage() {
  if (await getCurrentOwner()) redirect("/portal");
  return (
    <main className="grid min-h-dvh lg:grid-cols-2">
      <section className="flex flex-col justify-between bg-ink p-8 text-cream lg:p-12">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime font-serif text-lg font-bold text-ink">t</span>
          <span className="text-lg font-bold tracking-tight">Turnkii</span>
          <span className="ml-1 rounded-full border border-cream/20 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-cream/70">Owners</span>
        </div>
        <div className="hidden lg:block">
          <h1 className="max-w-[18ch] font-serif text-5xl leading-[1.02]">Your home, your <span className="italic text-lime">payments</span>, in one place.</h1>
          <p className="mt-5 max-w-[46ch] text-[15px] leading-relaxed text-cream/60">
            Track your project, see what&apos;s due, and settle payments by uploading your bank transfer receipt — we verify and keep you updated.
          </p>
        </div>
        <p className="text-xs text-cream/40">© Turnkii</p>
      </section>
      <section className="flex items-center justify-center p-8 lg:p-12">
        <div className="w-full max-w-sm">
          <h2 className="font-serif text-3xl">Owner sign in</h2>
          <p className="mt-1 text-sm text-sub">Welcome back. Access your properties and payments.</p>
          <div className="mt-6"><OwnerLoginForm /></div>
        </div>
      </section>
    </main>
  );
}
