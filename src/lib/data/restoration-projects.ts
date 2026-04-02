import type { RestorationProject } from "@/types/restoration-projects";

let cached: RestorationProject[] | null = null;
let fetchPromise: Promise<RestorationProject[]> | null = null;

export function getRestorationProjects(): Promise<RestorationProject[]> {
  if (cached) return Promise.resolve(cached);
  if (!fetchPromise) {
    fetchPromise = fetch("/data/restoration-projects.json")
      .then((r) => r.json())
      .then((data: { projects: RestorationProject[] }) => {
        cached = data.projects;
        return cached;
      })
      .catch((err) => {
        fetchPromise = null;
        throw err;
      });
  }
  return fetchPromise;
}
