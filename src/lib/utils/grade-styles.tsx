import type { Grade } from "@/lib/utils/ward-rankings";

export const GRADE_STYLES: Record<Grade, { bg: string; text: string; border: string }> = {
  A: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200" },
  B: { bg: "bg-blue-50",    text: "text-blue-700",    border: "border-blue-200" },
  C: { bg: "bg-amber-50",   text: "text-amber-700",   border: "border-amber-200" },
  D: { bg: "bg-orange-50",  text: "text-orange-700",  border: "border-orange-200" },
  F: { bg: "bg-red-50",     text: "text-red-700",     border: "border-red-200" },
};

export const GRADE_PRINT_KEY: Record<Grade, string> = {
  A: "report.grade_label_a",
  B: "report.grade_label_b",
  C: "report.grade_label_c",
  D: "report.grade_label_d",
  F: "report.grade_label_f",
};

export function GradeBadge({ grade, size = "sm" }: { grade: Grade; size?: "sm" | "lg" }) {
  const s = GRADE_STYLES[grade];
  const cls = size === "lg"
    ? `w-16 h-16 text-3xl font-black rounded-xl border-2 ${s.bg} ${s.text} ${s.border}`
    : `w-7 h-7 text-sm font-bold rounded-md border ${s.bg} ${s.text} ${s.border}`;
  return (
    <div className={`inline-flex items-center justify-center ${cls} report-grade`}>
      {grade}
    </div>
  );
}
