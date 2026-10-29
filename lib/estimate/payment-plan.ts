import type { Scenario } from "@/lib/estimate/finance";

export type CashRow = {
  month: number;
  downPayment: number;
  installment: number;
  total: number;
  worksReleased: number;
  cumulativeWorks: number;
  escrowBalance: number;
  milestone: string;
};

/** Month-by-month cash plan for a selected scenario: the customer's payments
 *  (down payment at month 0, then installments) against the works released from
 *  escrow on sign-off. Month 0 holds the full quotation in escrow. */
export function escrowCashPlan(scenario: Scenario, monthlyExecuted: number[], quotation: number): CashRow[] {
  const rows: CashRow[] = [{
    month: 0, downPayment: scenario.downPayment, installment: 0, total: scenario.downPayment,
    worksReleased: 0, cumulativeWorks: 0, escrowBalance: quotation,
    milestone: "Contract signed · down payment and financed amount deposited in escrow",
  }];
  let cum = 0;
  for (let m = 1; m <= scenario.tenor; m++) {
    const works = m - 1 < monthlyExecuted.length ? monthlyExecuted[m - 1] : 0;
    cum = Math.min(quotation, cum + works);
    const escrowBalance = Math.max(0, quotation - cum);
    const milestone = works > 1e-6
      ? (cum >= quotation - 1e-6 ? "Handover · keys and photographs" : "Works in progress · milestone sign-offs")
      : "Repayment continues";
    rows.push({ month: m, downPayment: 0, installment: scenario.monthly, total: scenario.monthly, worksReleased: works, cumulativeWorks: cum, escrowBalance, milestone });
  }
  return rows;
}

/** Installments paid during the works period vs after handover, for a scenario. */
export function installmentSplit(scenario: Scenario, monthlyExecuted: number[]): { duringWorks: number; afterHandover: number } {
  const worksMonths = monthlyExecuted.filter((v) => v > 1e-6).length;
  const duringWorks = Math.min(scenario.tenor, worksMonths);
  return { duringWorks, afterHandover: Math.max(0, scenario.tenor - duringWorks) };
}
