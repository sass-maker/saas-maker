import { describe, expect, it } from "vitest";
import { deriveCockpitLayout } from "../src/lib/layout";

describe("deriveCockpitLayout", () => {
  it.each([
    [390, 844, "compact"],
    [694, 1_024, "compact"],
    [744, 1_133, "intermediate"],
    [820, 1_180, "intermediate"],
    [1_024, 768, "regular"],
    [1_366, 1_024, "regular"],
  ] as const)("maps %sx%s to %s", (width, height, mode) => {
    expect(deriveCockpitLayout(width, height).mode).toBe(mode);
  });

  it("sizes the preview from the current window instead of a fixed device height", () => {
    expect(deriveCockpitLayout(1_366, 700).previewHeight).toBe(560);
    expect(deriveCockpitLayout(1_366, 1_200).previewHeight).toBe(920);
  });
});
