import { readFileSync } from "node:fs";
import path from "node:path";

describe("package dependency contract", () => {
  it("uses the Project host for every TradeJS runtime dependency", () => {
    const manifest = JSON.parse(
      readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const runtimeDependencies = Object.keys(manifest.dependencies ?? {}).filter(
      (name) => name.startsWith("@tradejs/"),
    );
    const developmentRuntimePackages = Object.keys(
      manifest.devDependencies ?? {},
    ).filter((name) => name.startsWith("@tradejs/"));

    expect(runtimeDependencies).toEqual([]);
    expect(
      developmentRuntimePackages.every((name) =>
        Object.hasOwn(manifest.peerDependencies ?? {}, name),
      ),
    ).toBe(true);
  });
});
