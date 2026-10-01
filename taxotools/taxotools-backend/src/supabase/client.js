import { createClient } from "@supabase/supabase-js";
import { assertSupabase, env } from "../utils/env.js";

let client;

export function getSupabase() {
  assertSupabase();
  if (!client) {
    client = createClient(env.supabaseUrl, env.serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return client;
}
