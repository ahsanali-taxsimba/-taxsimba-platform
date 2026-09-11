import ArticleDetailsPage from "./page.client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: PageProps) {
  const { id } = await params;
  return <ArticleDetailsPage id={id} />;
}
