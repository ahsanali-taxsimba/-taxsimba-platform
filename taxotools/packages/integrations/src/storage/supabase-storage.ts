import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const STORAGE_BUCKETS = {
  reports: "reports",
  crawls: "crawls",
  uploads: "uploads",
} as const;

export type StorageBucket = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

export type UploadResult = {
  bucket: StorageBucket;
  path: string;
  /** supabase://bucket/path — stored in DB */
  storageKey: string;
  bytes: number;
  publicUrl: string | null;
  mode: "live" | "skipped";
  error?: string;
};

let client: SupabaseClient | null = null;

export function isSupabaseStorageConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
  );
}

export function getSupabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !key) {
    throw new Error("Supabase Storage is not configured (URL / service role key missing)");
  }
  if (!client) {
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}

export function storageKeyFor(bucket: StorageBucket, path: string): string {
  return `supabase://${bucket}/${path.replace(/^\//, "")}`;
}

export function parseStorageKey(storageKey: string): { bucket: string; path: string } | null {
  const m = /^supabase:\/\/([^/]+)\/(.+)$/.exec(storageKey);
  if (!m) return null;
  return { bucket: m[1], path: m[2] };
}

/**
 * Upload bytes/text to a private Supabase Storage bucket.
 * Returns a skipped result (no throw) when Storage env is missing — demos still work.
 */
export async function uploadToBucket(params: {
  bucket: StorageBucket;
  path: string;
  body: string | Uint8Array | Buffer;
  contentType?: string;
  upsert?: boolean;
}): Promise<UploadResult> {
  const path = params.path.replace(/^\//, "");
  const bytes =
    typeof params.body === "string"
      ? Buffer.byteLength(params.body, "utf8")
      : params.body.byteLength;

  if (!isSupabaseStorageConfigured()) {
    return {
      bucket: params.bucket,
      path,
      storageKey: storageKeyFor(params.bucket, path),
      bytes,
      publicUrl: null,
      mode: "skipped",
      error: "Supabase Storage env not set",
    };
  }

  try {
    const supabase = getSupabaseAdmin();
    const { error } = await supabase.storage.from(params.bucket).upload(path, params.body, {
      contentType: params.contentType || "application/octet-stream",
      upsert: params.upsert ?? true,
    });

    if (error) {
      return {
        bucket: params.bucket,
        path,
        storageKey: storageKeyFor(params.bucket, path),
        bytes,
        publicUrl: null,
        mode: "skipped",
        error: error.message,
      };
    }

    // Private buckets: publicUrl may 403; still useful as a reference path
    const { data } = supabase.storage.from(params.bucket).getPublicUrl(path);

    return {
      bucket: params.bucket,
      path,
      storageKey: storageKeyFor(params.bucket, path),
      bytes,
      publicUrl: data.publicUrl || null,
      mode: "live",
    };
  } catch (e) {
    return {
      bucket: params.bucket,
      path,
      storageKey: storageKeyFor(params.bucket, path),
      bytes,
      publicUrl: null,
      mode: "skipped",
      error: e instanceof Error ? e.message : "upload failed",
    };
  }
}

export async function createSignedDownloadUrl(
  storageKey: string,
  expiresInSeconds = 3600,
): Promise<string | null> {
  const parsed = parseStorageKey(storageKey);
  if (!parsed || !isSupabaseStorageConfigured()) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase.storage
    .from(parsed.bucket)
    .createSignedUrl(parsed.path, expiresInSeconds);
  if (error) return null;
  return data.signedUrl;
}

export async function uploadReportHtml(reportId: string, html: string) {
  return uploadToBucket({
    bucket: STORAGE_BUCKETS.reports,
    path: `${reportId}.html`,
    body: html,
    contentType: "text/html; charset=utf-8",
  });
}

export async function uploadCrawlJsonl(siteId: string, runId: string, jsonl: string) {
  return uploadToBucket({
    bucket: STORAGE_BUCKETS.crawls,
    path: `${siteId}/${runId}.jsonl`,
    body: jsonl,
    contentType: "application/x-ndjson",
  });
}

export async function uploadUserFile(
  accountOrSiteId: string,
  filename: string,
  body: string | Uint8Array | Buffer,
  contentType?: string,
) {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return uploadToBucket({
    bucket: STORAGE_BUCKETS.uploads,
    path: `${accountOrSiteId}/${Date.now()}-${safe}`,
    body,
    contentType: contentType || "application/octet-stream",
  });
}
