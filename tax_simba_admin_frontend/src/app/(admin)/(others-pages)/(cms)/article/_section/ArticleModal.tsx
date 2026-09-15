"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import RichTextEditor from "@/components/cms/RichTextEditor";

import {
  createArticle,
  updateArticle,
  type Article,
  type ArticleCreatePayload,
  type ArticleUpdatePayload,
} from "@/lib/cms/article";

import { getCategories, type Category } from "@/lib/cms/category";
import { getSubCategoriesByCategory, type SubCategory } from "@/lib/cms/subcategory";

interface Props {
  // If you want edit page, pass editing from parent/page loader
  editing?: Article | null;

  // Optional: after save callback
  onSaved?: () => void | Promise<void>;
}

export default function ArticleModal({ editing, onSaved }: Props) {
  const router = useRouter();
  const isEdit = useMemo(() => !!editing, [editing]);

  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);

  const [categoryId, setCategoryId] = useState<string>("");
  const [subCategoryId, setSubCategoryId] = useState<string>("");
  const [type, setType] = useState<"MTD" | "TaxSimba">("TaxSimba");

  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [authorName, setAuthorName] = useState("");

  const [metaTitle, setMetaTitle] = useState("");
  const [metaDescription, setMetaDescription] = useState("");
  const [metaKeywords, setMetaKeywords] = useState("");
  const [displayOrder, setDisplayOrder] = useState<string>("0");

  const [isPublished, setIsPublished] = useState(true);
  const [isFeatured, setIsFeatured] = useState(false);

  const [featuredImage, setFeaturedImage] = useState<File | null>(null);
  const [images, setImages] = useState<File[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => {
    setCategoryId("");
    setSubCategoryId("");
    setType("TaxSimba");
    setTitle("");
    setExcerpt("");
    setContent("");
    setAuthorName("");
    setMetaTitle("");
    setMetaDescription("");
    setMetaKeywords("");
    setDisplayOrder("0");
    setIsPublished(true);
    setIsFeatured(false);
    setFeaturedImage(null);
    setImages([]);
    setError(null);
    setSubCategories([]);
  };

  // Load categories once
  useEffect(() => {
    (async () => {
      try {
        const res = await getCategories({
          page: 1,
          limit: 200,
          sortBy: "displayOrder",
          sortOrder: "ASC",
        });

        // ✅ ApiResponse<CategoryListResponse>
        const list = res.data?.categories;
        setCategories(Array.isArray(list) ? list : []);
      } catch {
        setCategories([]);
      }
    })();
  }, []);

  // Load subcategories when category changes
  useEffect(() => {
    const cid = Number(categoryId);
  
    if (!cid) {
      setSubCategories([]);
      setSubCategoryId("");
      return;
    }
  
    (async () => {
      try {
        const res = await getSubCategoriesByCategory(cid);
  
        // ✅ Your API returns: { data: { category, subCategories: [] } }
        const list = res?.data?.subCategories ?? [];
  
        setSubCategories(Array.isArray(list) ? list : []);
      } catch (e) {
        setSubCategories([]);
      }
    })();
  }, [categoryId]);
  

  // Prefill on edit / reset on create
  useEffect(() => {
    if (editing) {
      setCategoryId(editing.categoryId ? String(editing.categoryId) : "");
      setSubCategoryId(editing.subCategoryId ? String(editing.subCategoryId) : "");
      setType(editing.type ?? "TaxSimba");

      setTitle(editing.title ?? "");
      setExcerpt(editing.excerpt ?? "");
      setContent(editing.content ?? "");

      setMetaTitle(editing.metaTitle ?? "");
      setMetaDescription(editing.metaDescription ?? "");
      setMetaKeywords(editing.metaKeywords ?? "");
      setDisplayOrder(String(editing.displayOrder ?? 0));

      setIsPublished(!!editing.isPublished);
      setIsFeatured(!!editing.isFeatured);
      setAuthorName(editing.authorName ?? "");

      setFeaturedImage(null);
      setImages([]);
      setError(null);
    } else {
      resetForm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  const handleImagesChange = (files: FileList | null) => {
    if (!files) return;
    setImages(Array.from(files));
  };

  const handleCancel = () => {
    if (loading) return;
    router.back();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!categoryId) return setError("Category is required");
    if (!title.trim()) return setError("Title is required");
    if (!content.trim()) return setError("Content is required");

    try {
      setLoading(true);
      setError(null);

      const basePayload = {
        categoryId: Number(categoryId),
        subCategoryId: subCategoryId ? Number(subCategoryId) : undefined,
        type,

        title: title.trim(),
        excerpt: excerpt.trim() || undefined,
        content,
        authorName: authorName.trim() || undefined,

        metaTitle: metaTitle.trim() || undefined,
        metaDescription: metaDescription.trim() || undefined,
        metaKeywords: metaKeywords.trim() || undefined,

        displayOrder: Number(displayOrder) || 0,
        isFeatured,
        isPublished,

        featuredImage: featuredImage ?? undefined,
        images: images.length ? images : undefined,
      };

      if (isEdit && editing) {
        const updatePayload: ArticleUpdatePayload = basePayload;
        await updateArticle(editing.id, updatePayload);
      } else {
        const createPayload: ArticleCreatePayload = basePayload as ArticleCreatePayload;
        await createArticle(createPayload);
      }

      if (onSaved) await onSaved();
      router.push("/article"); // ✅ adjust to your listing route
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || "Failed to save article");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-semibold">
            {isEdit ? "Edit Article" : "Create Article"}
          </h1>
          <p className="text-sm text-gray-500">
            Fill the details below and save.
          </p>
        </div>

      
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Form body */}
      <form id="article-form" onSubmit={handleSubmit} className="space-y-6">
        {/* Main grid */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          {/* Left: main content */}
          <div className="lg:col-span-8 space-y-6">
            {/* Category / SubCategory */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">
                    Category <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                  >
                    <option value="">Select category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">
                    Type <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as "MTD" | "TaxSimba")}
                    className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                  >
                    <option value="TaxSimba">TaxSimba</option>
                    <option value="MTD">MTD</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium">SubCategory</label>
                  <select
                    value={subCategoryId}
                    onChange={(e) => setSubCategoryId(e.target.value)}
                    className="mt-1 h-11 w-full rounded-lg border border-gray-200 bg-white px-3 text-sm"
                    disabled={!categoryId}
                  >
                    <option value="">Select subcategory</option>
                    {subCategories.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Title + Excerpt */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
              <div>
                <label className="text-sm font-medium">
                  Title <span className="text-red-500">*</span>
                </label>
                <input
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter article title"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Excerpt</label>
                <textarea
                  rows={3}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                  value={excerpt}
                  onChange={(e) => setExcerpt(e.target.value)}
                  placeholder="Short summary (optional)"
                />
              </div>
            </div>

            {/* Content */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <label className="mb-2 block text-sm font-medium">
                Content <span className="text-red-500">*</span>
              </label>
              <RichTextEditor
                value={content}
                onChange={setContent}
                placeholder="Write article content here..."
                minHeightClassName="min-h-[360px]"
              />
            </div>

            {/* SEO */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">SEO</h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Meta Title</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-sm font-medium">Meta Keywords</label>
                  <input
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    value={metaKeywords}
                    onChange={(e) => setMetaKeywords(e.target.value)}
                    placeholder="comma,separated,keywords"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="text-sm font-medium">Meta Description</label>
                  <textarea
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    value={metaDescription}
                    onChange={(e) => setMetaDescription(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right: sidebar */}
          <div className="lg:col-span-4 space-y-6">
            {/* Publish settings */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Settings</h3>

              <div>
                <label className="text-sm font-medium">Display Order</label>
                <input
                  type="number"
                  min={0}
                  className="mt-1 h-11 w-full rounded-lg border border-gray-200 px-3 text-sm"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                />
              </div>
              <div className="flex gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isPublished}
                  onChange={(e) => setIsPublished(e.target.checked)}
                />
                <span className="ms-2">Published</span>
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isFeatured}
                  onChange={(e) => setIsFeatured(e.target.checked)}
                />
                <span className="ms-2">Featured</span>
              </label>
            </div>
              
            </div>

            {/* Images */}
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-4">
              <h3 className="text-sm font-semibold text-gray-700">Images</h3>

              <div>
                <label className="text-sm font-medium">Featured Image</label>
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2 block w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2"
                  onChange={(e) => setFeaturedImage(e.target.files?.[0] ?? null)}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Gallery Images</label>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="mt-2 block w-full text-sm bg-white border border-gray-200 rounded-lg px-3 py-2"
                  onChange={(e) => handleImagesChange(e.target.files)}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Sticky bottom action bar */}
        <div className="sticky bottom-0 z-10 -mx-4 md:-mx-6 border-t border-gray-200 bg-white/90 backdrop-blur px-4 md:px-6 py-3">
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              className="h-10 rounded-lg border border-gray-200 bg-white px-4 text-sm hover:bg-gray-50"
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="h-10 rounded-lg bg-[#37a267] px-4 text-sm text-white disabled:opacity-60"
            >
              {loading ? "Saving..." : isEdit ? "Update Article" : "Create Article"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
