import { NextResponse } from "next/server";
import { AuthError, ForbiddenError, LimitError } from "@/lib/auth";

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function jsonError(err: unknown) {
  if (err instanceof AuthError || err instanceof ForbiddenError || err instanceof LimitError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  const message = err instanceof Error ? err.message : "Internal error";
  return NextResponse.json({ error: message }, { status: 500 });
}
