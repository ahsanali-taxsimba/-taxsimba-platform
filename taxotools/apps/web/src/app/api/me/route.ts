import { requireUser, getAccountContext } from "@/lib/auth";
import { usageSummary } from "@/server/services/usage.service";
import { jsonError, jsonOk } from "@/server/http";

export const preferredRegion = ["lhr1"];
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await requireUser();
    const account = await getAccountContext(user.id);
    const usage = account ? await usageSummary(account.id) : null;
    return jsonOk({
      user: { id: user.id, email: user.email, name: user.name },
      account,
      usage,
    });
  } catch (err) {
    return jsonError(err);
  }
}
