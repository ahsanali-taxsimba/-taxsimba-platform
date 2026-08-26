/**
 * Parity with the Python `seed.py` bootstrap: unique indexes, the Self Assessment service
 * row and the demo accounts that a fresh (empty) database starts with.
 */
import { randomUUID } from "crypto";

import { col, Doc } from "../db/mongo";
import { hashPassword } from "../services/auth";

import { isoPlusDays, nowIso, STATUS_META } from "./workflow";

function user(
  email: string,
  name: string,
  role: string,
  password: string,
  extra: Doc = {},
): Doc {
  return {
    id: randomUUID(),
    email: email.toLowerCase(),
    name,
    role,
    password_hash: hashPassword(password),
    is_active: true,
    created_at: nowIso(),
    ...extra,
  };
}

export async function seed(): Promise<void> {
  await col("users").createIndex({ email: 1 }, { unique: true });
  await col("cases").createIndex({ id: 1 });
  try {
    await col("cases").createIndex({ case_ref: 1 }, { unique: true });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(`case_ref unique index not applied: ${String(e)}`);
  }
  await col("services").createIndex({ code: 1 }, { unique: true });

  await col("services").updateOne(
    { code: "SELF_ASSESSMENT" },
    {
      $setOnInsert: {
        id: randomUUID(),
        code: "SELF_ASSESSMENT",
        name: "Self Assessment",
        price: 199.0,
        is_active: true,
        created_at: nowIso(),
      },
    },
    { upsert: true },
  );

  if ((await col("users").countDocuments({})) > 0) return;

  const users = [
    user("superadmin@taxsimba.co.uk", "Sarah Owusu", "SUPER_ADMIN", "Super@123"),
    user(
      process.env.ADMIN_EMAIL ?? "admin@taxsimba.co.uk",
      "Daniel Mensah",
      "ADMIN",
      process.env.ADMIN_PASSWORD ?? "Admin@123",
    ),
    user("accountant.a@taxsimba.co.uk", "Amara Boateng", "ACCOUNTANT", "Account@123"),
    user("accountant.b@taxsimba.co.uk", "Ben Carter", "ACCOUNTANT", "Account@123"),
    user("clienta@example.com", "Client A", "CLIENT", "Client@123", {
      phone: "+44 7700 900111",
      utr: "1234567890",
      address: "12 Oak Lane, London",
    }),
    user("clientb@example.com", "Client B", "CLIENT", "Client@123", {
      phone: "+44 7700 900222",
      utr: "9876543210",
      address: "5 Elm Road, Manchester",
    }),
  ];
  await col("users").insertMany(users.map((u) => ({ ...u })));

  const byEmail = new Map(users.map((u) => [u.email as string, u]));

  for (const email of ["accountant.a@taxsimba.co.uk", "accountant.b@taxsimba.co.uk"]) {
    const staff = byEmail.get(email) as Doc;
    await col("accountant_profiles").insertOne({
      id: randomUUID(),
      user_id: staff.id,
      name: staff.name,
      email: staff.email,
      specialisms: ["SELF_ASSESSMENT"],
      capacity: 15,
      is_active: true,
      created_at: nowIso(),
    });
  }

  const clientUsers = [
    byEmail.get("clienta@example.com") as Doc,
    byEmail.get("clientb@example.com") as Doc,
  ];
  for (const u of clientUsers) {
    await col("clients").insertOne({
      id: randomUUID(),
      user_id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone ?? null,
      utr: u.utr ?? null,
      created_at: nowIso(),
    });
  }

  let seq = 1001;
  for (const u of clientUsers) {
    const client = await col("clients").findOne({ user_id: u.id });
    const [stage, nextAction, owner] = STATUS_META.AWAITING_ASSIGNMENT;
    await col("cases").insertOne({
      id: randomUUID(),
      case_ref: `SA-${seq}`,
      client_id: client?.id ?? null,
      client_user_id: u.id,
      client_name: u.name,
      service_type: "SELF_ASSESSMENT",
      tax_year: "2024/25",
      assigned_accountant_id: null,
      assigned_accountant_name: null,
      admin_reviewer_id: null,
      admin_reviewer_name: null,
      status: "AWAITING_ASSIGNMENT",
      current_stage: stage,
      next_action: nextAction,
      next_action_owner: owner,
      priority: "MEDIUM",
      internal_deadline: isoPlusDays(14),
      external_deadline: "2026-01-31T23:59:00+00:00",
      internal_instructions: null,
      waiting_reason: null,
      approved_version_id: null,
      created_at: nowIso(),
      last_updated: nowIso(),
    });
    seq += 1;
  }

  for await (const c of col("cases").find({})) {
    await col("activity_logs").insertOne({
      id: randomUUID(),
      case_id: c.id,
      action: "Case created",
      user_id: null,
      user_name: "System",
      role: "SYSTEM",
      meta: { status: "AWAITING_ASSIGNMENT" },
      created_at: nowIso(),
    });
  }
}
