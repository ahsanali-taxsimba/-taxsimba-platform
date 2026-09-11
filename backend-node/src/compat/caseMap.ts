/**
 * Central camelCase ↔ snake_case mapping for the Toxel compatibility layer.
 * Keep all key conversion here — do not scatter per-route mappers.
 */

export type Json =
  | null
  | boolean
  | number
  | string
  | Json[]
  | { [key: string]: Json };

const KEY_TO_CAMEL: Record<string, string> = {
  access_token: "accessToken",
  refresh_token: "refreshToken",
  client_ref: "clientRef",
  client_user_id: "clientUserId",
  client_id: "clientId",
  case_id: "caseId",
  case_ref: "caseRef",
  service_type: "serviceType",
  tax_year: "taxYear",
  package_code: "packageCode",
  package_name: "packageName",
  agreed_price: "agreedPrice",
  activated_at: "activatedAt",
  subscription_started_at: "subscriptionStartedAt",
  is_active: "isActive",
  is_read: "isRead",
  created_at: "createdAt",
  updated_at: "updatedAt",
  payment_status: "paymentStatus",
  checkout_url: "checkoutUrl",
  session_id: "sessionId",
  two_factor_required: "twoFactorRequired",
  expires_in: "expiresIn",
  first_name: "firstName",
  last_name: "lastName",
  profile_photo: "profilePhoto",
  tax_return_id: "taxReturnId",
  mtd_period_id: "mtdPeriodId",
  document_type: "documentType",
  internal_deadline: "internalDeadline",
  external_deadline: "externalDeadline",
  internal_instructions: "internalInstructions",
  accountant_id: "accountantId",
  assigned_accountant_id: "assignedAccountantId",
  assigned_accountant_name: "assignedAccountantName",
  password_hash: "passwordHash",
  contact_masked: "contactMasked",
};

const KEY_TO_SNAKE: Record<string, string> = Object.fromEntries(
  Object.entries(KEY_TO_CAMEL).map(([snake, camel]) => [camel, snake]),
);

function snakeToCamelKey(key: string): string {
  if (KEY_TO_CAMEL[key]) return KEY_TO_CAMEL[key];
  return key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

function camelToSnakeKey(key: string): string {
  if (KEY_TO_SNAKE[key]) return KEY_TO_SNAKE[key];
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value) && !(value instanceof Date);
}

/** Recursively convert object keys from snake_case to camelCase. */
export function keysToCamel<T = Json>(input: unknown): T {
  if (Array.isArray(input)) return input.map((v) => keysToCamel(v)) as T;
  if (!isPlainObject(input)) return input as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[snakeToCamelKey(k)] = keysToCamel(v);
  }
  return out as T;
}

/** Recursively convert object keys from camelCase to snake_case. */
export function keysToSnake<T = Json>(input: unknown): T {
  if (Array.isArray(input)) return input.map((v) => keysToSnake(v)) as T;
  if (!isPlainObject(input)) return input as T;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    out[camelToSnakeKey(k)] = keysToSnake(v);
  }
  return out as T;
}
