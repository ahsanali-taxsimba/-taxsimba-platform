import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { listKeywords } from "@/server/services/keyword.service";
import { KeywordsPanel } from "@/components/KeywordsPanel";

export default async function KeywordsPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  let user;
  try {
    user = await requireUser();
  } catch {
    redirect("/login");
  }
  const { siteId } = await params;
  const keywords = await listKeywords(user.id, siteId);

  return (
    <div className="animate-rise space-y-6">
      <div>
        <p className="text-sm text-ink-500">
          <Link href={`/app/sites/${siteId}`} className="hover:text-accent-dark">
            Site
          </Link>{" "}
          / Keywords
        </p>
        <h1 className="font-display text-3xl font-semibold">Keyword intelligence</h1>
        <p className="text-ink-500">Volume, difficulty, intent, ranks, and AI Overview flags</p>
      </div>
      <KeywordsPanel siteId={siteId} initial={keywords} />
    </div>
  );
}
