import { api } from "@/lib/api";
import {
  loadEntitlements,
  resetEntitlementsCache,
  serviceAllowed,
  sharedServiceParams,
} from "@/lib/services";

jest.mock("@/lib/api", () => ({ api: { get: jest.fn() } }));

const services = (...types) => ({
  data: { services: types.map((service_type) => ({ service_type, status: "ACTIVE" })) },
});

beforeEach(() => {
  resetEntitlementsCache();
  api.get.mockReset();
});

test("reads the entitlements once and shares them between callers", async () => {
  api.get.mockResolvedValue(services("SELF_ASSESSMENT"));

  const [a, b] = await Promise.all([loadEntitlements(), loadEntitlements()]);
  const c = await loadEntitlements();

  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith("/my-services");
  expect(a).toEqual({ loaded: true, sa: true, mtd: false });
  expect(b).toBe(a);
  expect(c).toBe(a);
});

test("an inactive service is not an entitlement", async () => {
  api.get.mockResolvedValue({
    data: { services: [{ service_type: "MTD_INCOME_TAX", status: "PENDING_PAYMENT" }] },
  });

  expect(await loadEntitlements()).toEqual({ loaded: true, sa: false, mtd: false });
});

test("recognises each service combination", async () => {
  api.get.mockResolvedValue(services("MTD_INCOME_TAX"));
  expect(await loadEntitlements()).toEqual({ loaded: true, sa: false, mtd: true });

  resetEntitlementsCache();
  api.get.mockResolvedValue(services("SELF_ASSESSMENT", "MTD_INCOME_TAX"));
  expect(await loadEntitlements()).toEqual({ loaded: true, sa: true, mtd: true });
});

test("an unreadable lookup never locks a client out", async () => {
  api.get.mockRejectedValue(new Error("network"));

  expect(await loadEntitlements()).toEqual({ loaded: false, sa: true, mtd: false });
});

test("service routes are only reachable with the matching entitlement", () => {
  const saOnly = { loaded: true, sa: true, mtd: false };
  const mtdOnly = { loaded: true, sa: false, mtd: true };
  const both = { loaded: true, sa: true, mtd: true };

  expect(serviceAllowed(saOnly, "SELF_ASSESSMENT")).toBe(true);
  expect(serviceAllowed(saOnly, "MTD_INCOME_TAX")).toBe(false);
  expect(serviceAllowed(mtdOnly, "MTD_INCOME_TAX")).toBe(true);
  expect(serviceAllowed(mtdOnly, "SELF_ASSESSMENT")).toBe(false);
  expect(serviceAllowed(both, "SELF_ASSESSMENT")).toBe(true);
  expect(serviceAllowed(both, "MTD_INCOME_TAX")).toBe(true);
  expect(serviceAllowed({ loaded: false, sa: true, mtd: false }, "MTD_INCOME_TAX")).toBe(true);
});

test("shared screens keep the Self Assessment scope for a Self Assessment-only client", () => {
  expect(sharedServiceParams({ loaded: true, sa: true, mtd: false })).toEqual({
    service_type: "SELF_ASSESSMENT",
  });
  expect(sharedServiceParams({ loaded: true, sa: false, mtd: true })).toEqual({});
  expect(sharedServiceParams({ loaded: true, sa: true, mtd: true })).toEqual({});
  expect(sharedServiceParams({ loaded: false, sa: true, mtd: false })).toEqual({});
});
