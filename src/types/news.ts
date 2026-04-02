export type NewsDomain = "reservoirs" | "groundwater" | "flood" | "rivers" | "water_bodies";

/** App-facing type (camelCase). DB columns are snake_case, mapped in the API route. */
export interface NewsArticle {
  id: number;
  title: string;
  sourceName: string;
  url: string;
  publishedAt: string;
  snippet: string | null;
  domains: NewsDomain[];
}
