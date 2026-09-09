import ServiceFormPage from "../../_section/ServiceCreateModal";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};



export default async function Page({ params }: PageProps) {
  const { id } = await params;

  return (
    <ServiceFormPage
      serviceId={id}
      redirectTo="/service"
    />
  );
}
