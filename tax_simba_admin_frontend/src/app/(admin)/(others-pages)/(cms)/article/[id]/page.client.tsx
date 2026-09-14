"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getArticleById, type Article } from "@/lib/cms/article";

const Badge = ({ children }: { children: React.ReactNode }) => (
  <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700">
    {children}
  </span>
);

const Field = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="rounded-lg border border-gray-200 bg-white p-4">
    <div className="text-xs font-semibold text-gray-500">{label}</div>
    <div className="mt-1 text-sm text-gray-900">{value}</div>
  </div>
);

export default function ArticleDetailsPage({ id }: { id: string }) {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Article | null>(null);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setLoading(true);
        setError(null);

        const res = await getArticleById(Number(id));
        const api = res.data?.data ?? res.data;

        if (alive) setData(api);
      } catch (err: any) {
        if (alive) setError(err?.response?.data?.message || err?.message || "Failed to fetch article");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [id]);

  if (loading) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600">
          Loading article...
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 space-y-3">
        <div className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">
          {error || "Article not found."}
        </div>
        <button
          onClick={() => router.back()}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm hover:bg-gray-50"
        >
          Go back
        </button>
      </div>
    );
  }

  const publishedAt = (data as any)?.publishedAt;
  const createdAt = (data as any)?.createdAt;
  const updatedAt = (data as any)?.updatedAt;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-semibold">{data.title}</h1>
          <div className="flex flex-wrap gap-2">
            <Badge>ID: {data.id}</Badge>
            <Badge>Slug: {data.slug ?? "-"}</Badge>
            <Badge>Category: {(data as any)?.category?.name ?? data.categoryId}</Badge>
            <Badge>SubCategory: {(data as any)?.subCategory?.name ?? data.subCategoryId ?? "-"}</Badge>
            <Badge>Published: {data.isPublished ? "Yes" : "No"}</Badge>
            <Badge>Featured: {data.isFeatured ? "Yes" : "No"}</Badge>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => router.push(`/article/${data.id}/edit-article`)}
            className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm font-medium text-gray-800 hover:bg-gray-50"
          >
            Edit
          </button>
          <button
            onClick={() => router.back()}
            className="h-10 rounded-lg bg-[#37a267] px-4 text-sm font-medium text-white shadow-sm hover:bg-[#37a267]"
          >
            Back
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Meta Title" value={(data as any)?.metaTitle ?? "-"} />
        <Field label="Meta Description" value={(data as any)?.metaDescription ?? "-"} />
        <Field label="Meta Keywords" value={(data as any)?.metaKeywords ?? "-"} />
        <Field label="View Count" value={(data as any)?.viewCount ?? 0} />
        <Field label="Display Order" value={data.displayOrder ?? 0} />
        <Field
          label="Author"
          value={(data as any)?.author ? `${(data as any).author.name || ""} ${(data as any).author.surname || ""}`.trim() : (data as any)?.authorId ?? "-"}
        />
        <Field label="Published At" value={publishedAt ? new Date(publishedAt).toLocaleString() : "-"} />
        <Field label="Created At" value={createdAt ? new Date(createdAt).toLocaleString() : "-"} />
        <Field label="Updated At" value={updatedAt ? new Date(updatedAt).toLocaleString() : "-"} />
        <Field label="Featured Image" value={data.featuredImage ?? "-"} />
      </div>

      {/* Excerpt */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-xs font-semibold text-gray-500">Excerpt</div>
        <div className="mt-2 text-sm text-gray-900 whitespace-pre-wrap">
          {data.excerpt ?? "-"}
        </div>
      </div>

      {/* Content */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-xs font-semibold text-gray-500">Content</div>
        <div
          className="prose prose-sm mt-3 max-w-none"
          dangerouslySetInnerHTML={{ __html: data.content || "" }}
        />
      </div>

      {/* Images list */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <div className="text-xs font-semibold text-gray-500">Images</div>

        {Array.isArray((data as any).images) && (data as any).images.length ? (
          <ul className="mt-2 list-disc pl-5 text-sm">
            {(data as any).images.map((img: string, idx: number) => (
              <li key={idx} className="break-all">
                {img}
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-2 text-sm text-gray-700">-</div>
        )}
      </div>
    </div>
  );
}
