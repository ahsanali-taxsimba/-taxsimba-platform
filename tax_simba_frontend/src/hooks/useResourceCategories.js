"use client";

import { useEffect, useState } from "react";
import { useAxiosInstance } from "@/hooks/useAxiosInstance";

let cachedCategories = null;
let cachedError = null;
let fetchPromise = null;

const sortCategories = (categories) =>
  categories
    .slice()
    .sort(
      (a, b) =>
        (a?.displayOrder ?? Number.MAX_SAFE_INTEGER) -
        (b?.displayOrder ?? Number.MAX_SAFE_INTEGER)
    )
    .map((category) => ({
      ...category,
      subCategories: Array.isArray(category?.subCategories)
        ? [...category.subCategories].sort(
            (a, b) =>
              (a?.displayOrder ?? Number.MAX_SAFE_INTEGER) -
              (b?.displayOrder ?? Number.MAX_SAFE_INTEGER)
          )
        : [],
    }));

export const formatSlugToHref = (slug, category) => {
  if (!slug) return "/";
  if (category === "guides") return slug.startsWith("/") ? slug : `/${slug}`;
  return slug.startsWith("/") ? slug : `/${category}/${slug}`;
};
export const formatSlugToHrefFooter = (slug) => {
  if (!slug) return "/";
  return slug.startsWith("/") ? slug : `/${slug}`;
};

// Shared hook to fetch resource categories once and reuse across components
export const useResourceCategories = () => {
  const { get } = useAxiosInstance();
  const [data, setData] = useState(cachedCategories);
  const [error, setError] = useState(cachedError);
  const [loading, setLoading] = useState(!cachedCategories && !cachedError);

  useEffect(() => {
    if (cachedCategories || cachedError) {
      return;
    }

    if (!fetchPromise) {
      fetchPromise = get("resources/categories")
        .then((response) => {
          const categories = Array.isArray(response?.data?.data)
            ? sortCategories(response.data.data)
            : [];
          cachedCategories = categories;
          return categories;
        })
        .catch((err) => {
          cachedError = err;
          throw err;
        })
        .finally(() => {
          fetchPromise = null;
        });
    }

    fetchPromise
      .then((categories) => {
        setData(categories);
        setLoading(false);
        setError(null);
      })
      .catch((err) => {
        setError(err);
        setData([]);
        setLoading(false);
      });
  }, [get]);

  return { data: data || [], loading, error };
};
