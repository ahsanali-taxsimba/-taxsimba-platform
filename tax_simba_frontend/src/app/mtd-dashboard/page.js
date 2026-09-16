import { getServerSession } from "next-auth";
import { authOptions } from "../frontend-api/auth/[...nextauth]/route";
import MtdDashboardClient from "./page.client";

export const metadata = {
    title: "MTD Dashboard | TaxSimba",
};

export default async function MtdDashboardPage() {
    const serverSession = await getServerSession(authOptions);
    return <MtdDashboardClient serverSession={serverSession} />;
}
