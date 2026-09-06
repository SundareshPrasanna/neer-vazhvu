// Today's storage on a basin-atlas feature panel. Features that join the daily
// reservoir feed carry a liveCode; the atlas fetches /api/reservoir/basin for
// them at view time and this puts the reading first on the panel - the
// current figure leads, capacities and shares follow.

/** One row of /api/reservoir/basin: the latest daily reading for a liveCode. */
export interface LiveStorageRow {
  code: string;
  date: string;
  storageTmc: number | null;
  storagePctFrl: number | null;
}

/** storagePctFrl is against the dam's own live capacity, not any city's share
 *  of it - the family's shareNote sits beside it on the panel for that reason. */
export function liveStorageLine(row: LiveStorageRow | undefined): string {
  if (!row) return "No reading in the daily feed yet";
  const tmc = row.storageTmc != null ? `${row.storageTmc} TMC` : "storage n/a";
  const pct = row.storagePctFrl != null ? `, ${Math.round(row.storagePctFrl)}% of the dam's live capacity` : "";
  return `${tmc}${pct} (${row.date}, WRD Pravah daily bulletin)`;
}

/** Panel props with `liveStorage` inserted right after `name` for a live
 *  reservoir; any other feature passes through untouched. */
export function withLiveStorage(
  props: Record<string, unknown>,
  live: Record<string, LiveStorageRow>,
): Record<string, unknown> {
  const code = typeof props.liveCode === "string" ? props.liveCode : null;
  if (!code) return props;
  const { name, ...rest } = props;
  return { name, liveStorage: liveStorageLine(live[code]), ...rest };
}
