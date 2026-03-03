import type { ReservoirName } from "@/types/reservoir";

type TranslateFn = (key: string) => string;

export function getReservoirDisplayName(
  name: ReservoirName,
  t: TranslateFn,
  fallback?: string
): string {
  switch (name) {
    case "poondi":
      return t("res.poondi");
    case "cholavaram":
      return t("res.cholavaram");
    case "redhills":
      return t("res.redhills");
    case "chembarambakkam":
      return t("res.chembarambakkam");
    case "veeranam":
      return t("res.veeranam");
    case "kannankottai":
      return t("res.kannankottai");
    default:
      return fallback ?? name;
  }
}
