import Link from "next/link";

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * India > Tamil Nadu > District > Block > Gram Panchayat. The state is plain
 * text until a state page exists; the shared header carries the rest of the
 * chrome, so this is the only navigation an Atlas page renders itself.
 */
export function AtlasBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Location hierarchy" className="text-xs sm:text-sm text-slate-500 dark:text-slate-400">
      <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
        {items.map((item, index) => {
          const last = index === items.length - 1;
          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-x-1.5">
              {index > 0 && <span aria-hidden="true">/</span>}
              {item.href ? (
                <Link
                  href={item.href}
                  className="hover:text-slate-900 dark:hover:text-slate-100 hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  className={last ? "font-medium text-slate-900 dark:text-slate-100" : undefined}
                  aria-current={last ? "page" : undefined}
                >
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
