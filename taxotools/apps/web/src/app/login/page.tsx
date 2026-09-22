"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("demo@taxotools.com");
  const [password, setPassword] = useState("TaxotoolsDemo1!");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Login failed");
      return;
    }
    router.push("/app");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-grid-fade px-4">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-md animate-rise rounded-2xl border border-ink-100 bg-white p-8 shadow-sm"
      >
        <Link href="/" className="font-display text-2xl font-semibold text-ink-950">
          Taxotools
        </Link>
        <h1 className="mt-4 text-xl font-semibold text-ink-900">Sign in</h1>
        <p className="mt-1 text-sm text-ink-500">Access your SEO & AEO workspaces.</p>

        <label className="mt-6 block text-sm font-medium text-ink-700">
          Email
          <input
            className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-2 outline-none ring-accent focus:ring-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="mt-4 block text-sm font-medium text-ink-700">
          Password
          <input
            className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-2 outline-none ring-accent focus:ring-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
        <p className="mt-4 text-center text-sm text-ink-500">
          New here?{" "}
          <Link href="/register" className="font-medium text-accent-dark">
            Create account
          </Link>
        </p>
      </form>
    </main>
  );
}
