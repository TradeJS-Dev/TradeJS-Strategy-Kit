/** @jest-environment node */

import {
  StrategyConfigValidationError,
  createStrategyConfigParser,
  resolveDirectionalConfigBoolean,
  resolveDirectionalConfigNumber,
} from "../config";

describe("createStrategyConfigParser", () => {
  const parseConfig = createStrategyConfigParser({
    strategyName: "Example",
    defaults: {
      INTERVAL: "15",
      ENABLED: true,
      THRESHOLD: 1.5,
      MODE: "breakout",
      LEVELS: [1, 2],
      LONG: {
        enable: true,
        minRiskRatio: 1,
      },
    },
  });

  it("materializes a complete config with nested defaults", () => {
    expect(
      parseConfig({
        THRESHOLD: 2,
        LONG: { minRiskRatio: 1.25 },
        UNIVERSE: "crypto",
      }),
    ).toEqual({
      INTERVAL: "15",
      ENABLED: true,
      THRESHOLD: 2,
      MODE: "breakout",
      LEVELS: [1, 2],
      LONG: {
        enable: true,
        minRiskRatio: 1.25,
      },
      UNIVERSE: "crypto",
    });
  });

  it.each([
    ["unknown field", { TRESHOLD: 2 }, "Example.TRESHOLD is not allowed"],
    [
      "wrong scalar type",
      { THRESHOLD: "2" },
      "Example.THRESHOLD must be a finite number",
    ],
    [
      "wrong nested type",
      { LONG: { enable: "yes" } },
      "Example.LONG.enable must be a boolean",
    ],
    [
      "wrong array item",
      { LEVELS: [1, "2"] },
      "Example.LEVELS[1] must be a finite number",
    ],
  ])("rejects %s", (_label, input, message) => {
    expect(() => parseConfig(input)).toThrow(
      new StrategyConfigValidationError("Example", [message]),
    );
  });

  it("reports all validation issues in one error", () => {
    expect.assertions(2);

    try {
      parseConfig({ THRESHOLD: Number.NaN, UNKNOWN: true });
    } catch (error) {
      expect(error).toBeInstanceOf(StrategyConfigValidationError);
      expect((error as StrategyConfigValidationError).issues).toEqual([
        "Example.THRESHOLD must be a finite number",
        "Example.UNKNOWN is not allowed",
      ]);
    }
  });
});

describe("resolveDirectionalConfigNumber", () => {
  it("uses direction overrides without changing the opposite side", () => {
    const config = {
      SETUP_THRESHOLD: 1,
      SETUP_THRESHOLD_LONG: 2,
      SETUP_THRESHOLD_SHORT: 3,
    };

    expect(
      resolveDirectionalConfigNumber({
        config,
        key: "SETUP_THRESHOLD",
        direction: "LONG",
        fallback: 0,
      }),
    ).toBe(2);
    expect(
      resolveDirectionalConfigNumber({
        config,
        key: "SETUP_THRESHOLD",
        direction: "SHORT",
        fallback: 0,
      }),
    ).toBe(3);
  });

  it("falls back to the shared value and then to the explicit default", () => {
    expect(
      resolveDirectionalConfigNumber({
        config: { SETUP_THRESHOLD: 1.5 },
        key: "SETUP_THRESHOLD",
        direction: "LONG",
        fallback: 0,
      }),
    ).toBe(1.5);
    expect(
      resolveDirectionalConfigNumber({
        config: { SETUP_THRESHOLD_SHORT: "invalid" },
        key: "SETUP_THRESHOLD",
        direction: "SHORT",
        fallback: 0.75,
      }),
    ).toBe(0.75);
  });
});

describe("resolveDirectionalConfigBoolean", () => {
  it("uses the base value when the directional override is absent", () => {
    expect(
      resolveDirectionalConfigBoolean({
        config: { ENABLED: true },
        key: "ENABLED",
        direction: "LONG",
        fallback: false,
      }),
    ).toBe(true);
  });

  it("preserves an explicit false directional override", () => {
    expect(
      resolveDirectionalConfigBoolean({
        config: { ENABLED: true, ENABLED_SHORT: false },
        key: "ENABLED",
        direction: "SHORT",
        fallback: true,
      }),
    ).toBe(false);
  });
});
