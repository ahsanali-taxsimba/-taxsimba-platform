import { api } from "@/lib/api";
import { loadContent, pick, resetContentCache } from "@/lib/content";

jest.mock("@/lib/api", () => ({ api: { get: jest.fn() } }));

beforeEach(() => {
  resetContentCache();
  api.get.mockReset();
});

test("fetches the content map once and shares it between callers", async () => {
  api.get.mockResolvedValue({ data: { "client.help.title": "Support" } });

  const [a, b] = await Promise.all([loadContent(), loadContent()]);
  const c = await loadContent();

  expect(api.get).toHaveBeenCalledTimes(1);
  expect(api.get).toHaveBeenCalledWith("/content");
  expect(a).toEqual({ "client.help.title": "Support" });
  expect(b).toBe(a);
  expect(c).toBe(a);
});

test("falls back silently when the backend is unavailable", async () => {
  api.get.mockRejectedValue(new Error("network"));

  const map = await loadContent();

  expect(map).toEqual({});
  expect(pick(map, "client.help.title", "Help Centre")).toBe("Help Centre");
});

test("falls back when the response is malformed", async () => {
  api.get.mockResolvedValue({ data: "nope" });

  expect(pick(await loadContent(), "client.help.title", "Help Centre")).toBe(
    "Help Centre",
  );
});

test("uses an override and restores the default once it is removed", async () => {
  api.get.mockResolvedValue({ data: { "client.help.title": "Support hub" } });
  expect(pick(await loadContent(), "client.help.title", "Help Centre")).toBe(
    "Support hub",
  );

  resetContentCache();
  api.get.mockResolvedValue({ data: { "client.help.title": "Help Centre" } });
  expect(pick(await loadContent(), "client.help.title", "Help Centre")).toBe(
    "Help Centre",
  );
});

test("ignores blank and non-string values", () => {
  expect(pick({ k: "   " }, "k", "Default")).toBe("Default");
  expect(pick({ k: 42 }, "k", "Default")).toBe("Default");
  expect(pick({}, "k", "Default")).toBe("Default");
  expect(pick(null, "k", "Default")).toBe("Default");
});
