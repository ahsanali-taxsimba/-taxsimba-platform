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
import {
  onboardingSnapshotForUser,
  resolveClientServiceState,
  serviceStateLabel,
} from "../domain/onboardingIntent";

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
    const onboarding = await onboardingSnapshotForUser(me);
    const serviceState = resolveClientServiceState(
      onboarding.onboardingIntent,
      snap.hasActiveSa,
      snap.hasActiveMtd,
    );
    const active = activeSubscriptionsFromServices(snap.services);
    let phone: string | null = (me.phone as string) ?? null;
    let address: string | null = null;
    let clientDoc: Doc | null = null;
    if (me.role === "CLIENT") {
      clientDoc = (await col("clients").findOne({ user_id: me.id })) as Doc | null;
      phone = (clientDoc?.phone as string) ?? phone;
      address = (clientDoc?.address as string) ?? null;
    } else {
      address = (me.address as string) ?? null;
    }
    sendCompatSuccess(
      res,
      keysToCamel({
        ...toToxelUser(me, clientDoc),
        phone,
        address,
        ownership: snap.ownership,
        has_active_sa: snap.hasActiveSa,
        has_active_mtd: snap.hasActiveMtd,
        has_active_service: snap.hasActiveService,
        onboarding_intent: onboarding.onboardingIntent,
        catalogue_category: onboarding.catalogueCategory,
        continue_path: onboarding.continuePath,
        service_state: serviceState,
        service_state_label: serviceStateLabel(serviceState),
        is_engagement_letter_accepted: engagement.isEngagementLetterAccepted,
        engagement_accepted_at: engagement.engagementAcceptedAt,
        agreement_version: engagement.agreementVersion,
        required_agreement_version: engagement.requiredAgreementVersion,
        is_tax_info_submitted: Boolean(
          me.mtd_tax_info_submitted_at || me.sa_tax_info_submitted_at,
        ),
        // Onboarding questionnaire snapshot (SA and/or MTD) for profile resume.
        ...((): Doc => {
          const snap =
            (me.sa_tax_info as Doc | undefined) ||
            (me.mtd_tax_info as Doc | undefined) ||
            null;
          if (!snap) return {};
          return {
            business_type: snap.businessType ?? snap.business_type ?? null,
            business_name: snap.businessName ?? snap.business_name ?? null,
            job_role: snap.jobRole ?? snap.job_role ?? null,
            employment_status:
              snap.employmentStatus ?? snap.employment_status ?? null,
            gov_gateway_status:
              snap.govGatewayStatus ?? snap.gov_gateway_status ?? null,
            is_registered_for_mtd:
              snap.isRegisteredForMTD ?? snap.is_registered_for_mtd ?? null,
            current_accountant:
              snap.currentAccountant ?? snap.current_accountant ?? null,
            income_sources: snap.incomeSources ?? snap.income_sources ?? null,
            annual_turnover:
              snap.annualTurnover ?? snap.annual_turnover ?? null,
            record_keeping_method:
              snap.recordKeepingMethod ?? snap.record_keeping_method ?? null,
            accountant_notes:
              snap.accountantNotes ?? snap.accountant_notes ?? null,
            sa_tax_info: me.sa_tax_info ?? null,
            mtd_tax_info: me.mtd_tax_info ?? null,
          };
        })(),
        utr: clientDoc?.utr ?? null,
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
