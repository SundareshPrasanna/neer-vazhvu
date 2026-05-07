export type FactTier = 1 | 2 | 3 | 4;

export type FactClaimStatus =
  | "observed"
  | "modelled"
  | "estimated"
  | "historical";

export type FactConfidence = "high" | "medium" | "low";

export interface FactThreshold {
  value: number;
  source: string;
  label: string;
}

/**
 * Canonical fact object. Drives the card UI, the copy-quote button output,
 * the JSON API, the PDF press kit, and the JSON-LD structured data.
 *
 * Every fact is rendered from one of these, so there is no drift between
 * what a card displays and what a journalist pastes into an article.
 */
export interface Fact {
  id: string;
  tier: FactTier;
  category: string;

  title: string;
  value: string;
  unit: string;
  interpretation: string;

  data_date: string | null;
  published_date: string | null;
  retrieved_at: string;
  computed_at: string | null;

  source_url: string;
  source_label: string;
  method_id: string;

  confidence: FactConfidence;
  claim_status: FactClaimStatus;

  quote_text: string;
  threshold?: FactThreshold;

  title_ta?: string;
  interpretation_ta?: string;
  quote_text_ta?: string;
}

export interface FactsPayload {
  generated_at: string;
  facts: Fact[];
}

export const TIER_LABELS: Record<FactTier, { en: string; ta: string }> = {
  1: { en: "Today", ta: "இன்று" },
  2: { en: "This year", ta: "இந்த ஆண்டு" },
  3: { en: "Water history", ta: "நீர் வரலாறு" },
  4: { en: "Infrastructure", ta: "உள்கட்டமைப்பு" },
};

export const TIER_DESCRIPTIONS: Record<FactTier, { en: string; ta: string }> = {
  1: {
    en: "Live numbers from daily monitoring feeds. Each card shows its data cadence and timestamp.",
    ta: "தினசரி கண்காணிப்பு ஊட்டங்களிலிருந்து நேரடி எண்கள். ஒவ்வொரு அட்டையும் அதன் தரவு கால அளவு மற்றும் நேர முத்திரையைக் காட்டுகிறது.",
  },
  2: {
    en: "Latest publicly-released data from government agencies. Each card shows its vintage year. When agencies are slow to publish, we flag it.",
    ta: "அரசு நிறுவனங்களிடமிருந்து வெளியிடப்பட்ட சமீபத்திய தரவு. ஒவ்வொரு அட்டையும் அதன் வருடத்தைக் காட்டுகிறது.",
  },
  3: {
    en: "Reference facts from documented events and peak records. These are historical markers, useful for context - not claims about current state.",
    ta: "ஆவணப்படுத்தப்பட்ட நிகழ்வுகள் மற்றும் உச்ச பதிவுகளிலிருந்து குறிப்பு உண்மைகள். இவை வரலாற்று குறிப்புகள்.",
  },
  4: {
    en: "The city's water system at a glance. These numbers reflect installed capacity, inventory, and structural facts that change slowly.",
    ta: "நகரின் நீர் அமைப்பு. நிறுவப்பட்ட திறன், சரக்கு மற்றும் கட்டமைப்பு உண்மைகள்.",
  },
};

export const TIER_BADGE_STYLE: Record<FactTier, { bg: string; text: string; label: string }> = {
  1: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-800 dark:text-green-300", label: "Live" },
  2: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-800 dark:text-amber-300", label: "Annual" },
  3: { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-700 dark:text-slate-300", label: "Historical" },
  4: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-800 dark:text-blue-300", label: "Structural" },
};
