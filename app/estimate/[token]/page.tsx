import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { estimates } from "@/lib/db/schema";
import { getEstimateConfig } from "@/lib/estimate/store";
import { assembleEstimate } from "@/lib/estimate/engine";
import { TIER_LABEL, type EstimateTier } from "@/lib/estimate/rates";

export const dynamic = "force-dynamic";

const egp = (n: number) => "EGP " + Math.round(n).toLocaleString("en-US");

export default async function CustomerEstimate({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const db = await getDb();
  const [e] = await db.select().from(estimates).where(eq(estimates.token, token)).limit(1);
  if (!e || e.status !== "published" || !e.confirmedQuotation) notFound();

  const { finance, scope } = await getEstimateConfig();
  const out = assembleEstimate(e.confirmedQuotation, finance, scope);
  const brief = (e.brief ?? {}) as { client?: string; contactName?: string; location?: string };
  const client = brief.client || brief.contactName || "";
  const methodLabel = finance.method === "reducing" ? "reducing balance" : "flat rate";
  const sel = out.selected;
  const worksMonths = out.worksDurationMonths;

  return (
    <main>
      <style>{`
        :root{--bg:#F7F6F1;--surface:#FFFFFF;--fg:#14140F;--muted:#6B6C60;--line:#E3E1D6;--accent:#C8D92B;--ink:#000;--chip:#EEF0D8}
        @media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#111209;--surface:#1A1B12;--fg:#F2F1E6;--muted:#A3A392;--line:#2C2D20;--accent:#DDF344;--ink:#F2F1E6;--chip:#24261a;color-scheme:dark}}
        .ewrap{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--fg);background:var(--bg);line-height:1.55}
        .ewrap *{box-sizing:border-box}
        .einner{max-width:920px;margin:0 auto;padding-left:max(18px,env(safe-area-inset-left,0px));padding-right:max(18px,env(safe-area-inset-right,0px))}
        .ehero{padding-block:46px 30px;border-bottom:3px solid var(--ink)}
        .ekick{font-size:11px;letter-spacing:.16em;text-transform:uppercase;font-weight:800;color:var(--muted)}
        .ebig{font-size:clamp(30px,6vw,52px);font-weight:800;letter-spacing:-.02em;margin:10px 0 2px;font-variant-numeric:tabular-nums}
        .esec{padding-block:32px;border-bottom:1px solid var(--line)}
        .eh2{font-size:clamp(18px,3.4vw,24px);font-weight:800;letter-spacing:-.01em;margin:0 0 4px}
        .esub{color:var(--muted);font-size:14px;margin:0 0 16px;max-width:64ch}
        .escroll{overflow-x:auto;border:1px solid var(--line);border-radius:12px;background:var(--surface)}
        table{border-collapse:collapse;width:100%;min-width:540px;font-size:13.5px;font-variant-numeric:tabular-nums}
        th,td{padding:9px 12px;text-align:right;border-bottom:1px solid var(--line);white-space:nowrap}
        th:first-child,td:first-child{text-align:left}
        thead th{background:var(--chip);font-size:11px;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
        tbody tr:last-child td{border-bottom:0}
        tr.sel td{background:var(--chip);font-weight:800}
        .ecards{display:grid;gap:13px;grid-template-columns:repeat(3,1fr)}
        @media(max-width:620px){.ecards{grid-template-columns:1fr}}
        .ecard{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:17px}
        .ecard .k{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);font-weight:700}
        .ecard .v{font-size:22px;font-weight:800;margin-top:6px;font-variant-numeric:tabular-nums}
        .ecard .n{color:var(--muted);font-size:12.5px;margin-top:5px}
        .epill{display:inline-block;background:var(--accent);color:#141406;font-weight:800;font-size:12px;padding:4px 11px;border-radius:999px}
        .efoot{padding-block:26px 50px;color:var(--muted);font-size:12.5px}
      `}</style>
      <div className="ewrap">
        <div className="einner">
          <header className="ehero">
            <span className="epill">Your estimate</span>
            <div className="ebig">{egp(e.confirmedQuotation)}</div>
            <p className="esub" style={{ marginTop: 6 }}>
              {client ? `${client} · ` : ""}{brief.location ? `${brief.location} · ` : ""}Reference {e.ref}
              {e.tier ? ` · ${TIER_LABEL[e.tier as EstimateTier] ?? e.tier} specification` : ""}.
              A full finish &amp; furnish, costed against our current rate card and delivered through milestone sign-offs.
            </p>
          </header>

          <section className="esec">
            <h2 className="eh2">Payment options</h2>
            <p className="esub">Choose a down payment and term. Monthly installment, {methodLabel}. All money sits in escrow and is released to the works only on your sign-off.</p>
            <div className="escroll">
              <table>
                <thead><tr><th>Down payment</th><th>Amount</th>{finance.tenorOptions.map((t) => <th key={t}>{t} months</th>)}</tr></thead>
                <tbody>
                  {finance.downOptions.map((d) => (
                    <tr key={d} className={d === finance.selectedDownPct ? "sel" : ""}>
                      <td>{Math.round(d * 100)}%</td>
                      <td>{egp(e.confirmedQuotation! * d)}</td>
                      {finance.tenorOptions.map((t) => {
                        const sc = out.scenarios.find((x) => x.downPct === d && x.tenor === t)!;
                        return <td key={t}>{egp(sc.monthly)}<span style={{ color: "var(--muted)", fontSize: 11 }}>/mo</span></td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="esec">
            <h2 className="eh2">A closer look · {Math.round(sel.downPct * 100)}% down over {sel.tenor} months</h2>
            <div className="ecards">
              <div className="ecard"><div className="k">Down payment</div><div className="v">{egp(sel.downPayment)}</div><div className="n">Funds the first works · {out.fundingByDown.find((f) => f.downPct === sel.downPct)?.fundsLabel}</div></div>
              <div className="ecard"><div className="k">Monthly installment</div><div className="v">{egp(sel.monthly)}</div><div className="n">{sel.tenor} payments · {methodLabel}</div></div>
              <div className="ecard"><div className="k">Total over the plan</div><div className="v">{egp(sel.totalCost)}</div><div className="n">Cash price plus {Math.round(sel.costAboveCash * 100)}% financing cost</div></div>
            </div>
            <p className="esub" style={{ marginTop: 14 }}>Indicative income to qualify at this installment: {egp(sel.minIncome)} / month. Rates and terms are confirmed with our finance partner before you sign.</p>
          </section>

          <section className="esec">
            <h2 className="eh2">Scope &amp; timeline</h2>
            <p className="esub">What's included and when. Works run about {worksMonths} months ({out.totalWeeks} weeks); each package is released from escrow as it's signed off.</p>
            <div className="escroll">
              <table>
                <thead><tr><th>Work package</th><th>Value</th><th>Start</th><th>Weeks</th></tr></thead>
                <tbody>
                  {out.scope.map((l) => (
                    <tr key={l.index}><td>{l.name}<div style={{ color: "var(--muted)", fontSize: 11, whiteSpace: "normal" }}>{l.scope}</div></td><td>{egp(l.value)}</td><td>wk {l.startWeek}</td><td>{l.durationWeeks}</td></tr>
                  ))}
                  <tr className="sel"><td>Total</td><td>{egp(e.confirmedQuotation)}</td><td></td><td>{out.totalWeeks} wks</td></tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="esec">
            <h2 className="eh2">How your money is protected</h2>
            <p className="esub">Your down payment and the financed amount sit in escrow. We release funds to the works only as each milestone is signed off by you — so payments always track real progress. At {Math.round(sel.downPct * 100)}% down, your down payment funds {out.fundingByDown.find((f) => f.downPct === sel.downPct)?.fundsLabel ?? "the first works"}, and financing covers {egp(sel.financed)} across the remaining packages. Your installments continue after handover until the plan completes.</p>
          </section>

          <div className="einner efoot" style={{ paddingLeft: 0, paddingRight: 0 }}>
            Turnkii — turnkey home finishing, furniture &amp; handover. This estimate is valid for 30 days and fixed once you sign. Figures shown are {methodLabel}; your finance partner confirms the final rate.
          </div>
        </div>
      </div>
    </main>
  );
}
