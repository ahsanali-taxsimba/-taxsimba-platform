import { LeadDetail } from "@/components/LeadDetail";

type Props = { params: Promise<{ id: string }> };

export default async function LeadPage({ params }: Props) {
  const { id } = await params;
  return <LeadDetail id={id} />;
}
