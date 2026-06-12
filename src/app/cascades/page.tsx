import { redirect } from "next/navigation";

// The catchment atlas now lives as the "Catchments" view mode on the
// water-bodies page. Keep /cascades as a permanent redirect for old links.
export default function ChennaiCascadesPage() {
  redirect("/water-bodies?mode=catchments");
}
