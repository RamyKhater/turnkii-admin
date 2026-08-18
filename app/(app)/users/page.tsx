import { asc } from "drizzle-orm";
import { requireCap } from "@/lib/auth/guard";
import { getDb } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { ROLES } from "@/lib/auth/rbac";
import { PageHeader, Card, Avatar } from "@/components/ui";
import { RoleSelect, ActiveToggle, CreateUserForm } from "@/components/users/controls";

export default async function UsersPage() {
  const me = await requireCap("users:manage");
  const db = await getDb();
  const rows = await db.select().from(users).orderBy(asc(users.name));

  return (
    <>
      <PageHeader
        eyebrow="Team"
        title="People & access"
        sub="Create accounts and set what each person can do. Roles are enforced across the app."
      />
      <div className="space-y-5 p-6 lg:p-8">
        <Card className="p-6">
          <h2 className="text-sm font-bold">Add a team member</h2>
          <p className="mb-4 mt-1 text-xs text-sub">They can sign in immediately with the temporary password.</p>
          <CreateUserForm />
        </Card>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-line bg-sand/40 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="px-5 py-3 font-bold">Person</th>
                  <th className="px-3 py-3 font-bold">Role</th>
                  <th className="px-3 py-3 font-bold">State</th>
                  <th className="px-5 py-3 font-bold">Joined</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => {
                  const isSelf = u.id === me.id;
                  return (
                    <tr key={u.id} className="border-b border-line last:border-0 hover:bg-sand/30">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} />
                          <div>
                            <div className="font-bold">
                              {u.name} {isSelf && <span className="ml-1 rounded-full bg-lime px-1.5 py-0.5 text-[10px] font-bold uppercase text-ink">You</span>}
                            </div>
                            <div className="text-xs text-muted">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        <RoleSelect id={u.id} role={u.role} disabled={isSelf} />
                      </td>
                      <td className="px-3 py-3">
                        <ActiveToggle id={u.id} active={u.active} disabled={isSelf} />
                      </td>
                      <td className="px-5 py-3 text-sub tabular">
                        {u.createdAt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="text-sm font-bold">What each role can do</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {ROLES.map((r) => (
              <div key={r.value} className="rounded-xl border border-line p-4">
                <div className="font-bold">{r.label}</div>
                <div className="mt-1 text-sm text-sub">{r.blurb}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
