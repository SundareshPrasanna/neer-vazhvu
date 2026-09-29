// Where a basin lives on the site. Client-safe: no fs.

/** URL of a basin's served tree (public/data/basins/<id>/), or of one file in it. */
export function basinDataUrl(basinId: string, file?: string): string {
  return `/data/basins/${basinId}${file ? `/${file}` : ""}`;
}

/** The basin's own page (the chrome-less embed), optionally opened on a sub-basin. */
export function basinEmbedHref(basinId: string, subBasinKey?: string): string {
  return `/embed/basins/${basinId}${subBasinKey ? `?sub=${subBasinKey}` : ""}`;
}
