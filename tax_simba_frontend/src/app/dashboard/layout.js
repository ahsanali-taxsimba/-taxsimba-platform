import { getServerSession } from "next-auth";
import { authOptions } from "../frontend-api/auth/[...nextauth]/route";
import DashboardLayoutClient from "./_components/DashboardLayoutClient";

export default async function DashboardLayout({ children }) {
    const serverSession = await getServerSession(authOptions);
    return (
        <DashboardLayoutClient serverSession={serverSession}>
            {children}
        </DashboardLayoutClient>
    );
}
