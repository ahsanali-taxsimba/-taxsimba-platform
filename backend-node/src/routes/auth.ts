import { randomUUID } from "crypto";

import { Router } from "express";
import { z } from "zod";

import { clean, col, Doc } from "../db/mongo";
import { isTestEmail } from "../domain/testdata";
import { nowIso } from "../domain/workflow";
import { handler, httpError, parseBody } from "../http/errors";
import { authResponse, clearSessionCookies, isBrowser, setSessionCookies } from "../http/session";
import { auth, user as authed } from "../middleware/auth";
import { enforceCsrf } from "../middleware/csrf";
import {
  createAccessToken,
  hashPassword,
  REFRESH_COOKIE,
  revokeRefreshToken,
  rotateRefreshToken,
  verifyPassword,
} from "../services/auth";
import { clearFailures, clientIp, enforceLoginAllowed, recordFailure } from "../services/loginLockout";
import {
  consumeChallenge,
  createChallenge,
  decryptSecret,
  encryptSecret,
  generateRecoveryCodes,
  matchRecoveryCode,
  MFA_REQUIRED_ROLES,
  newSecret,
  verifyCode,
} from "../services/security";
import { bootstrapClientServices } from "../services/clientServices";

const email = z.string().email();

const RegisterIn = z.object({
  email,
  password: z.string(),
  name: z.string(),
  phone: z.string().nullish().default(null),
});
const LoginIn = z.object({ email, password: z.string() });
const TwoFactorLoginIn = z.object({ challenge: z.string(), code: z.string() });
const CodeIn = z.object({ code: z.string() });
const Disable2FAIn = z.object({ password: z.string(), code: z.string() });

export const authRouter = Router();

authRouter.post(
  "/auth/register",
  handler(async (req, res) => {
    const body = parseBody(RegisterIn, req.body);
    const address = body.email.toLowerCase();
    if (await col("users").findOne({ email: address })) {
      throw httpError(400, "Email already registered");
    }
    const record: Doc = {
      id: randomUUID(),
      email: address,
      name: body.name,
      role: "CLIENT",
      password_hash: hashPassword(body.password),
      phone: body.phone ?? null,
      is_active: true,
      created_at: nowIso(),
    };
    await col("users").insertOne({ ...record });
    const count = await col("clients").countDocuments({});
    const client: Doc = {
      id: randomUUID(),
      user_id: record.id,
      name: body.name,
      email: address,
      phone: body.phone ?? null,
      is_test: isTestEmail(address),
      created_at: nowIso(),
      client_ref: `CL-${String(42 + count).padStart(4, "0")}`,
    };
    await col("clients").insertOne({ ...client });
    await bootstrapClientServices(client);
    res.json(await authResponse(req, res, record));
  }),
);

authRouter.post(
  "/auth/login",
  handler(async (req, res) => {
    const body = parseBody(LoginIn, req.body);
    const address = body.email.toLowerCase();
    const ip = clientIp(req);
    await enforceLoginAllowed(ip, address);
    const found = await col("users").findOne({ email: address });
    if (!found || !found.password_hash || !verifyPassword(body.password, found.password_hash)) {
      await recordFailure(ip, address);
      throw httpError(401, "Invalid email or password");
    }
    if (found.status === "PENDING") {
      throw httpError(401, "Your account setup is not complete — use your invitation link");
    }
    if (found.is_active === false) throw httpError(401, "Account disabled");
    await clearFailures(ip, address);
    if (found.totp?.enabled) {
      // No session is issued until the second factor is verified.
      res.json({
        two_factor_required: true,
        challenge: createChallenge(found.id),
        expires_in: 300,
      });
      return;
    }
    res.json(await authResponse(req, res, found as Doc));
  }),
);

authRouter.post(
  "/auth/login/2fa",
  handler(async (req, res) => {
    const body = parseBody(TwoFactorLoginIn, req.body);
    const ip = clientIp(req);
    const userId = await consumeChallenge(body.challenge);
    const found = await col("users").findOne({ id: userId });
    const totp = found?.totp ?? {};
    if (!found || found.is_active === false || !totp.enabled) {
      throw httpError(401, "Invalid authentication");
    }
    await enforceLoginAllowed(ip, found.email);
    const [ok, step] = verifyCode(decryptSecret(totp.secret_enc), body.code, totp.last_step);
    if (ok) {
      const claimed = await col("users").updateOne(
        { id: found.id, "totp.last_step": totp.last_step ?? null },
        { $set: { "totp.last_step": step } },
      );
      if (!claimed.modifiedCount) throw httpError(401, "That code has already been used");
    } else {
      const index = matchRecoveryCode(body.code, found.recovery_code_hashes);
      if (index === null) {
        await recordFailure(ip, found.email);
        throw httpError(401, "Invalid authentication code");
      }
      const used = found.recovery_code_hashes[index];
      const pulled = await col("users").updateOne(
        { id: found.id, recovery_code_hashes: used },
        { $pull: { recovery_code_hashes: used } } as Doc,
      );
      if (!pulled.modifiedCount) throw httpError(401, "Invalid authentication code");
      await col("activity_logs").insertOne({
        id: randomUUID(),
        case_id: null,
        action: "Recovery code used to sign in",
        user_id: found.id,
        user_name: found.name,
        role: found.role,
        meta: {},
        created_at: nowIso(),
      });
    }
    await clearFailures(ip, found.email);
    res.json(await authResponse(req, res, found as Doc));
  }),
);

authRouter.get(
  "/auth/2fa/status",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const row = await col("users").findOne(
      { id: me.id },
      { projection: { totp: 1, recovery_code_hashes: 1 } },
    );
    const totp = row?.totp ?? {};
    res.json({
      enabled: !!totp.enabled,
      required: MFA_REQUIRED_ROLES.includes(me.role),
      recovery_codes_remaining: (row?.recovery_code_hashes ?? []).length,
    });
  }),
);

authRouter.post(
  "/auth/2fa/enrol",
  auth(),
  handler(async (req, res) => {
    enforceCsrf(req);
    const me = authed(req);
    const row = await col("users").findOne({ id: me.id }, { projection: { totp: 1 } });
    if (row?.totp?.enabled) throw httpError(409, "Two-factor authentication is already on");
    const { secret, uri } = newSecret(me.email);
    await col("users").updateOne(
      { id: me.id },
      { $set: { totp: { enabled: false, secret_enc: encryptSecret(secret), last_step: null } } },
    );
    res.json({ otpauth_uri: uri, manual_secret: secret });
  }),
);

authRouter.post(
  "/auth/2fa/activate",
  auth(),
  handler(async (req, res) => {
    enforceCsrf(req);
    const body = parseBody(CodeIn, req.body);
    const me = authed(req);
    const row = await col("users").findOne({ id: me.id }, { projection: { totp: 1 } });
    const totp = row?.totp ?? {};
    if (totp.enabled || !totp.secret_enc) throw httpError(409, "Start the setup again");
    const [ok, step] = verifyCode(decryptSecret(totp.secret_enc), body.code, null);
    if (!ok) throw httpError(400, "That code isn't right — please try again");
    const { codes, hashes } = generateRecoveryCodes();
    await col("users").updateOne(
      { id: me.id },
      {
        $set: {
          "totp.enabled": true,
          "totp.last_step": step,
          "totp.enabled_at": nowIso(),
          recovery_code_hashes: hashes,
          recovery_codes_generated_at: nowIso(),
        },
      },
    );
    await col("activity_logs").insertOne({
      id: randomUUID(),
      case_id: null,
      action: "Two-factor authentication enabled",
      user_id: me.id,
      user_name: me.name,
      role: me.role,
      meta: {},
      created_at: nowIso(),
    });
    res.json({ recovery_codes: codes });
  }),
);

/** Turning 2FA off needs the password AND a valid code, so a hijacked session cannot. */
authRouter.post(
  "/auth/2fa/disable",
  auth(),
  handler(async (req, res) => {
    enforceCsrf(req);
    const body = parseBody(Disable2FAIn, req.body);
    const me = authed(req);
    if (MFA_REQUIRED_ROLES.includes(me.role)) {
      throw httpError(403, "Two-factor authentication is required for this role");
    }
    const row = await col("users").findOne({ id: me.id });
    const totp = row?.totp ?? {};
    if (!verifyPassword(body.password, row?.password_hash ?? "")) {
      throw httpError(401, "Password is incorrect");
    }
    let ok = false;
    if (totp.secret_enc) [ok] = verifyCode(decryptSecret(totp.secret_enc), body.code, null);
    if (!ok && matchRecoveryCode(body.code, row?.recovery_code_hashes) === null) {
      throw httpError(401, "Invalid authentication code");
    }
    await col("users").updateOne(
      { id: me.id },
      { $unset: { totp: "", recovery_code_hashes: "" } },
    );
    await col("activity_logs").insertOne({
      id: randomUUID(),
      case_id: null,
      action: "Two-factor authentication disabled",
      user_id: me.id,
      user_name: me.name,
      role: me.role,
      meta: {},
      created_at: nowIso(),
    });
    res.json({ ok: true });
  }),
);

authRouter.post(
  "/auth/refresh",
  handler(async (req, res) => {
    enforceCsrf(req);
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw httpError(401, "Not authenticated");
    const [found, newRefresh] = await rotateRefreshToken(token);
    const access = createAccessToken(found.id, found.email);
    setSessionCookies(res, access, newRefresh);
    const body: Doc = { user: clean({ ...found }) };
    if (!isBrowser(req)) body.access_token = access;
    res.json(body);
  }),
);

authRouter.post(
  "/auth/logout",
  handler(async (req, res) => {
    enforceCsrf(req);
    await revokeRefreshToken(req.cookies?.[REFRESH_COOKIE]);
    clearSessionCookies(res);
    res.json({ ok: true });
  }),
);

authRouter.get(
  "/auth/me",
  auth(),
  handler(async (req, res) => {
    res.json(authed(req));
  }),
);
