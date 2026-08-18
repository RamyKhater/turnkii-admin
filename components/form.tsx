import type React from "react";

export function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  placeholder,
  hint,
}: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  required?: boolean;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
        className="rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink"
      />
      {hint && <span className="text-xs text-muted">{hint}</span>}
    </label>
  );
}

export function Textarea({
  label,
  name,
  defaultValue,
  rows = 3,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
      <textarea
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        className="rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm outline-none focus:border-ink"
      />
    </label>
  );
}

export function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-bold uppercase tracking-wider text-muted">{label}</span>
      <select
        name={name}
        defaultValue={defaultValue}
        className="rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm font-semibold outline-none focus:border-ink"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

export function CheckField({
  label,
  name,
  defaultChecked,
}: {
  label: string;
  name: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm font-semibold">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="h-4 w-4 accent-ink" />
      {label}
    </label>
  );
}

export function SubmitButton({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="submit"
      className="rounded-full bg-ink px-6 py-2.5 text-sm font-bold text-cream hover:bg-lime hover:text-ink"
    >
      {children}
    </button>
  );
}
