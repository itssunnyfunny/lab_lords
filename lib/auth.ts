import { auth, currentUser } from "@clerk/nextjs/server";
import { getAuthBypassEmail, isAuthBypassEnabled } from "@/lib/authMode";
import { prisma } from "@/lib/prisma";

export type SessionUser = {
  id: string;
  email?: string;
};

type ClerkUser = NonNullable<Awaited<ReturnType<typeof currentUser>>>;

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function getPrimaryEmailAddress(user: ClerkUser): string | null {
  return user.primaryEmailAddress?.emailAddress ?? user.emailAddresses[0]?.emailAddress ?? null;
}

function getDisplayName(user: ClerkUser): string | null {
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return fullName || user.fullName || null;
}

function isUniqueConstraintError(error: unknown) {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "P2002";
}

async function findSessionUserByClerkId(clerkId: string): Promise<SessionUser | null> {
  const user = await prisma.user.findUnique({
    where: { clerkId },
    select: { id: true, email: true },
  });

  return user;
}

async function getBypassSessionUser(): Promise<SessionUser> {
  const email = getAuthBypassEmail();

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true },
  });

  if (existingUser) {
    return existingUser;
  }

  return prisma.user.create({
    data: {
      email,
      name: "Local Dev User",
    },
    select: { id: true, email: true },
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  if (isAuthBypassEnabled()) {
    return getBypassSessionUser();
  }

  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return null;
  }

  const existingUser = await findSessionUserByClerkId(clerkId);
  if (existingUser) {
    return existingUser;
  }

  const clerkUser = await currentUser();
  const rawEmail = clerkUser ? getPrimaryEmailAddress(clerkUser) : null;

  if (!clerkUser || !rawEmail) {
    throw new Error("Authenticated Clerk user is missing an email address");
  }

  const email = normalizeEmail(rawEmail);
  const name = getDisplayName(clerkUser);

  const userWithEmail = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, clerkId: true, name: true },
  });

  if (userWithEmail) {
    if (userWithEmail.clerkId && userWithEmail.clerkId !== clerkId) {
      throw new Error("This email is already linked to a different Clerk account");
    }

    if (!userWithEmail.clerkId) {
      try {
        return await prisma.user.update({
          where: { id: userWithEmail.id },
          data: {
            clerkId,
            name: userWithEmail.name ?? name,
          },
          select: { id: true, email: true },
        });
      } catch (error) {
        if (isUniqueConstraintError(error)) {
          return findSessionUserByClerkId(clerkId);
        }

        throw error;
      }
    }

    return {
      id: userWithEmail.id,
      email: userWithEmail.email,
    };
  }

  try {
    return await prisma.user.create({
      data: {
        clerkId,
        email,
        name,
      },
      select: { id: true, email: true },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const racedUser = await findSessionUserByClerkId(clerkId);
      if (racedUser) return racedUser;
    }

    throw error;
  }
}
