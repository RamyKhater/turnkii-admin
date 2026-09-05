import { eq } from "drizzle-orm";
import { requireCap } from "@/lib/auth/guard";
import { getSettings } from "@/lib/settings";
import { getDb } from "@/lib/db";
import { contentBlocks } from "@/lib/db/schema";
import { PageHeader, Card } from "@/components/ui";
import { Field, SubmitButton } from "@/components/form";
import { VerticalToggle } from "@/components/settings/vertical-toggle";
import { PublishButton } from "@/components/content/publish-button";
import { updateSla, updateNotifications, updateWhatsapp, updateReferral } from "@/lib/settings/actions";
import { emailEnabled } from "@/lib/email/send";
import { mergeEmailCopy, type EmailCopy } from "@/lib/email/requests";
import { whatsappEnabled } from "@/lib/whatsapp/send";
import { WA_DEFAULTS } from "@/lib/whatsapp/requests";
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
  const referralCredit = Number(rows.find((r) => r.key === "referral.creditEGP")?.value ?? 5000);
  const teamAlert = rows.find((r) => r.key === "notify.newRequestEmail")?.enabled ?? true;
  const customerReceipt = rows.find((r) => r.key === "notify.customerReceipt")?.enabled ?? true;
  const accountWelcome = rows.find((r) => r.key === "notify.accountWelcome")?.enabled ?? true;
  const extraRecipients = String(rows.find((r) => r.key === "notify.extraRecipients")?.value ?? "");
  const emailReady = emailEnabled();
  const copy = mergeEmailCopy(rows.find((r) => r.key === "notify.emailCopy")?.value as Partial<EmailCopy> | undefined);
  const waReady = whatsappEnabled();
  const waVal = (k: string, d = "") => String(rows.find((r) => r.key === k)?.value ?? "") || d;
  const waCustomer = rows.find((r) => r.key === "notify.waCustomer")?.enabled ?? false;
  const waTeam = rows.find((r) => r.key === "notify.waTeam")?.enabled ?? false;
  const waCustomerTemplate = waVal("notify.waCustomerTemplate", WA_DEFAULTS.customerTemplate);
  const waTeamTemplate = waVal("notify.waTeamTemplate", WA_DEFAULTS.teamTemplate);
  const waLanguage = waVal("notify.waLanguage", WA_DEFAULTS.language);
  const waRecipients = waVal("notify.waRecipients");

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
          <h2 className="text-sm font-bold">Referral program</h2>
          <p className="mt-1 text-sm text-sub">The credit a referrer earns off their own fit-out when a lead they sent signs a contract. Applied per signed referral.</p>
          <form action={updateReferral} className="mt-4 flex flex-wrap items-end gap-4">
            <div className="w-56"><Field label="Referral credit (EGP)" name="creditEGP" type="number" defaultValue={referralCredit} /></div>
            <SubmitButton>Save credit</SubmitButton>
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
                <span className="block text-xs text-muted">Send the person who submitted a branded confirmation with their reference and what happens next (only if they gave an email). Covers briefs, financing pre-approvals and service requests.</span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" name="accountWelcome" defaultChecked={accountWelcome} className="mt-1 h-4 w-4 accent-olive" />
              <span>
                <span className="text-sm font-semibold">Welcome new teammates</span>
                <span className="block text-xs text-muted">Email a branded welcome with the sign-in link when a new staff account is created in Team.</span>
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
                <Field label="Team alert — service" name="copyTeamService" defaultValue={copy.teamService} />
                <Field label="Customer confirmation — brief" name="copyCustomerBrief" defaultValue={copy.customerBrief} />
                <Field label="Customer confirmation — financing" name="copyCustomerFinancing" defaultValue={copy.customerFinancing} />
                <Field label="Customer confirmation — service" name="copyCustomerService" defaultValue={copy.customerService} />
              </div>
            </details>

            <SubmitButton>Save notifications</SubmitButton>
          </form>
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-bold">WhatsApp notifications</h2>
          <p className="mt-1 text-sm text-sub">Send confirmations and team alerts over the WhatsApp Business API, in addition to email. Business-initiated messages must use Meta-approved templates.</p>
          {!waReady && (
            <div className="mt-3 rounded-xl bg-warn/10 px-4 py-3 text-xs text-warn">
              WhatsApp isn’t connected yet. Set <code className="font-mono">WHATSAPP_TOKEN</code> and <code className="font-mono">WHATSAPP_PHONE_NUMBER_ID</code> (from your Meta WhatsApp Business app) in the admin environment. Until then these preferences save, but nothing is sent.
            </div>
          )}
          <form action={updateWhatsapp} className="mt-4 space-y-4">
            <label className="flex items-start gap-3">
              <input type="checkbox" name="waCustomer" defaultChecked={waCustomer} className="mt-1 h-4 w-4 accent-olive" />
              <span>
                <span className="text-sm font-semibold">WhatsApp the submitter</span>
                <span className="block text-xs text-muted">Send a confirmation to the phone number they left, for briefs, financing and service requests.</span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input type="checkbox" name="waTeam" defaultChecked={waTeam} className="mt-1 h-4 w-4 accent-olive" />
              <span>
                <span className="text-sm font-semibold">WhatsApp the team</span>
                <span className="block text-xs text-muted">Alert the numbers below whenever a new request comes in.</span>
              </span>
            </label>
            <Textarea label="Team WhatsApp numbers" name="waRecipients" defaultValue={waRecipients} rows={2} />
            <p className="-mt-2 text-xs text-muted">International format, comma-separated (e.g. +20 122 118 8000).</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Customer template" name="waCustomerTemplate" defaultValue={waCustomerTemplate} />
              <Field label="Team template" name="waTeamTemplate" defaultValue={waTeamTemplate} />
              <Field label="Language code" name="waLanguage" defaultValue={waLanguage} />
            </div>
            <details className="rounded-xl border border-line bg-paper/60 px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold">Templates to create in Meta</summary>
              <p className="mt-2 text-xs text-muted">Create these two message templates in WhatsApp Manager (category <b>Utility</b>) and use their names above. The <code className="font-mono">{"{{n}}"}</code> variables must be in this exact order:</p>
              <div className="mt-3 space-y-3 text-xs">
                <div className="rounded-lg bg-white p-3">
                  <div className="font-bold">{waCustomerTemplate} — customer</div>
                  <div className="mt-1 text-muted">{"{{1}}"} = first name · {"{{2}}"} = reference</div>
                  <div className="mt-1.5 font-mono text-ink">Hi {"{{1}}"}, thanks for reaching out to Turnkii. We’ve received your request ({"{{2}}"}) and our team will contact you shortly. Reply here anytime.</div>
                </div>
                <div className="rounded-lg bg-white p-3">
                  <div className="font-bold">{waTeamTemplate} — team</div>
                  <div className="mt-1 text-muted">{"{{1}}"} = type · {"{{2}}"} = reference · {"{{3}}"} = name · phone</div>
                  <div className="mt-1.5 font-mono text-ink">New {"{{1}}"} on Turnkii: {"{{2}}"} — {"{{3}}"}. Open the admin to follow up.</div>
                </div>
              </div>
            </details>
            <SubmitButton>Save WhatsApp</SubmitButton>
          </form>
        </Card>
      </div>
    </>
  );
}
