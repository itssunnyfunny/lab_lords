import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { UserService } from "@/services/user.service";
import { resetDatabase, disconnectDatabase } from "@/tests/setup/db";
import { createUser } from "@/tests/factories";
import { prisma } from "@/lib/prisma";

describe("UserService settings", () => {
  afterAll(async () => { await disconnectDatabase(); });
  beforeEach(async () => { await resetDatabase(); });

  it("persists independent personal screen and document languages with English defaults", async () => {
    const first = await createUser();
    const second = await createUser();
    expect(first.interfaceLanguage).toBe("en");
    expect(first.documentLanguage).toBe("en");
    await UserService.updateSettings(first.id, { interfaceLanguage: "hi", documentLanguage: "hinglish" });
    await UserService.updateSettings(second.id, { interfaceLanguage: "hinglish" });
    const savedFirst = await prisma.user.findUniqueOrThrow({ where: { id: first.id } });
    const savedSecond = await prisma.user.findUniqueOrThrow({ where: { id: second.id } });
    expect(savedFirst).toMatchObject({ interfaceLanguage: "hi", documentLanguage: "hinglish", defaultMessageLanguage: first.defaultMessageLanguage, locale: first.locale, timezone: first.timezone });
    expect(savedSecond).toMatchObject({ interfaceLanguage: "hinglish", documentLanguage: "en", defaultMessageLanguage: second.defaultMessageLanguage });
    await UserService.updateSettings(first.id, { name: "Updated Owner" });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: first.id } })).toMatchObject({ interfaceLanguage: "hi", documentLanguage: "hinglish" });
  });

  it("enforces supported languages in both service validation and database constraints", async () => {
    const user = await createUser();
    await expect(UserService.updateSettings(user.id, { documentLanguage: "HI" })).rejects.toThrow(/supported/i);
    await expect(prisma.user.update({ where: { id: user.id }, data: { interfaceLanguage: "fr" } })).rejects.toThrow();
    expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({ interfaceLanguage: "en", documentLanguage: "en" });
  });

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
