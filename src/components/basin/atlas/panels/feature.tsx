const PROP_LABELS: Record<string, string> = {
  agency: "Agency",
  purpose: "Purpose",
  frequency: "Frequency",
  publicDomain: "Public-domain data",
  findings: "Key findings",
  contributor: "Contributor",
  period: "Study period",
  locationName: "Location",
  capacityMld: "Operating capacity (MLD)",
  capacityKld: "Capacity (KLD)",
  classification: "Classification",
  locationNote: "Location note",
  status: "Status",
  process: "Process",
  kind: "Type",
  type: "Type",
  custodian: "Custodian",
  district: "District",
  tankId: "Tank ID",
  details: "Details",
  areaHa: "Area (ha)",
  govCode: "Government code",
  townType: "Town type",
  cetpNote: "CETP coverage",
  liveStorage: "Storage today",
  bmcShareMcft: "BMC share of capacity (mcft)",
  liveCapacityMcum: "Live capacity, state books (Mcum)",
  catchmentKm2: "Catchment (sq km)",
  supplyShare: "Share of supply",
  shareNote: "How to read the share",
  feed: "Storage feed",
};
const LINK_FIELDS = new Set(["dataUrl", "evidenceUrl"]);
// A feature that has its own page on this site (a panchayat, a block) carries pagePath + pageLabel.
const PAGE_FIELDS = new Set(["pagePath", "pageLabel"]);

/** Fallback label for any property key not in PROP_LABELS: split camelCase and
 *  capitalise, so "evidenceType" -> "Evidence Type", "govCode" -> "Gov Code". */
function humanizeKey(k: string): string {
  const s = k.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function FeaturePanel({ props, label, onClose }: { props: Record<string, unknown>; label: string; onClose: () => void }) {
  const title = String(props.name ?? props.contributor ?? props.kind ?? label);
  const entries = Object.entries(props).filter(
    ([k, v]) => k !== "name" && k !== "shedId" && k !== "cetp" && k !== "hasReadings" && k !== "liveCode"
      && k !== "readingsPending" && !LINK_FIELDS.has(k) && !PAGE_FIELDS.has(k) && v != null && String(v).trim() !== "",
  );
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[10px] uppercase tracking-wider text-slate-400">{label}</div>
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 leading-snug">{title}</h2>
        </div>
        <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded">
          <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
      <dl className="space-y-2">
        {entries.map(([k, v]) => (
          <div key={k}>
            <dt className="text-[10px] uppercase tracking-wider text-slate-400">{PROP_LABELS[k] ?? humanizeKey(k)}</dt>
            <dd className="text-slate-700 dark:text-slate-300 leading-relaxed">{String(v)}</dd>
          </div>
        ))}
      </dl>
      {typeof props.pagePath === "string" && props.pagePath.startsWith("/") && (
        <a href={props.pagePath} target="_blank" rel="noopener noreferrer" className="inline-block text-xs font-medium text-blue-600 dark:text-blue-400 hover:underline">
          {String(props.pageLabel ?? "Open its page")} →
        </a>
      )}
      {[...LINK_FIELDS].map((k) =>
        props[k] && String(props[k]).startsWith("http") ? (
          <a key={k} href={String(props[k])} target="_blank" rel="noopener noreferrer" className="inline-block text-xs text-blue-600 dark:text-blue-400 hover:underline">
            View source / lab report →
          </a>
        ) : null,
      )}
    </div>
  );
}
