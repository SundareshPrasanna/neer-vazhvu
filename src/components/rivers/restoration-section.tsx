"use client";

import { useEffect, useState } from "react";
import { useLanguage } from "@/lib/i18n/context";
import { getRestorationProjects } from "@/lib/data/restoration-projects";
import type { RestorationProject, RestorationStatus, RestorationCategory } from "@/types/restoration-projects";
import type { RiverId } from "@/types/river-quality";

const STATUS_COLORS: Record<RestorationStatus, string> = {
  completed: "text-green-600 dark:text-green-400",
  in_progress: "text-amber-600 dark:text-amber-400",
  planned: "text-slate-500 dark:text-slate-400",
};

const STATUS_DOT_COLORS: Record<RestorationStatus, string> = {
  completed: "bg-green-500",
  in_progress: "bg-amber-500",
  planned: "bg-slate-400",
};

const STATUS_I18N: Record<RestorationStatus, string> = {
  completed: "restoration.completed",
  in_progress: "restoration.in_progress",
  planned: "restoration.planned",
};

const CATEGORY_I18N: Record<RestorationCategory, string> = {
  eco_restoration: "restoration.cat_eco",
  river_restoration: "restoration.cat_river",
  infrastructure: "restoration.cat_infra",
  canal_restoration: "restoration.cat_canal",
};

interface RestorationSectionProps {
  riverId: RiverId;
}

export function RestorationSection({ riverId }: RestorationSectionProps) {
  const { t, language } = useLanguage();
  const [projects, setProjects] = useState<RestorationProject[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    getRestorationProjects()
      .then((all) => {
        const filtered = all.filter((p) => p.display_on_rivers.includes(riverId));
        setProjects(filtered);
      })
      .catch(() => setError(true));
  }, [riverId]);

  if (error) {
    return (
      <p className="text-xs text-slate-400 dark:text-slate-500 mb-4">
        {t("restoration.unavailable")}
      </p>
    );
  }

  if (projects === null || projects.length === 0) return null;

  return (
    <div className="mb-5">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
        {t("restoration.title")}
      </h3>
      <div className="space-y-3">
        {projects.map((project) => (
          <ProjectCard key={project.id} project={project} />
        ))}
      </div>
    </div>
  );
}

function ProjectCard({ project }: { project: RestorationProject }) {
  const { t, language } = useLanguage();

  const name = language === "ta" ? (project.name_ta ?? project.name) : project.name;
  const summary = language === "ta" ? (project.summary_ta ?? project.summary) : project.summary;

  // Build key facts line: area/length, budget, dates
  const facts: string[] = [];
  if (project.area_acres) facts.push(`${project.area_acres} acres`);
  if (project.length_km) facts.push(`${project.length_km} km`);
  if (project.budget_display) facts.push(project.budget_display);
  if (project.started && project.completed) {
    facts.push(`${project.started}-${project.completed}`);
  } else if (project.started) {
    facts.push(`${project.started}-`);
  }

  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3">
      {/* Status + category */}
      <div className="flex items-center gap-2 text-xs mb-1">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${STATUS_DOT_COLORS[project.status]}`} />
        <span className={STATUS_COLORS[project.status]}>
          {t(STATUS_I18N[project.status])}
        </span>
        <span className="text-slate-400 dark:text-slate-500">
          {t(CATEGORY_I18N[project.category])}
        </span>
      </div>

      {/* Name */}
      <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug">
        {name}
      </p>

      {/* Location */}
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
        {project.location_name}
      </p>

      {/* Key facts */}
      {facts.length > 0 && (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
          {facts.join(" · ")}
        </p>
      )}

      {/* Summary */}
      <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
        {summary}
      </p>

      {/* Metrics */}
      {project.metrics.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {project.metrics.map((m, i) => {
            const label = language === "ta" ? (m.label_ta ?? m.label) : m.label;
            return (
              <span
                key={i}
                className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-slate-700 px-2 py-0.5 text-[11px] text-slate-600 dark:text-slate-300"
              >
                <span className="font-medium">{label}:</span> {m.value}
              </span>
            );
          })}
        </div>
      )}

      {/* Source link */}
      <div className="mt-2">
        <a
          href={project.source_url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[11px] text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline"
        >
          {t("restoration.source")} &rarr;
        </a>
      </div>
    </div>
  );
}
