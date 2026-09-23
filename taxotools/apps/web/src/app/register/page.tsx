"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [accountName, setAccountName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password, accountName: accountName || undefined }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error || "Registration failed");
      return;
    }
    router.push("/onboarding");
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
        <h1 className="mt-4 text-xl font-semibold text-ink-900">Start your trial</h1>
        <p className="mt-1 text-sm text-ink-500">14-day Starter plan. No card required in demo.</p>

        <label className="mt-6 block text-sm font-medium">
          Full name
          <input
            className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-2 outline-none ring-accent focus:ring-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Work email
          <input
            type="email"
            className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-2 outline-none ring-accent focus:ring-2"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Password
          <input
            type="password"
            className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-2 outline-none ring-accent focus:ring-2"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
        </label>
        <label className="mt-4 block text-sm font-medium">
          Company / account name
          <input
            className="mt-1 w-full rounded-lg border border-ink-100 px-3 py-2 outline-none ring-accent focus:ring-2"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            placeholder="Acme Marketing"
          />
        </label>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="mt-6 w-full rounded-lg bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accent-dark disabled:opacity-60"
        >
          {loading ? "Creating…" : "Create account"}
        </button>
        <p className="mt-4 text-center text-sm text-ink-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-accent-dark">
            Sign in
          </Link>
        </p>
      </form>
    </main>
  );
}
