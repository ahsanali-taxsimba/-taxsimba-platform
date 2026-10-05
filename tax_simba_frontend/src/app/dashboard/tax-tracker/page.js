import { Suspense } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "../../frontend-api/auth/[...nextauth]/route";
import TaxTrackerPage from "./_components/TaxTrackerPage";
// This is the tax-tracker route, layout is inherited from /dashboard/layout.js

export const metadata = {
    title: "Tax Tracker | Dashboard",
};

export default async function TaxTrackerRoutePage() {
    const serverSession = await getServerSession(authOptions);
    return (
        <Suspense fallback={<p className="text-center p-5">Loading tax tracker…</p>}>
            <TaxTrackerPage serverSession={serverSession} />
        </Suspense>
    );
}
