"use client";
import { useRouter } from "next/navigation";

/** Makes an entire table row open a detail page — click or Enter/Space — while
 *  leaving inner links (e.g. the ref) working for open-in-new-tab. */
export function ClickableRow({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const go = () => router.push(href);
  return (
    <tr
      onClick={(e) => {
        // let real links / buttons inside the row do their own thing
        if ((e.target as HTMLElement).closest("a,button,input,select,textarea")) return;
        go();
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
      }}
      tabIndex={0}
      role="link"
      aria-label={`Open ${href.split("/").pop()}`}
      className={(className ?? "") + " cursor-pointer focus:outline-none focus:bg-sand/40"}
    >
      {children}
    </tr>
  );
}
