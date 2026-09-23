import { redirect } from "next/navigation";
import { TOOLKIT_GROUPS } from "@taxotools/shared";

export default async function ToolsIndexPage({
  params,
}: {
  params: Promise<{ siteId: string }>;
}) {
  const { siteId } = await params;
  const first = TOOLKIT_GROUPS[0]?.tools[0];
  redirect(`/app/sites/${siteId}/tools/${first?.path || "keyword-research"}`);
}
