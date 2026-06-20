import { CityDashboard } from "./city-dashboard";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

// Re-fetch every 15 minutes (matches /api/reservoir cache TTL).
export const revalidate = 900;

export default async function CityHomePage({ params }: PageProps) {
  const { cityId } = await params;
  return <CityDashboard cityId={cityId} />;
}
