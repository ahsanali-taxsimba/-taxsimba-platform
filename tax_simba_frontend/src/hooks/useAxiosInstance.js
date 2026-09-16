"use client";

import axios from "axios";
import { useCallback, useMemo } from "react";

// Reusable axios instance hook with helpers for common HTTP verbs
export const useAxiosInstance = () => {
  const axiosInstance = useMemo(
    () =>
      axios.create({
        baseURL: process.env.NEXT_PUBLIC_API_URL,
        headers: {
          "Content-Type": "application/json",
        },
      }),
    []
  );

  const get = useCallback(
    (url, config = {}) => axiosInstance.get(url, config),
    [axiosInstance]
  );
  const post = useCallback(
    (url, data, config = {}) => axiosInstance.post(url, data, config),
    [axiosInstance]
  );
  const put = useCallback(
    (url, data, config = {}) => axiosInstance.put(url, data, config),
    [axiosInstance]
  );
  const del = useCallback(
    (url, config = {}) => axiosInstance.delete(url, config),
    [axiosInstance]
  );

  return { axiosInstance, get, post, put, del };
};
