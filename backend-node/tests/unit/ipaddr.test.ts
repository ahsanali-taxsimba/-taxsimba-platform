import { describe, expect, it } from "vitest";

import { inNetwork, isValid } from "../../src/services/ipaddr";

describe("ip address matching", () => {
  it("recognises valid addresses, including IPv4-mapped IPv6", () => {
    expect(isValid("10.0.0.1")).toBe(true);
    expect(isValid("::ffff:10.0.0.1")).toBe(true);
    expect(isValid("2001:db8::1")).toBe(true);
    expect(isValid("not-an-ip")).toBe(false);
  });

  it("matches IPv4 CIDR membership", () => {
    expect(inNetwork("10.1.2.3", "10.0.0.0/8")).toBe(true);
    expect(inNetwork("11.1.2.3", "10.0.0.0/8")).toBe(false);
    expect(inNetwork("127.0.0.1", "127.0.0.1/32")).toBe(true);
    expect(inNetwork("::ffff:10.1.2.3", "10.0.0.0/8")).toBe(true);
  });

  it("matches IPv6 CIDR membership", () => {
    expect(inNetwork("2001:db8::5", "2001:db8::/32")).toBe(true);
    expect(inNetwork("2001:dba::5", "2001:db8::/32")).toBe(false);
    expect(inNetwork("::1", "::1/128")).toBe(true);
  });

  it("never matches across address families", () => {
    expect(inNetwork("10.0.0.1", "2001:db8::/32")).toBe(false);
  });
});
