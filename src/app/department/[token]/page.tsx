import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { DepartmentApp } from "@/components/sightings/department-app";
import { displayFont } from "@/components/sightings/display-font";
import { reportsEnabled } from "@/lib/sightings/auth";
import { findDepartment, linkSecret, verifyDepartmentToken } from "@/lib/sightings/departments";

/** Unlisted: reached only through a signed link handed to the department. No referrer, so the link never leaves in a request header. */
export const metadata: Metadata = {
  title: "Checked reports | Neer Vazhvu",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
};

export default async function DepartmentPage({ params }: { params: Promise<{ token: string }> }) {
  if (process.env.NEXT_PUBLIC_CITIZEN_REPORTS !== "on") notFound();
  const { token } = await params;
  const key = reportsEnabled() && linkSecret() ? verifyDepartmentToken(token) : null;
  if (!key) notFound();
  const department = findDepartment(key);
  return (
    <div className={displayFont.variable}>
      <DepartmentApp token={token} body={department?.body ?? null} acronym={department?.acronym ?? null} />
    </div>
  );
}
