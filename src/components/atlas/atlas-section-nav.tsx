import { AtlasContainer } from "./atlas-primitives";

export interface AtlasNavSection {
  id: string;
  label: string;
}

const LINK =
  "text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:underline";

/**
 * The "on this page" list the Atlas pages share: anchor links to the
 * sections that actually rendered, so a reader can jump instead of scroll.
 * One component, two layouts: a wrapping bar under a page header (district)
 * that sticks below the site header on wide screens, and the side rail of
 * the Panchayat profile. Pass only the sections that exist on the page; a
 * link to a section that did not render is worse than no link.
 */
export function AtlasSectionNav({
  sections,
  label,
  heading,
  layout = "bar",
}: {
  sections: AtlasNavSection[];
  /** The nav's accessible name. */
  label: string;
  /** The short visible heading: "On this page", "In this profile". */
  heading: string;
  layout?: "bar" | "rail";
}) {
  if (sections.length === 0) return null;
  if (layout === "rail") {
    return (
      <nav aria-label={label} className="mb-6 lg:mb-0 lg:sticky lg:top-20 lg:self-start">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{heading}</p>
        <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 lg:flex-col lg:gap-y-1.5">
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className={LINK}>
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    );
  }
  // Below the site header (h-16, z-[10000]) and above the Leaflet panes
  // (z-index up to 700), so the bar neither hides under one nor under the other.
  return (
    <nav
      aria-label={label}
      className="border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur lg:sticky lg:top-16 lg:z-[1000]"
    >
      <AtlasContainer className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{heading}</span>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className={LINK}>
                {section.label}
              </a>
            </li>
          ))}
        </ul>
      </AtlasContainer>
    </nav>
  );
}
