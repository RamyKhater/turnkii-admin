import "server-only";
import { ai, AI_MODEL, aiEnabled, textOf } from "./client";

export type ProjectSignal = {
  name: string;
  status: string;
  lastUpdateDaysAgo: number | null; // days since the last shared update (null = none)
  dueInDays: number | null;         // days to project due date (negative = overdue)
  blockedItems: number;             // rejected/reshoot items awaiting the crew
  awaitingClient: number;           // items awaiting the client's decision
  signable: number;                 // milestones ready for the client to sign
  overdueAmountEGP: number;
};

/** A short, prioritised delivery-risk digest from per-project signals. */
export async function deliveryDigest(signals: ProjectSignal[]): Promise<string> {
  if (!aiEnabled() || !signals.length) return "";
  try {
    const msg = await ai().messages.create({
      model: AI_MODEL,
      max_tokens: 700,
      system:
        "You are a delivery lead for a home fit-out company. From the per-project signals, write a short, prioritised stand-up digest: " +
        "which projects need attention and the single next action for each. Lead with the highest risk (quiet projects with a near/overdue due date, " +
        "blocked items sitting with the crew, milestones ready to sign, overdue money). One line per project, most urgent first, at most 6 lines. " +
        "British English, plain, no preamble, no headings. If everything looks healthy, say so in one line.",
      messages: [{ role: "user", content: signals.map((s) =>
        `${s.name} [${s.status}] · last update ${s.lastUpdateDaysAgo == null ? "never" : s.lastUpdateDaysAgo + "d ago"} · ` +
        `due ${s.dueInDays == null ? "n/a" : s.dueInDays + "d"} · blocked ${s.blockedItems} · awaiting client ${s.awaitingClient} · ` +
        `signable ${s.signable} · overdue EGP ${s.overdueAmountEGP.toLocaleString("en-US")}`).join("\n") }],
    });
    return textOf(msg);
  } catch {
    return "";
  }
}
