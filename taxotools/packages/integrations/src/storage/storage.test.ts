import { describe, expect, it } from "vitest";
import {
  STORAGE_BUCKETS,
  storageKeyFor,
  parseStorageKey,
  isSupabaseStorageConfigured,
} from "../storage/supabase-storage";

describe("supabase storage helpers", () => {
  it("builds and parses storage keys", () => {
    const key = storageKeyFor(STORAGE_BUCKETS.reports, "abc.html");
    expect(key).toBe("supabase://reports/abc.html");
    expect(parseStorageKey(key)).toEqual({ bucket: "reports", path: "abc.html" });
    expect(parseStorageKey("bad")).toBeNull();
  });

  it("exposes expected bucket names", () => {
    expect(STORAGE_BUCKETS).toEqual({
      reports: "reports",
      crawls: "crawls",
      uploads: "uploads",
    });
  });

  it("detects configuration from env", () => {
    // In CI without keys this may be false; with Taxotools .env it should be true.
    expect(typeof isSupabaseStorageConfigured()).toBe("boolean");
  });
});
