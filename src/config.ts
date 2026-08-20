import type {
  Direction,
  StrategyConfig,
  StrategyRegistryEntry,
} from "@tradejs/types";

export type StrategyConfigParser<TConfig extends StrategyConfig> = (
  input: unknown,
) => TConfig;

export type ValidatedStrategyRegistryEntry<
  TConfig extends StrategyConfig = any,
> = StrategyRegistryEntry<TConfig> & {
  parseConfig: StrategyConfigParser<TConfig>;
};

export type StrategyConfigScalarKind = "boolean" | "number" | "string";

const SHARED_STRATEGY_CONFIG_FIELDS: Readonly<
  Record<string, StrategyConfigScalarKind>
> = {
  ENABLE: "boolean",
  INTERVAL: "string",
  UNIVERSE: "string",
  ACCOUNT_ID: "string",
  BACKTEST_PRICE_MODE: "string",
  BACKTEST_ENTRY_DELAY_BARS: "number",
  BACKTEST_EXECUTION_INTERVAL: "string",
  BACKTEST_EXECUTION_DELAY_MS: "number",
  ML_ENABLED: "boolean",
  POLICY_PROFILE_ID: "string",
  MAKER_FEE_RATE: "number",
  TAKER_FEE_RATE: "number",
  FUNDING_ENABLED: "boolean",
  LEVERAGE: "number",
  SLIPPAGE_BASE_BPS: "number",
  SLIPPAGE_SPREAD_MULTIPLIER: "number",
  SLIPPAGE_MARKET_IMPACT_BPS: "number",
  SLIPPAGE_DELAY_RISK_MULTIPLIER: "number",
  EXECUTION_COSTS_CACHE_ONLY: "boolean",
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const cloneConfigValue = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map(cloneConfigValue) as T;
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, nestedValue]) => [
        key,
        cloneConfigValue(nestedValue),
      ]),
    ) as T;
  }
  return value;
};

const describeExpectedValue = (sample: unknown): string => {
  if (typeof sample === "number") return "a finite number";
  if (typeof sample === "boolean") return "a boolean";
  if (typeof sample === "string") return "a string";
  if (Array.isArray(sample)) return "an array";
  if (isRecord(sample)) return "an object";
  return "the configured value type";
};

const isValueOfKind = (
  value: unknown,
  kind: StrategyConfigScalarKind,
): boolean =>
  kind === "number"
    ? typeof value === "number" && Number.isFinite(value)
    : typeof value === kind;

const isValueLikeSample = (value: unknown, sample: unknown): boolean => {
  if (typeof sample === "number") {
    return typeof value === "number" && Number.isFinite(value);
  }
  if (Array.isArray(sample)) return Array.isArray(value);
  if (isRecord(sample)) return isRecord(value);
  return typeof value === typeof sample;
};

const validateAndMerge = ({
  input,
  defaults,
  optionalScalarFields,
  path,
  issues,
}: {
  input: Record<string, unknown>;
  defaults: Record<string, unknown>;
  optionalScalarFields: Readonly<Record<string, StrategyConfigScalarKind>>;
  path: string;
  issues: string[];
}): Record<string, unknown> => {
  const result = cloneConfigValue(defaults);

  for (const [key, inputValue] of Object.entries(input)) {
    const fieldPath = `${path}.${key}`;
    const defaultValue = defaults[key];

    if (!(key in defaults)) {
      const scalarKind =
        optionalScalarFields[key] ?? SHARED_STRATEGY_CONFIG_FIELDS[key];
      if (!scalarKind) {
        issues.push(`${fieldPath} is not allowed`);
      } else if (!isValueOfKind(inputValue, scalarKind)) {
        issues.push(
          `${fieldPath} must be ${
            scalarKind === "number" ? "a finite number" : `a ${scalarKind}`
          }`,
        );
      } else {
        result[key] = cloneConfigValue(inputValue);
      }
      continue;
    }

    if (!isValueLikeSample(inputValue, defaultValue)) {
      issues.push(
        `${fieldPath} must be ${describeExpectedValue(defaultValue)}`,
      );
      continue;
    }

    if (isRecord(defaultValue) && isRecord(inputValue)) {
      result[key] = validateAndMerge({
        input: inputValue,
        defaults: defaultValue,
        optionalScalarFields: {},
        path: fieldPath,
        issues,
      });
      continue;
    }

    if (Array.isArray(defaultValue) && Array.isArray(inputValue)) {
      const itemSample = defaultValue[0];
      if (itemSample !== undefined) {
        inputValue.forEach((item, index) => {
          if (!isValueLikeSample(item, itemSample)) {
            issues.push(
              `${fieldPath}[${index}] must be ${describeExpectedValue(itemSample)}`,
            );
          }
        });
      }
    }

    result[key] = cloneConfigValue(inputValue);
  }

  return result;
};

export class StrategyConfigValidationError extends Error {
  readonly issues: readonly string[];

  constructor(strategyName: string, issues: readonly string[]) {
    super(`Invalid ${strategyName} config:\n- ${issues.join("\n- ")}`);
    this.name = "StrategyConfigValidationError";
    this.issues = [...issues];
  }
}

export const createStrategyConfigParser = <TConfig extends StrategyConfig>({
  strategyName,
  defaults,
  optionalScalarFields = {},
}: {
  strategyName: string;
  defaults: TConfig;
  optionalScalarFields?: Readonly<Record<string, StrategyConfigScalarKind>>;
}): StrategyConfigParser<TConfig> => {
  if (!strategyName.trim()) {
    throw new Error("strategyName must not be empty");
  }
  if (!isRecord(defaults)) {
    throw new Error(`${strategyName} defaults must be an object`);
  }
  for (const [key, kind] of Object.entries(optionalScalarFields)) {
    if (!key.trim()) {
      throw new Error(`${strategyName} optional field name must not be empty`);
    }
    if (key in defaults) {
      throw new Error(
        `${strategyName} optional field ${key} duplicates a default`,
      );
    }
    if (kind !== "boolean" && kind !== "number" && kind !== "string") {
      throw new Error(`${strategyName} optional field ${key} has invalid kind`);
    }
  }

  return (input: unknown): TConfig => {
    if (!isRecord(input)) {
      throw new StrategyConfigValidationError(strategyName, [
        `${strategyName} config must be an object`,
      ]);
    }

    const issues: string[] = [];
    const parsed = validateAndMerge({
      input,
      defaults,
      optionalScalarFields,
      path: strategyName,
      issues,
    });

    if (issues.length > 0) {
      throw new StrategyConfigValidationError(strategyName, issues);
    }

    return parsed as TConfig;
  };
};

export const resolveDirectionalConfigNumber = ({
  config,
  key,
  direction,
  fallback,
}: {
  config: object;
  key: string;
  direction: Direction;
  fallback: number;
}) => {
  const record = config as Record<string, unknown>;
  const directionalValue = record[`${key}_${direction}`];
  const baseValue = record[key];
  const parsed = Number(directionalValue ?? baseValue ?? fallback);

  return Number.isFinite(parsed) ? parsed : fallback;
};

export const resolveDirectionalConfigBoolean = ({
  config,
  key,
  direction,
  fallback,
}: {
  config: object;
  key: string;
  direction: Direction;
  fallback: boolean;
}) => {
  const record = config as Record<string, unknown>;
  const directionalValue = record[`${key}_${direction}`];
  const baseValue = record[key];
  const resolved = directionalValue ?? baseValue ?? fallback;

  return typeof resolved === "boolean" ? resolved : fallback;
};
