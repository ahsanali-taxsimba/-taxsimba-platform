// src/lib/cms/home-page-settings.ts
import { clientAxios } from "../axios-client";
import type { ApiResponse } from "./category";

/** -----------------------
 * Models
 * ---------------------- */

export type HomeBannerSection = {
  title?: string;
};

export type HowItWorksStep = {
  title?: string;
  description?: string;
};

export type HowItWorksSection = {
  steps?: HowItWorksStep[];
};

export type SelfAssessmentSection = {
  titlePrimary?: string;
  titleSecondary?: string;
  buttonText?: string;
};

export type WhatsIncludedSection = {
  title?: string;
  list?: string[];
};

export type CostSection = {
  titlePrimary?: string;
  titleSecondary?: string;
  list?: string[];
};

export type WhyChooseUsItem = {
  title?: string;
  description?: string;
  imageUrl?: string;
};

export type WhyChooseUsSection = {
  title?: string;
  items?: WhyChooseUsItem[];
};

export type TailoredItem = {
  title?: string;
  imageUrl?: string;
};

export type TailoredSection = {
  title?: string;
  items?: TailoredItem[];
};

export type AccountantsSection = {
  title?: string;
  description?: string;
};

export type FaqItem = {
  question?: string;
  answer?: string;
};

export type GlobeSection = {
  heading?: string;
  subheading?: string;
  buttonText?: string;
};

export interface HomePageSettings {
  id: number;

  homeBannerSection?: HomeBannerSection | null;
  howItWorksSection?: HowItWorksSection | null;
  selfAssessmentSection?: SelfAssessmentSection | null;
  whatsIncludedSection?: WhatsIncludedSection | null;
  costSection?: CostSection | null;
  whyChooseUsSection?: WhyChooseUsSection | null;
  tailoredSection?: TailoredSection | null;
  accountantsSection?: AccountantsSection | null;
  faqs?: FaqItem[] | null;
  globeSection?: GlobeSection | null;

  isActive: boolean;

  createdAt?: string;
  updatedAt?: string;
}

/** -----------------------
 * Payloads
 * ---------------------- */

export type HomePageSettingsUpsertPayload = Partial<
  Omit<HomePageSettings, "id" | "createdAt" | "updatedAt">
>;

export type SectionName =
  | "homeBannerSection"
  | "howItWorksSection"
  | "selfAssessmentSection"
  | "whatsIncludedSection"
  | "costSection"
  | "whyChooseUsSection"
  | "tailoredSection"
  | "accountantsSection"
  | "faqs"
  | "globeSection";

export type UpdateSectionPayload = {
  section: SectionName;
  data: any;
};

/** -----------------------
 * APIs
 * ---------------------- */

// GET /api/admin/cms/home-page-settings
export const getHomePageSettings = async (): Promise<
  ApiResponse<HomePageSettings>
> => {
  const { data } = await clientAxios.get<ApiResponse<HomePageSettings>>(
    "/admin/cms/home-page-settings"
  );
  return data;
};

// POST /api/admin/cms/home-page-settings
export const upsertHomePageSettings = async (
  payload: HomePageSettingsUpsertPayload
): Promise<ApiResponse<HomePageSettings>> => {
  const { data } = await clientAxios.post<ApiResponse<HomePageSettings>>(
    "/admin/cms/home-page-settings",
    payload
  );
  return data;
};

// PATCH /api/admin/cms/home-page-settings/section
export const updateHomePageSection = async (
  payload: UpdateSectionPayload
): Promise<ApiResponse<HomePageSettings>> => {
  const { data } = await clientAxios.patch<ApiResponse<HomePageSettings>>(
    "/admin/cms/home-page-settings/section",
    payload
  );
  return data;
};

// PATCH /api/admin/cms/home-page-settings/toggle-status
export const toggleHomePageSettingsStatus = async (): Promise<
  ApiResponse<HomePageSettings>
> => {
  const { data } = await clientAxios.patch<ApiResponse<HomePageSettings>>(
    "/admin/cms/home-page-settings/toggle-status"
  );
  return data;
};

// DELETE /api/admin/cms/home-page-settings/reset
export const resetHomePageSettings = async (): Promise<
  ApiResponse<HomePageSettings>
> => {
  const { data } = await clientAxios.delete<ApiResponse<HomePageSettings>>(
    "/admin/cms/home-page-settings/reset"
  );
  return data;
};
