import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { UserService } from "@/services/user.service";
import { resetDatabase, disconnectDatabase } from "@/tests/setup/db";
import { createUser } from "@/tests/factories";

describe("UserService settings", () => {
  afterAll(async () => { await disconnectDatabase(); });
  beforeEach(async () => { await resetDatabase(); });

  it("updates persisted account settings", async () => {
    const user = await createUser();

    const updated = await UserService.updateSettings(user.id, {
      name: "Asha Owner",
      phone: "9999999999",
      timezone: "Asia/Kolkata",
      locale: "en-IN",
      dateFormat: "yyyy-MM-dd",
      themePreference: "system",
      densityPreference: "compact",
      defaultMessageLanguage: "hi",
      defaultLandingPage: "account",
    });

    expect(updated.name).toBe("Asha Owner");
    expect(updated.phone).toBe("+91 99999 99999");
    expect(updated.dateFormat).toBe("yyyy-MM-dd");
    expect(updated.themePreference).toBe("system");
    expect(updated.defaultMessageLanguage).toBe("hi");
    expect(updated.defaultLandingPage).toBe("account");
  });

  it("rejects unknown or invalid account settings", async () => {
    const user = await createUser();

    await expect(
      UserService.updateSettings(user.id, {
        name: "Asha",
        unsupported: true,
      })
    ).rejects.toThrow(/Unknown settings field/i);

    await expect(
      UserService.updateSettings(user.id, {
        name: "Asha",
        defaultMessageLanguage: "fr",
      })
    ).rejects.toThrow(/supported/i);

    await expect(
      UserService.updateSettings(user.id, {
        name: "Asha",
        phone: "",
      })
    ).rejects.toThrow(/phone is required/i);

    await expect(
      UserService.updateSettings(user.id, {
        name: "Asha",
        phone: "+1 99999 99999",
      })
    ).rejects.toThrow(/valid Indian mobile/i);
  });
});
