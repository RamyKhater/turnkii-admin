import type { RequestStatus } from "@/lib/db/schema";

export const STATUS_META: Record<
  RequestStatus,
  { label: string; dot: string; chip: string }
> = {
  new: { label: "New", dot: "bg-info", chip: "bg-info/10 text-info" },
  contacted: { label: "Contacted", dot: "bg-olive", chip: "bg-olive/10 text-olive" },
  survey_booked: { label: "Survey booked", dot: "bg-info", chip: "bg-info/10 text-info" },
  scoped: { label: "Scoped", dot: "bg-warn", chip: "bg-warn/10 text-warn" },
  quoted: { label: "Quoted", dot: "bg-warn", chip: "bg-warn/15 text-warn" },
  won: { label: "Won", dot: "bg-ok", chip: "bg-ok/12 text-ok" },
  lost: { label: "Lost", dot: "bg-crit", chip: "bg-crit/10 text-crit" },
};

export const PIPELINE: RequestStatus[] = [
  "new", "contacted", "survey_booked", "scoped", "quoted", "won", "lost",
];

export function StatusBadge({ status }: { status: RequestStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${m.chip}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </span>
  );
}

export function PageHeader({
  eyebrow,
  title,
  sub,
  actions,
}: {
  eyebrow?: string;
  title: string;
  sub?: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line px-6 py-5 lg:px-8">
      <div className="min-w-0">
        {eyebrow && (
          <p className="text-xs font-bold uppercase tracking-wider text-muted">{eyebrow}</p>
        )}
        <h1 className="mt-1 font-serif text-3xl leading-tight">{title}</h1>
        {sub && <p className="mt-1 max-w-[60ch] text-sm text-sub">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-line bg-paper ${className}`}>{children}</div>
  );
}

export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <Card className="p-5">
      <p className="text-xs font-bold uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 font-serif text-4xl leading-none tabular">{value}</p>
      {hint && <p className="mt-2 text-xs text-sub">{hint}</p>}
    </Card>
  );
}

export function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((p) => p[0]).slice(0, 2).join("");
  return (
    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sand text-[11px] font-bold text-ink">
      {initials}
    </span>
  );
}
