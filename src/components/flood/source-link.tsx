import Link from "next/link";
import type { ReactNode } from "react";

const CLS = "text-blue-600 dark:text-blue-400 hover:underline";

/** A source link in flood-page copy: in-site paths route, anything else opens a new tab. */
export function SourceLink({ href, children }: { href: string; children: ReactNode }) {
  if (href.startsWith("/")) return <Link href={href} className={CLS}>{children}</Link>;
  return <a href={href} target="_blank" rel="noopener" className={CLS}>{children}</a>;
}
