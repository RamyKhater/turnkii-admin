"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteItem } from "@/lib/content/actions";

export function DeleteButton({
  entity,
  id,
  name,
  redirectTo,
}: {
  entity: "style" | "product" | "inspiration" | "service" | "handover";
  id: number;
  name: string;
  redirectTo?: string;
}) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      onClick={() => {
        if (!confirm(`Delete “${name}”? This can't be undone.`)) return;
        start(async () => {
          await deleteItem(entity, id);
          if (redirectTo) router.push(redirectTo);
        });
      }}
      disabled={pending}
      className="text-sm font-bold text-crit hover:underline disabled:opacity-50"
    >
      {pending ? "Deleting…" : "Delete"}
    </button>
  );
}
