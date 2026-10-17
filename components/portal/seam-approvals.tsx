"use client";
import { useState, useTransition } from "react";
import { ownerDecideVariation, ownerSignHandover } from "@/lib/projects/approvals";

const egp = (n: number) => "EGP " + n.toLocaleString("en-US");

export type PVariation = { id: number; ref: string; description: string; amount: number; projectName: string };

/** F5 — the customer approves or declines a client-borne variation before the
 *  contract value moves. */
export function VariationApprovals({ variations }: { variations: PVariation[] }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState<Record<number, "accepted" | "declined">>({});

  return (
    <div className="space-y-3">
      {variations.map((v) => {
        const d = done[v.id];
        return (
          <div key={v.id} className="rounded-2xl border border-line bg-paper p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div className="font-semibold">{v.description}</div>
              <div className="font-bold tabular text-ink">+{egp(v.amount)}</div>
            </div>
            <div className="mt-0.5 text-xs text-muted">{v.ref} · {v.projectName} — added to your contract on approval.</div>
            {d ? (
              <div className={`mt-3 text-sm font-bold ${d === "accepted" ? "text-ok" : "text-crit"}`}>{d === "accepted" ? "Approved — thank you." : "Declined."}</div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => start(async () => { const r = await ownerDecideVariation(v.id, true); if (!r.error) setDone((s) => ({ ...s, [v.id]: "accepted" })); })}
                  disabled={pending}
                  className="rounded-full bg-ok px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                >Approve change</button>
                <button
                  onClick={() => start(async () => { const r = await ownerDecideVariation(v.id, false); if (!r.error) setDone((s) => ({ ...s, [v.id]: "declined" })); })}
                  disabled={pending}
                  className="rounded-full border border-line px-4 py-2 text-sm font-bold text-crit hover:border-crit disabled:opacity-60"
                >Decline</button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export type PHandover = {
  projectId: number; projectName: string; summary: string | null; warranty: string | null;
  deliveredByName: string | null; media: { url: string; type?: string; caption?: string }[]; signed: boolean;
};

/** F6 — the customer reviews the handover pack and signs it off, completing the project. */
export function HandoverSignoff({ handover }: { handover: PHandover }) {
  const [pending, start] = useTransition();
  const [signed, setSigned] = useState(handover.signed);
  const photos = handover.media.filter((m) => m.type !== "video").slice(0, 6);

  return (
    <div className="rounded-2xl border border-line bg-paper p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-serif text-2xl">{handover.projectName}</h3>
        {handover.deliveredByName && <div className="text-xs text-muted">Delivered by {handover.deliveredByName}</div>}
      </div>
      {handover.summary && <p className="mt-2 text-sm text-sub">{handover.summary}</p>}
      {photos.length > 0 && (
        <div className="mt-3 grid grid-cols-3 gap-2">
          {photos.map((m, i) => (
            <div key={i} className="aspect-[4/3] rounded-lg bg-sand" style={{ backgroundImage: `url(${m.url})`, backgroundSize: "cover", backgroundPosition: "center" }} />
          ))}
        </div>
      )}
      {handover.warranty && <p className="mt-3 text-xs text-muted"><span className="font-bold">Warranty:</span> {handover.warranty}</p>}
      {signed ? (
        <div className="mt-4 text-sm font-bold text-ok">Signed off — your home is complete. Thank you!</div>
      ) : (
        <button
          onClick={() => start(async () => { const r = await ownerSignHandover(handover.projectId); if (!r.error) setSigned(true); })}
          disabled={pending}
          className="mt-4 rounded-full bg-ok px-5 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >Accept & sign off handover</button>
      )}
    </div>
  );
}
