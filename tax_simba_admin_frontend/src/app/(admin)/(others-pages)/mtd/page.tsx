"use client";

import React, { Suspense } from "react";
import AdminMtdOperationsPage from "./MtdOperationsClient";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-gray-500">Loading MTD operations…</div>}>
      <AdminMtdOperationsPage />
    </Suspense>
  );
}
