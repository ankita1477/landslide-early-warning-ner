import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** AsyncStorage and expo-constants are native modules; stub them so the caching
 *  logic can be tested without a simulator. */
const store = new Map<string, string>();
vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: async (k: string) => store.get(k) ?? null,
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
  },
}));
vi.mock("expo-constants", () => ({ default: { expoConfig: { hostUri: undefined } } }));

const { api, ageLabel } = await import("./api");

const POINT = {
  lat: 27.1, lon: 88.5, distance_to_segment_m: 120,
  segment: { id: "NH-10:3.0", highway_code: "NH-10", chainage_km: 3, risk: 0.004, tier: "green" },
};

beforeEach(() => {
  store.clear();
  vi.restoreAllMocks();
});
afterEach(() => vi.unstubAllGlobals());

function respondOnce(payload: unknown) {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => payload })));
}

function failFetch() {
  vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
}

describe("offline behaviour", () => {
  it("serves the network response and marks it fresh", async () => {
    respondOnce(POINT);
    const result = await api.nearby(27.1, 88.5);
    expect(result.stale).toBe(false);
    expect(result.data.segment.chainage_km).toBe(3);
  });

  it("falls back to the last good answer when the network fails", async () => {
    // The network fails during exactly the storm the warning is about, so this
    // is the normal path, not the edge case.
    respondOnce(POINT);
    await api.nearby(27.1, 88.5);

    failFetch();
    const offline = await api.nearby(27.1, 88.5);
    expect(offline.data.segment.tier).toBe("green");
  });

  it("marks a cached answer as stale so the screen can say so", async () => {
    respondOnce(POINT);
    await api.nearby(27.1, 88.5);
    failFetch();
    expect((await api.nearby(27.1, 88.5)).stale).toBe(true);
  });

  it("keeps the timestamp of the cached answer, not of the failed attempt", async () => {
    respondOnce(POINT);
    const fresh = await api.nearby(27.1, 88.5);
    await new Promise((r) => setTimeout(r, 10));
    failFetch();
    const offline = await api.nearby(27.1, 88.5);
    expect(offline.fetchedAt).toBe(fresh.fetchedAt);
  });

  it("throws when there is nothing cached and nothing reachable", async () => {
    failFetch();
    await expect(api.nearby(27.1, 88.5)).rejects.toThrow();
  });

  it("treats an HTTP error as a failure rather than caching it", async () => {
    respondOnce(POINT);
    await api.nearby(27.1, 88.5);

    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 500 })));
    const result = await api.nearby(27.1, 88.5);
    // A 500 must not overwrite a good reading with an error body.
    expect(result.stale).toBe(true);
    expect(result.data.segment.tier).toBe("green");
  });

  it("caches each location separately", async () => {
    respondOnce(POINT);
    await api.nearby(27.1, 88.5);
    failFetch();
    // A different place has no cached reading of its own.
    await expect(api.nearby(26.9, 88.4)).rejects.toThrow();
  });
});

describe("age labels", () => {
  it("reads as plain time, since a stale warning must show its age", () => {
    const ago = (ms: number) => ageLabel(new Date(Date.now() - ms).toISOString());
    expect(ago(0)).toBe("just now");
    expect(ago(5 * 60_000)).toBe("5 min ago");
    expect(ago(3 * 3_600_000)).toBe("3 h ago");
    expect(ago(2 * 86_400_000)).toBe("2 d ago");
  });
});
