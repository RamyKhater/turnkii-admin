import { requireCap } from "@/lib/auth/guard";
import { PageHeader } from "@/components/ui";
import { RATE_CARD_DEFAULTS } from "@/lib/pricing";
import { getRateCard } from "@/lib/pricing/store";
import { RateCardEditor } from "@/components/pricing/rate-card-editor";
import { FINANCING_DEFAULTS } from "@/lib/financing";
import { getFinancing } from "@/lib/financing/store";
import { FinancingEditor } from "@/components/pricing/financing-editor";

export default async function PricingPage() {
  await requireCap("pricing:manage");
  const { card, published, updatedAt } = await getRateCard();
  const fin = await getFinancing();

  return (
    <>
      <PageHeader
        eyebrow="Pricing module"
        title="Rate card"
        sub="The single source of truth behind every live estimate on the site. Edit, check the sample, then publish."
      />
      <div className="p-6 lg:p-8">
        <RateCardEditor
          initial={card}
          defaults={RATE_CARD_DEFAULTS}
          published={published}
          updatedAtISO={updatedAt ? updatedAt.toISOString() : null}
        />

        <div className="mt-12 border-t border-line pt-8">
          <div className="mb-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-olive">Financing module</div>
            <h2 className="mt-1 font-serif text-2xl">Instalment plans &amp; pre-approval</h2>
            <p className="mt-1 max-w-[62ch] text-sm text-sub">
              The plans, calculator rates and pre-approval sizing shown on the site. Edit, check the sample, then publish.
            </p>
          </div>
          <FinancingEditor
            initial={fin.config}
            defaults={FINANCING_DEFAULTS}
            published={fin.published}
            updatedAtISO={fin.updatedAt ? fin.updatedAt.toISOString() : null}
          />
        </div>
      </div>
    </>
  );
}
