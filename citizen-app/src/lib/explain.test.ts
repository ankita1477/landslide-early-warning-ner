import { describe, expect, it } from "vitest";
import { NEAR_ROAD_M, distanceLabel } from "./explain";

describe("distanceLabel", () => {
  it("keeps metres close to the road", () => {
    expect(distanceLabel(340.4)).toBe("340 m");
  });
  it("switches to kilometres past one", () => {
    expect(distanceLabel(12_400)).toBe("12.4 km");
  });
  it("never prints hundreds of thousands of metres", () => {
    expect(distanceLabel(768_083)).toBe("768 km");
  });
});

describe("NEAR_ROAD_M", () => {
  it("is beyond any segment's runout reach but well short of another district", () => {
    expect(NEAR_ROAD_M).toBeGreaterThan(815);
    expect(NEAR_ROAD_M).toBeLessThanOrEqual(10_000);
  });
});
