"use client";

import { Suspense } from "react";
import { MyWardPage } from "@/components/my-ward/my-ward-page";

export default function MyWard() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-[60vh] text-slate-400">Loading...</div>}>
      <MyWardPage />
    </Suspense>
  );
}
