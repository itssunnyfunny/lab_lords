import { spawnSync } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";

const scripts = [
  "scripts/audit-legacy-unsupported-method-cancellations.ts",
] as const;

describe.each(scripts)("%s command boundary", script => {
  it("rejects an unbound apply before loading an environment or importing Prisma", () => {
    const missingEnvironmentFile = "__must_not_be_loaded_before_apply_validation__.env";
    const result = spawnSync(process.execPath, [
      "--import",
      "tsx",
      path.resolve(script),
      "--apply",
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      env: {
        ...process.env,
        BILLING_ENV_FILE: missingEnvironmentFile,
      },
    });
    const output = `${result.stdout}${result.stderr}`;

    expect(result.status).toBe(1);
    expect(output).toContain("--apply requires");
    expect(output).toContain("--organization-ids");
    expect(output).not.toContain(missingEnvironmentFile);
    expect(output).not.toContain("Prisma");
  });
});

it("rejects retired aggregate promotion before opening a database or provider connection", () => {
  const result = spawnSync(process.execPath, ["--import", "tsx", "scripts/prepare-workspace-billing-rollout.ts",
    "--apply", "--promote=example"], { encoding: "utf8" });
  expect(result.status).toBe(1);
  expect(result.stderr).toContain("Aggregate billing promotion has been retired");
});
