import { listEnabledPlaces } from "@/lib/cities";
import { CityDashboard } from "../city-dashboard";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

// Re-fetch every 15 minutes (matches /api/reservoir cache TTL).
export const revalidate = 900;

// Without this, Next renders [cityId] on every request and revalidate never
// applies. Prerendering the enabled cities means no visitor waits after a
// deploy, and a Supabase outage fails the build instead of shipping empty pages.
export function generateStaticParams(): { cityId: string }[] {
  return listEnabledPlaces().map((p) => ({ cityId: p.cityId }));
}

export default async function CityHomePage({ params }: PageProps) {
  const { cityId } = await params;
  return <CityDashboard cityId={cityId} />;
}
