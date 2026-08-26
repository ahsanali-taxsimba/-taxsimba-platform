import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * The client's service entitlements, loaded once per page load and shared by the navigation,
 * the route guards and the client screens, so what a client sees always follows
 * /api/my-services rather than any hard-coded assumption about who has which service.
 */
let cached = null;
let inflight = null;

const UNKNOWN = { loaded: false, sa: true, mtd: false };

function shape(services) {
  const active = (type) => services.some((s) => s.service_type === type && s.status === "ACTIVE");
  return { loaded: true, sa: active("SELF_ASSESSMENT"), mtd: active("MTD_INCOME_TAX") };
}

export function loadEntitlements() {
  if (cached) return Promise.resolve(cached);
  if (!inflight) {
    inflight = api
      .get("/my-services")
      .then(({ data }) => {
        cached = shape(Array.isArray(data?.services) ? data.services : []);
        return cached;
      })
      // A failed lookup must never lock a client out of screens they are entitled to.
      .catch(() => UNKNOWN)
      .then((value) => {
        inflight = null;
        return value;
      });
  }
  return inflight;
}

export function resetEntitlementsCache() {
  cached = null;
  inflight = null;
}

export function useEntitlements(enabled = true) {
  const [state, setState] = useState(cached || UNKNOWN);

  useEffect(() => {
    if (!enabled) return undefined;
    let live = true;
    loadEntitlements().then((next) => live && setState(next));
    return () => {
      live = false;
    };
  }, [enabled]);

  return state;
}

/** A client may only open a service route while that service is active on their record. */
export function serviceAllowed({ loaded, sa, mtd }, serviceType) {
  // An entitlement lookup that could not be read never blocks the client.
  if (!loaded) return true;
  return serviceType === "MTD_INCOME_TAX" ? mtd : sa;
}

/**
 * Self Assessment stays the scope of the shared screens for a client who only has that
 * service, so their view is exactly as before; a client with MTD sees both services' items.
 */
export function sharedServiceParams({ loaded, sa, mtd }) {
  return loaded && sa && !mtd ? { service_type: "SELF_ASSESSMENT" } : {};
}
