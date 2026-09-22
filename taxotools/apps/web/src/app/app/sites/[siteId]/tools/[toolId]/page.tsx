import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { findTool } from "@taxotools/shared";
import { ToolWorkbench } from "@/components/ToolWorkbench";

export default async function ToolPage({
  params,
}: {
  params: Promise<{ siteId: string; toolId: string }>;
}) {
  try {
    await requireUser();
  } catch {
    redirect("/login");
  }
  const { siteId, toolId } = await params;
  const found = findTool(toolId);
  if (!found) notFound();

  return (
    <ToolWorkbench
      siteId={siteId}
      toolId={found.tool.id}
      toolName={found.tool.name}
      description={found.group.description}
    />
  );
}
