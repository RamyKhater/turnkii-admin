/* Gold test: the estimate engine must reproduce the Owest villa financing
   workbook (quotation EGP 7,000,000) to the EGP. Pure functions, no DB.
   Run: npx tsx scripts/estimate-engine-test.ts */
import { FINANCE_DEFAULTS, computeScenario, monthlyInstallment, amortization } from "@/lib/estimate/finance";
import { SCOPE_DEFAULTS, scopeLines, monthlyExecuted, totalWeeks, fundingForDown } from "@/lib/estimate/scope";
import { escrowCashPlan, installmentSplit } from "@/lib/estimate/payment-plan";
import { assembleEstimate, autoCost } from "@/lib/estimate/engine";
import { ESTIMATE_RATES_DEFAULTS } from "@/lib/estimate/rates";

let pass = 0, fail = 0;
const near = (a: number, b: number, tol = 1) => Math.abs(a - b) <= tol;
const check = (label: string, cond: boolean, got?: unknown) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`); }
  else { fail++; console.log(`  ✗ ${label}${got !== undefined ? `  (got: ${JSON.stringify(got)})` : ""}`); }
};
const Q = 7_000_000;

console.log("\n1. Selected scenario — 20% down / 60 months / reducing balance");
const s = computeScenario(Q, 0.2, 60, FINANCE_DEFAULTS);
check("down payment 1,400,000", near(s.downPayment, 1_400_000), s.downPayment);
check("financed 5,600,000", near(s.financed, 5_600_000), s.financed);
check("monthly 142,203.19", near(s.monthly, 142_203.19, 0.5), s.monthly);
check("total interest 2,932,191.6", near(s.totalInterest, 2_932_191.6, 1), s.totalInterest);
check("total cost 9,932,191.6", near(s.totalCost, 9_932_191.6, 1), s.totalCost);
check("cost above cash +41.89%", near(s.costAboveCash, 0.4188845, 0.0001), s.costAboveCash);
check("min income 355,507.98", near(s.minIncome, 355_507.98, 0.5), s.minIncome);

console.log("\n2. Flat method — same scenario");
const flat = monthlyInstallment(5_600_000, 0.18, 60, "flat");
check("flat monthly 177,333.33", near(flat, 177_333.33, 0.5), flat);
check("flat total cost 12,040,000", near(1_400_000 + flat * 60, 12_040_000, 1), 1_400_000 + flat * 60);

console.log("\n3. Scenario matrix — reducing (spot checks)");
check("0% / 48 mo → 205,625", near(computeScenario(Q, 0, 48, FINANCE_DEFAULTS).monthly, 205_625, 0.5));
check("10% / 54 mo → 171,054", near(computeScenario(Q, 0.1, 54, FINANCE_DEFAULTS).monthly, 171_053.7, 0.5));
check("50% / 60 mo → 88,877", near(computeScenario(Q, 0.5, 60, FINANCE_DEFAULTS).monthly, 88_877, 0.5));

console.log("\n4. Amortization — row 1 (financed 5.6M, 60 mo, reducing)");
const a = amortization(5_600_000, 0.18, 60, "reducing");
check("opening 5,600,000", near(a[0].opening, 5_600_000), a[0].opening);
check("interest 84,000", near(a[0].interest, 84_000), a[0].interest);
check("principal 58,203.19", near(a[0].principal, 58_203.19, 0.5), a[0].principal);
check("closing 5,541,796.81", near(a[0].closing, 5_541_796.81, 1), a[0].closing);
check("60 rows, closes to ~0", a.length === 60 && near(a[59].closing, 0, 1), { n: a.length, last: a[59].closing });

console.log("\n5. Scope & timeline");
const lines = scopeLines(Q, SCOPE_DEFAULTS);
check("10 packages", lines.length === 10, lines.length);
check("MEP rough-in = 1,050,000, ends week 12", near(lines[2].value, 1_050_000) && lines[2].endWeek === 12, lines[2]);
check("programme runs 30 weeks", totalWeeks(lines) === 30, totalWeeks(lines));
check("package values sum to 7,000,000", near(lines.reduce((x, l) => x + l.value, 0), Q), lines.reduce((x, l) => x + l.value, 0));

console.log("\n6. Monthly works executed (released from escrow)");
const exec = monthlyExecuted(lines);
check("month 1 ≈ 580,416.67", near(exec[0], 580_416.67, 1), exec[0]);
check("month 7 ≈ 443,333.33", near(exec[6], 443_333.33, 1), exec[6]);
check("executes over 7 months, sums to 7,000,000", exec.length === 7 && near(exec.reduce((x, v) => x + v, 0), Q, 1), { n: exec.length, sum: exec.reduce((x, v) => x + v, 0) });

console.log("\n7. Payment plan — what each down payment funds");
const f20 = fundingForDown(lines, 1_400_000);
check("20% funds 'Packages 1–2 + 33% of package 3'", f20.fundsLabel === "Packages 1–2 + 33% of package 3", f20.fundsLabel);
check("20% works run to week 12", f20.runsToWeek === 12, f20.runsToWeek);
check("20% financing 'Packages 3–10', 5,600,000", f20.financingLabel === "Packages 3–10" && near(f20.financingAmount, 5_600_000), f20);
const f30 = fundingForDown(lines, 2_100_000);
check("30% funds 'Packages 1–3'", f30.fundsLabel === "Packages 1–3", f30.fundsLabel);
const f50 = fundingForDown(lines, 3_500_000);
check("50% funds 'Packages 1–4 + 50% of package 5'", f50.fundsLabel === "Packages 1–4 + 50% of package 5", f50.fundsLabel);
check("50% works run to week 20", f50.runsToWeek === 20, f50.runsToWeek);
check("0% funds nothing", fundingForDown(lines, 0).fundsLabel === "Nothing — all scope financed");

console.log("\n8. Escrow month-by-month cash plan (selected scenario)");
const plan = escrowCashPlan(s, exec, Q);
check("month 0 holds full 7,000,000 in escrow, pays 1,400,000 down", near(plan[0].escrowBalance, Q) && near(plan[0].downPayment, 1_400_000), plan[0]);
check("month 1 escrow 6,419,583.33", near(plan[1].escrowBalance, 6_419_583.33, 1), plan[1].escrowBalance);
check("month 7 is handover, escrow 0", plan[7].milestone.startsWith("Handover") && near(plan[7].escrowBalance, 0, 1), plan[7]);
const split = installmentSplit(s, exec);
check("7 installments during works, 53 after handover", split.duringWorks === 7 && split.afterHandover === 53, split);

console.log("\n9. assembleEstimate ties it together (defaults select 20%/60)");
const out = assembleEstimate(Q, FINANCE_DEFAULTS, SCOPE_DEFAULTS);
check("18 scenarios (6 down × 3 tenors)", out.scenarios.length === 18, out.scenarios.length);
check("selected = 20%/60 → 142,203", near(out.selected.monthly, 142_203.19, 0.5) && out.selected.tenor === 60, out.selected);
check("works duration 7 months", out.worksDurationMonths === 7, out.worksDurationMonths);

console.log("\n10. Auto-cost from the brief (rate card) produces a sensible quotation");
const ac = autoCost({ propertyType: "Villa", area: 320, services: ["finishing", "furniture", "kitchen"], package: "3M – 6M" }, ESTIMATE_RATES_DEFAULTS);
check("tier from budget choice = signature", ac.tier === "signature", ac.tier);
check("quotation is a positive number", ac.quotation > 0, ac.quotation);
check("includes a management % line on top of direct works", ac.lines.some((l) => l.key === "management" && l.amount > 0), ac.lines.map((l) => l.key));

console.log(`\n=== ${pass} passed, ${fail} failed ===`);
process.exit(fail ? 1 : 0);
