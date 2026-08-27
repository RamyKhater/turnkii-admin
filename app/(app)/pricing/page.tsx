import { requireCap } from "@/lib/auth/guard";
import { PageHeader } from "@/components/ui";
import { RATE_CARD_DEFAULTS } from "@/lib/pricing";
import { getRateCard } from "@/lib/pricing/store";
import { RateCardEditor } from "@/components/pricing/rate-card-editor";

export default async function PricingPage() {
  await requireCap("pricing:manage");
  const { card, published, updatedAt } = await getRateCard();

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
      </div>
    </>
  );
}
