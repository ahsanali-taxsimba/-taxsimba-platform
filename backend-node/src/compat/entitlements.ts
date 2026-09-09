/**
 * Entitlements / active-subscription adapter (baseline E4) + account composition (A9 partial).
 * ACTIVE rows only from my-services / servicesFor — never invent entitlement state.
 */
import { Router } from "express";

import { clean, col, Doc } from "../db/mongo";
import { handler } from "../http/errors";
import { auth, user as authed } from "../middleware/auth";
import { toToxelUser } from "./authBridge";
import { keysToCamel } from "./caseMap";
import { sendCompatSuccess } from "./envelope";
import {
  activeSubscriptionsFromServices,
  ownershipForUser,
} from "./ownership";
import { engagementStatusForUser } from "../services/engagement";

export const compatEntitlementsRouter = Router();

compatEntitlementsRouter.get(
  "/client/active/subscription/list",
  auth("CLIENT"),
  handler(async (req, res) => {
    const snap = await ownershipForUser(authed(req));
    const list = activeSubscriptionsFromServices(snap.services);
    sendCompatSuccess(
      res,
      {
        subscriptions: list,
        ownership: snap.ownership,
        hasActiveSa: snap.hasActiveSa,
        hasActiveMtd: snap.hasActiveMtd,
        hasActiveService: snap.hasActiveService,
      },
      "OK",
    );
  }),
);

/**
 * Compose account details for Toxel dashboards.
 * Exposes explicit SA/MTD ACTIVE flags; isSubscriptionBuy is always false (not SoT).
 */
compatEntitlementsRouter.post(
  "/auth/get-account-details",
  auth(),
  handler(async (req, res) => {
    const me = authed(req);
    const snap = await ownershipForUser(me);
    const engagement = await engagementStatusForUser(me);
    const active = activeSubscriptionsFromServices(snap.services);
    let phone: string | null = (me.phone as string) ?? null;
    let address: string | null = null;
    if (me.role === "CLIENT") {
      const client = (await col("clients").findOne({ user_id: me.id })) as Doc | null;
      phone = (client?.phone as string) ?? phone;
      address = (client?.address as string) ?? null;
    }
    sendCompatSuccess(
      res,
      keysToCamel({
        ...toToxelUser(me),
        phone,
        address,
        ownership: snap.ownership,
        has_active_sa: snap.hasActiveSa,
        has_active_mtd: snap.hasActiveMtd,
        has_active_service: snap.hasActiveService,
        is_engagement_letter_accepted: engagement.isEngagementLetterAccepted,
        engagement_accepted_at: engagement.engagementAcceptedAt,
        agreement_version: engagement.agreementVersion,
        required_agreement_version: engagement.requiredAgreementVersion,
        // Deprecated — never a source of truth (baseline D7 / N5).
        is_subscription_buy: false,
        subscription: active[0] ?? null,
        subscriptions: active,
        services: snap.services,
      }),
      "OK",
    );
  }),
);
