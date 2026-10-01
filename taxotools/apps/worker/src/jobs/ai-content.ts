import { prisma } from "@taxotools/database";

function generateArticle(input: Record<string, unknown>) {
  const keyword = String(input.keyword || "seo");
  const title = String(input.title || `The Complete Guide to ${keyword}`);
  return {
    title,
    metaTitle: `${title} | Taxotools`.slice(0, 60),
    metaDescription: `Master ${keyword} with SEO + AI visibility tactics.`.slice(0, 155),
    outline: [
      { level: "h2", text: `What is ${keyword}?` },
      { level: "h2", text: `How to improve ${keyword}` },
      { level: "h2", text: "FAQs" },
    ],
    bodyMarkdown: `# ${title}\n\nActionable guidance on ${keyword} for search and AI engines.\n`,
    faq: [
      { q: `What is ${keyword}?`, a: `${keyword} improves discovery across search and AI answers.` },
    ],
    schemaJsonLd: {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: title,
    },
    provider: process.env.OPENAI_API_KEY ? "openai" : "stub",
  };
}

export async function processAIContent(payload: Record<string, unknown>) {
  const aiJobId = String(payload.aiJobId);
  const type = String(payload.type || "ARTICLE");
  const input = (payload.input || {}) as Record<string, unknown>;

  await prisma.aIJob.update({
    where: { id: aiJobId },
    data: { status: "RUNNING", startedAt: new Date() },
  });

  let output: Record<string, unknown>;
  switch (type) {
    case "OUTLINE":
      output = { outline: generateArticle(input).outline };
      break;
    case "META":
      output = {
        metaTitle: generateArticle(input).metaTitle,
        metaDescription: generateArticle(input).metaDescription,
      };
      break;
    case "FAQ":
      output = { faq: generateArticle(input).faq };
      break;
    case "SCHEMA":
      output = { schemaJsonLd: generateArticle(input).schemaJsonLd };
      break;
    case "SOCIAL_POST":
      output = {
        posts: [
          {
            platform: "LINKEDIN",
            content: `New insights on ${input.keyword || "SEO"} — track ranks and AI citations in Taxotools.`,
          },
        ],
      };
      break;
    default:
      output = generateArticle(input);
  }

  // Optional: call OpenAI/Anthropic when keys present
  if (process.env.OPENAI_API_KEY && type === "ARTICLE") {
    output.providerNote =
      "OPENAI_API_KEY detected — wire chat.completions here for production generation.";
  }

  const job = await prisma.aIJob.update({
    where: { id: aiJobId },
    data: {
      status: "COMPLETED",
      outputJson: output,
      finishedAt: new Date(),
    },
  });

  return { aiJobId: job.id, type };
}
