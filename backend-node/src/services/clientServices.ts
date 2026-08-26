import { randomUUID } from "crypto";

import { col, Doc } from "../db/mongo";
import { nowIso } from "../domain/workflow";

export const SELF_ASSESSMENT = "SELF_ASSESSMENT";
export const MTD = "MTD_INCOME_TAX";
export const SERVICE_LABELS: Record<string, string> = {
  [SELF_ASSESSMENT]: "Self Assessment",
  [MTD]: "MTD for Income Tax",
};

/**
 * A new account owns nothing until a service is purchased/activated: both rows start
 * NOT_ACTIVE.
 */
export async function bootstrapClientServices(client: Doc): Promise<void> {
  for (const serviceType of [SELF_ASSESSMENT, MTD]) {
    const existing = await col("client_services").findOne({
      client_id: client.id,
      service_type: serviceType,
    });
    if (existing) continue;
    await col("client_services").insertOne({
      id: randomUUID(),
      client_id: client.id,
      client_user_id: client.user_id,
      service_type: serviceType,
      status: "NOT_ACTIVE",
      package_code: null,
      tax_year: null,
      activated_at: null,
      package_history: [],
      created_at: nowIso(),
    });
  }
}
