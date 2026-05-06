import type { RestorationProject } from "@/types/restoration-projects";

const cache = new Map<string, RestorationProject[]>();
const inflight = new Map<string, Promise<RestorationProject[]>>();

/**
 * Load this city's restoration projects. Default cityId="chennai" for
 * backward compat - existing call sites that don't pass a cityId
 * still hit /data/restoration-projects.json. Other cities load
 * /data/restoration-projects-{cityId}.json. Returns [] when the
 * city's file doesn't exist (instead of throwing).
 */
export function getRestorationProjects(cityId: string = "chennai"): Promise<RestorationProject[]> {
  const cached = cache.get(cityId);
  if (cached) return Promise.resolve(cached);
  const existing = inflight.get(cityId);
  if (existing) return existing;
  const url =
    cityId === "chennai"
      ? "/data/restoration-projects.json"
      : `/data/restoration-projects-${cityId}.json`;
  const promise = fetch(url)
    .then((r) => {
      if (!r.ok) return { projects: [] as RestorationProject[] };
      return r.json() as Promise<{ projects: RestorationProject[] }>;
    })
    .then((data) => {
      const projects = data.projects ?? [];
      cache.set(cityId, projects);
      return projects;
    })
    .catch(() => {
      // Missing file -> empty list, don't throw.
      cache.set(cityId, []);
      return [];
    })
    .finally(() => {
      inflight.delete(cityId);
    });
  inflight.set(cityId, promise);
  return promise;
}
