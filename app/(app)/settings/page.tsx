import { eq } from "drizzle-orm";
import { requireCap } from "@/lib/auth/guard";
import { getSettings } from "@/lib/settings";
import { getDb } from "@/lib/db";
import { contentBlocks } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { Field, SubmitButton } from "@/components/form";
import { VerticalToggle } from "@/components/settings/vertical-toggle";
import { PublishButton } from "@/components/content/publish-button";
import { updateSla } from "@/lib/settings/actions";

export default async function SettingsPage() {
  await requireCap("settings:manage");
  const rows = await getSettings();
  const db = await getDb();
  const [pub] = await db.select().from(contentBlocks).where(eq(contentBlocks.key, "__published")).limit(1);
  const lastPublished = ((pub?.value as { at?: string } | undefined)?.at) ?? null;
  const verticals = rows.filter((r) => r.group === "vertical");
  const first = Number(rows.find((r) => r.key === "sla.firstResponseHours")?.value ?? 24);
  const resolve = Number(rows.find((r) => r.key === "sla.resolveDays")?.value ?? 21);

  return (
    <>
      <PageHeader
        eyebrow="Settings"
        title="Site & workflow settings"
        sub="Turn website verticals on or off, and set the SLA targets that drive alerts."
        actions={<PublishButton lastPublished={lastPublished} />}
      />
      <div className="max-w-2xl space-y-5 p-6 lg:p-8">
        <Card className="p-6">
          <h2 className="text-sm font-bold">Website verticals</h2>
          <p className="mt-1 text-sm text-sub">
            Disable a vertical to hide its section and nav link from the public site. Each toggle
            rebuilds the live site automatically (about a minute).
          </p>
          <div className="mt-4 divide-y divide-line">
            {verticals.map((v) => (
              <div key={v.key} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <div className="font-semibold">{v.label}</div>
                  <div className="text-xs text-muted">{v.enabled ? "Visible on the site" : "Hidden from the site"}</div>
                </div>
                <VerticalToggle settingKey={v.key} enabled={v.enabled} />
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-bold">SLA targets</h2>
          <p className="mt-1 text-sm text-sub">Requests breaching these show as at-risk / breached and trigger alerts.</p>
          <form action={updateSla} className="mt-4 flex flex-wrap items-end gap-4">
            <div className="w-48"><Field label="First response (hours)" name="firstResponseHours" type="number" defaultValue={first} /></div>
            <div className="w-48"><Field label="Resolution (days)" name="resolveDays" type="number" defaultValue={resolve} /></div>
            <SubmitButton>Save SLAs</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
