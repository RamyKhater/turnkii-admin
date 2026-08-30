import { eq } from "drizzle-orm";
import { requireCap } from "@/lib/auth/guard";
import { getSettings } from "@/lib/settings";
import { getDb } from "@/lib/db";
import { contentBlocks } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { Field, SubmitButton } from "@/components/form";
import { VerticalToggle } from "@/components/settings/vertical-toggle";
import { PublishButton } from "@/components/content/publish-button";
import { updateSla, updateNotifications } from "@/lib/settings/actions";
import { emailEnabled } from "@/lib/email/send";
import { mergeEmailCopy, type EmailCopy } from "@/lib/email/requests";
import { Textarea } from "@/components/form";

export default async function SettingsPage() {
  await requireCap("settings:manage");
  const rows = await getSettings();
  const db = await getDb();
  const [pub] = await db.select().from(contentBlocks).where(eq(contentBlocks.key, "__published")).limit(1);
  const lastPublished = ((pub?.value as { at?: string } | undefined)?.at) ?? null;
  const verticals = rows.filter((r) => r.group === "vertical");
  const first = Number(rows.find((r) => r.key === "sla.firstResponseHours")?.value ?? 24);
  const resolve = Number(rows.find((r) => r.key === "sla.resolveDays")?.value ?? 21);
  const teamAlert = rows.find((r) => r.key === "notify.newRequestEmail")?.enabled ?? true;
  const customerReceipt = rows.find((r) => r.key === "notify.customerReceipt")?.enabled ?? true;
  const extraRecipients = String(rows.find((r) => r.key === "notify.extraRecipients")?.value ?? "");
  const emailReady = emailEnabled();
  const copy = mergeEmailCopy(rows.find((r) => r.key === "notify.emailCopy")?.value as Partial<EmailCopy> | undefined);

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

        <Card className="p-6">
          <h2 className="text-sm font-bold">Email notifications</h2>
          <p className="mt-1 text-sm text-sub">Who gets emailed when a new request or financing pre-approval comes in from the website.</p>
          {!emailReady && (
            <div className="mt-3 rounded-xl bg-warn/10 px-4 py-3 text-xs text-warn">
              Email delivery isn’t configured yet. Set <code className="font-mono">RESEND_API_KEY</code> and <code className="font-mono">TK_EMAIL_FROM</code> (a verified sender, e.g. <span className="font-mono">Turnkii &lt;hello@turnkii.app&gt;</span>) in the admin environment. Until then these preferences save, but no email is sent.
            </div>
          )}
          <form action={updateNotifications} className="mt-4 space-y-4">
            <label className="flex items-start gap-3">
              <input type="checkbox" name="newRequestEmail" defaultChecked={teamAlert} className="mt-1 h-4 w-4 accent-olive" />
              <span>
                <span className="text-sm font-semibold">Alert the team</span>
                <span className="block text-xs text-muted">Email every admin &amp; ops manager (plus any extra recipients below) with the request details and a link to open it.</span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" name="customerReceipt" defaultChecked={customerReceipt} className="mt-1 h-4 w-4 accent-olive" />
              <span>
                <span className="text-sm font-semibold">Confirm to the submitter</span>
                <span className="block text-xs text-muted">Send the person who submitted a branded confirmation with their reference and what happens next (only if they gave an email).</span>
              </span>
            </label>
            <Textarea label="Extra alert recipients" name="extraRecipients" defaultValue={extraRecipients} rows={2} />
            <p className="-mt-2 text-xs text-muted">Comma-separated email addresses, on top of admins &amp; ops managers.</p>

            <details className="rounded-xl border border-line bg-paper/60 px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold">Email wording (subject &amp; heading)</summary>
              <p className="mt-2 text-xs text-muted">
                Used as both the subject line and the heading inside each email. Tokens get filled per request:
                {" "}<code className="font-mono">{"{ref}"}</code> <code className="font-mono">{"{first}"}</code> <code className="font-mono">{"{name}"}</code> <code className="font-mono">{"{location}"}</code> <code className="font-mono">{"{limit}"}</code> <code className="font-mono">{"{plan}"}</code>. Leave a field blank to use the default.
              </p>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field label="Team alert — brief" name="copyTeamBrief" defaultValue={copy.teamBrief} />
                <Field label="Team alert — financing" name="copyTeamFinancing" defaultValue={copy.teamFinancing} />
                <Field label="Customer confirmation — brief" name="copyCustomerBrief" defaultValue={copy.customerBrief} />
                <Field label="Customer confirmation — financing" name="copyCustomerFinancing" defaultValue={copy.customerFinancing} />
              </div>
            </details>

            <SubmitButton>Save notifications</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
