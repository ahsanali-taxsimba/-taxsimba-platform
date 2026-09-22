"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

type Me = {
  account?: {
    workspaces: { id: string; name: string }[];
  } | null;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("https://");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) router.push("/login");
        else setMe(d);
      });
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const workspaceId = me?.account?.workspaces?.[0]?.id;
    if (!workspaceId) {
      setError("No workspace found. Please register again.");
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetch("/api/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, name, url }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Could not add site");
      return;
    }
    router.push(`/app/sites/${data.site.id}`);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-grid-fade px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-lg animate-rise rounded-2xl border border-ink-100 bg-white p-8 shadow-sm"
      >
        <Link href="/app" className="font-display text-2xl font-semibold">
          Taxotools
        </Link>
        <h1 className="mt-4 text-xl font-semibold">Add your first site</h1>
        <p className="mt-1 text-sm text-ink-500">
          We&apos;ll attach keywords, crawls, and AEO scans to this project.
        </p>

        <label className="mt-6 block text-sm font-medium">
          Site name
          <input
            className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-2 outline-none ring-accent focus:ring-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Acme Blog"
            required
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Website URL
          <input
            className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-2 outline-none ring-accent focus:ring-2"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://acme.com"
            required
          />
        </label>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
        >
          {loading ? "Adding…" : "Continue to site dashboard"}
        </button>
      </form>
    </main>
  );
}
