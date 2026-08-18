import { Field, SelectField, SubmitButton } from "@/components/form";
import type { Project } from "@/lib/db/schema";

const iso = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export function ProjectForm({
  action,
  project,
  properties,
  styles,
}: {
  action: (formData: FormData) => void | Promise<void>;
  project?: Project;
  properties: { id: number; name: string }[];
  styles: { key: string; name: string }[];
}) {
  return (
    <form action={action} className="flex flex-col gap-4">
      {project && <input type="hidden" name="id" value={project.id} />}
      <Field label="Project name" name="name" defaultValue={project?.name} required />
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="Property"
          name="propertyId"
          defaultValue={String(project?.propertyId ?? "")}
          options={[{ value: "", label: "— none —" }, ...properties.map((p) => ({ value: String(p.id), label: p.name }))]}
        />
        <SelectField
          label="Style"
          name="style"
          defaultValue={project?.style ?? ""}
          options={[{ value: "", label: "—" }, ...styles.map((s) => ({ value: s.key, label: s.name }))]}
        />
      </div>
      <Field label="Services" name="services" defaultValue={(project?.services ?? []).join(", ")} hint="Comma-separated, e.g. Finishing, Kitchens" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Contract value (EGP)" name="contractValue" type="number" defaultValue={project?.contractValue ?? 0} />
        <SelectField
          label="Status"
          name="status"
          defaultValue={project?.status ?? "active"}
          options={[
            { value: "active", label: "Active" },
            { value: "on_hold", label: "On hold" },
            { value: "complete", label: "Complete" },
          ]}
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Start date" name="startDate" type="date" defaultValue={iso(project?.startDate)} />
        <Field label="Due date" name="dueDate" type="date" defaultValue={iso(project?.dueDate)} />
      </div>
      <div><SubmitButton>{project ? "Save changes" : "Create project"}</SubmitButton></div>
    </form>
  );
}
