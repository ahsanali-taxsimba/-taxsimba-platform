import { Db, MongoClient } from "mongodb";

import { required } from "../config/env";

export type Doc = Record<string, any>;

let client: MongoClient | null = null;
let database: Db | null = null;

export async function connect(): Promise<Db> {
  if (database) return database;
  client = new MongoClient(required("MONGO_URL"));
  await client.connect();
  database = client.db(required("DB_NAME"));
  return database;
}

export async function close(): Promise<void> {
  if (client) await client.close();
  client = null;
  database = null;
}

/** The database handle. `connect()` must have completed first (it does at boot). */
export function db(): Db {
  if (!database) throw new Error("Database not connected");
  return database;
}

export function col(name: string) {
  return db().collection(name);
}

/** Mongo `_id` and password hashes never leave the API. */
export function clean<T extends Doc | null | undefined>(doc: T): Doc | null {
  if (!doc) return null;
  delete (doc as Doc)._id;
  delete (doc as Doc).password_hash;
  return doc as Doc;
}

export function cleanMany(docs: Doc[]): Doc[] {
  return docs.map((d) => clean(d) as Doc);
}

/** Fields an accountant must never receive about a client (contact / auth / payment data). */
export const PROTECTED_CLIENT_FIELDS = [
  "client_email",
  "client_phone",
  "client_user_id",
  "email",
  "phone",
  "utr",
  "address",
  "password_hash",
  "payment_method",
  "card",
  "stripe_customer_id",
  "stripe_payment_intent_id",
  "session_id",
];

export function scrub(doc: Doc | null, user: Doc): Doc | null {
  if (!doc || user.role !== "ACCOUNTANT") return doc;
  for (const f of PROTECTED_CLIENT_FIELDS) delete doc[f];
  return doc;
}

export function scrubMany(docs: Doc[], user: Doc): Doc[] {
  return docs.map((d) => scrub(d, user) as Doc);
}

export function maskEmail(v: string | null | undefined): string | null | undefined {
  if (!v || !v.includes("@")) return v;
  const [name, dom] = [v.slice(0, v.indexOf("@")), v.slice(v.indexOf("@") + 1)];
  return `${name[0]}***@${dom}`;
}

export function maskPhone(v: string | null | undefined): string | null | undefined {
  if (!v || v.length < 4) return v;
  return `${v.slice(0, 2)}*** ***${v.slice(-3)}`;
}

/** Standard Admin sees masked client contact details; Super Admin sees full. */
export function maskContact(doc: Doc | null, user: Doc): Doc | null {
  if (!doc || user.role !== "ADMIN") return doc;
  if (doc.role && doc.role !== "CLIENT") return doc;
  if ("email" in doc) {
    doc.email = maskEmail(doc.email);
    doc.contact_masked = true;
  }
  if ("phone" in doc) doc.phone = maskPhone(doc.phone);
  return doc;
}

export function maskContactMany(docs: Doc[], user: Doc): Doc[] {
  return docs.map((d) => maskContact(d, user) as Doc);
}
