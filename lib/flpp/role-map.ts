// Display-only map from FLPP's roles to how Turnkii names them. There is no
// shared identity between the systems — this just makes synced attribution
// (stored on project_updates.flpp_actor) readable on the Turnkii side.
export const FLPP_ROLE_LABEL: Record<string, string> = {
  ops: "FLPP · Origination",
  projects: "FLPP · Projects",
  design: "FLPP · Design",
  finance: "FLPP · Finance",
  platform: "FLPP · Platform",
  api: "FLPP · Integration",
  contractor: "Contractor",
  supplier: "Supplier",
  furniture: "Furniture supplier",
  ffe: "FF&E supplier",
  merchant: "Merchant",
};

export function flppRoleLabel(role?: string | null): string {
  return (role && FLPP_ROLE_LABEL[role]) || "FLPP";
}
