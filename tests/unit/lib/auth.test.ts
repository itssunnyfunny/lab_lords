import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSessionUser } from "@/lib/auth";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  currentUser: vi.fn(),
  prismaUser: {
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
}));

vi.mock("@clerk/nextjs/server", () => ({
  auth: mocks.auth,
  currentUser: mocks.currentUser,
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: mocks.prismaUser,
  },
}));

function clerkUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "clerk_123",
    firstName: "Alice",
    lastName: "Owner",
    fullName: "Alice Owner",
    primaryEmailAddress: { emailAddress: "Alice@Example.com" },
    emailAddresses: [{ emailAddress: "Alice@Example.com" }],
    ...overrides,
  };
}

describe("getSessionUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when Clerk has no signed-in user", async () => {
    mocks.auth.mockResolvedValue({ userId: null });

    await expect(getSessionUser()).resolves.toBeNull();
    expect(mocks.currentUser).not.toHaveBeenCalled();
  });

  it("returns the local user when clerkId is already linked", async () => {
    mocks.auth.mockResolvedValue({ userId: "clerk_123" });
    mocks.prismaUser.findUnique.mockResolvedValueOnce({
      id: "local_123",
      email: "alice@example.com",
    });

    await expect(getSessionUser()).resolves.toEqual({
      id: "local_123",
      email: "alice@example.com",
    });
    expect(mocks.currentUser).not.toHaveBeenCalled();
  });

  it("links an existing local user by normalized email", async () => {
    mocks.auth.mockResolvedValue({ userId: "clerk_123" });
    mocks.currentUser.mockResolvedValue(clerkUser());
    mocks.prismaUser.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "local_123",
        email: "alice@example.com",
        clerkId: null,
        name: null,
      });
    mocks.prismaUser.update.mockResolvedValue({
      id: "local_123",
      email: "alice@example.com",
    });

    await expect(getSessionUser()).resolves.toEqual({
      id: "local_123",
      email: "alice@example.com",
    });
    expect(mocks.prismaUser.update).toHaveBeenCalledWith({
      where: { id: "local_123" },
      data: { clerkId: "clerk_123", name: "Alice Owner" },
      select: { id: true, email: true },
    });
  });

  it("creates a local user when no clerkId or email match exists", async () => {
    mocks.auth.mockResolvedValue({ userId: "clerk_123" });
    mocks.currentUser.mockResolvedValue(clerkUser());
    mocks.prismaUser.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    mocks.prismaUser.create.mockResolvedValue({
      id: "local_123",
      email: "alice@example.com",
    });

    await expect(getSessionUser()).resolves.toEqual({
      id: "local_123",
      email: "alice@example.com",
    });
    expect(mocks.prismaUser.create).toHaveBeenCalledWith({
      data: {
        clerkId: "clerk_123",
        email: "alice@example.com",
        name: "Alice Owner",
      },
      select: { id: true, email: true },
    });
  });

  it("rejects email matches already linked to another Clerk user", async () => {
    mocks.auth.mockResolvedValue({ userId: "clerk_123" });
    mocks.currentUser.mockResolvedValue(clerkUser());
    mocks.prismaUser.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "local_123",
        email: "alice@example.com",
        clerkId: "clerk_other",
        name: "Alice Owner",
      });

    await expect(getSessionUser()).rejects.toThrow("already linked");
    expect(mocks.prismaUser.update).not.toHaveBeenCalled();
    expect(mocks.prismaUser.create).not.toHaveBeenCalled();
  });
});
