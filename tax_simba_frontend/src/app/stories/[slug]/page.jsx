import { notFound } from "next/navigation";
import stories from "../../../../taxsimba-stories/stories.json";
import { detail } from "../../../../taxsimba-stories/render.mjs";
import "../../../../taxsimba-stories/stories.css";

export const dynamicParams = false;

const renderOptions = {
  includeChrome: false,
  siteBase: "",
  saPackagesPath: "/pricing#pricing-section",
  mtdPackagesPath: "/mtd-information#pricing-section",
};

export function generateStaticParams() {
  return stories.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const story = stories.find((s) => s.slug === slug);
  return {
    title: story ? `${story.title} | TaxSimba` : "Story not found | TaxSimba",
    description: story?.problem,
    robots: { index: false, follow: false },
  };
}

export default async function StoryPage({ params }) {
  const { slug } = await params;
  const story = stories.find((s) => s.slug === slug);
  if (!story) notFound();
  return (
    <div
      dangerouslySetInnerHTML={{
        __html: detail(story, stories, renderOptions),
      }}
    />
  );
}
