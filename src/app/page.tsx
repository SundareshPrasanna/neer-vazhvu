import { CityDashboard } from "./[cityId]/city-dashboard";

export const revalidate = 900; // ISR: revalidate every 15 minutes

export default async function Page() {
  return <CityDashboard cityId="chennai" />;
}
