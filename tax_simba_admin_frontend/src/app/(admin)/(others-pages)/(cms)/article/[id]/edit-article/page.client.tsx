"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ArticleModal from "../../_section/ArticleModal";
import { getArticleById, type Article } from "@/lib/cms/article";

export default function EditArticlePage() {
  const params = useParams();
  const id = params?.id as string;

  const [editing, setEditing] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await getArticleById(id);
        const api = (res as any)?.data?.data ?? (res as any)?.data ?? res;
        setEditing(api as Article);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="p-6">Loading...</div>;

  return <ArticleModal editing={editing} />;
}
