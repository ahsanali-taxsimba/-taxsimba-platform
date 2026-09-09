import { getServerSession } from "next-auth";
import MyTaxReturnClient from "./page.client"
import { authOptions } from "../frontend-api/auth/[...nextauth]/route";

const page = async () => {
  const serverSession = await getServerSession(authOptions);
  return (
    <>
      <MyTaxReturnClient serverSession={serverSession} />
    </>
  )
}

export default page
