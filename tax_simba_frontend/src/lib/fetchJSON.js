import { notFound } from "next/navigation";

export default async function fetchJSON(url, opts = {}) {
  const { timeoutMs = 15000, ...init } = opts;
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      next: {
        revalidate:
          init?.next && typeof init.next.revalidate === 'number'
            ? init.next.revalidate
            : 60,
      },
    });

    const ct = res.headers.get('content-type') || '';
    const raw = await res.text();

    const looksJson = raw && /^[\[{]/.test(raw.trim());
    let data = raw;
    if (/application\/json/i.test(ct) || looksJson) {
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch (err) {
        throw new Error(
          `JSON parse failed (status ${res.status}). ct=\"${ct}\". Head: ${raw.slice(0, 200)}`
        );
      }
    }

    if (!res.ok) {
      if(res.status === 404){
        notFound();
      }
      const snippet =
        typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data).slice(0, 200);
      throw new Error(`HTTP ${res.status} ${res.statusText}. Body: ${snippet}`);
    }

    return data;
  } finally {
    clearTimeout(t);
  }
}
