import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import type { NextFetchEvent, NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { clerkRouting } from "@/lib/clerkRouting";
import { publicLanguageHeader, publicPathHeader, publicRoute } from "@/lib/public-i18n/routes";

export const isProtectedRoute = createRouteMatcher([
  "/account(.*)",
  "/app(.*)",
  "/branch(.*)",
  "/onboarding(.*)",
  "/org(.*)",
]);

const clerkAuthMiddleware = clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
  // Overwrite any visitor-supplied header. This describes an allowlisted URL,
  // never a cookie, account preference or authorization decision.
  const requestHeaders = new Headers(req.headers);
  const route = publicRoute(req.nextUrl.pathname);
  requestHeaders.set(publicLanguageHeader, route?.locale ?? "en");
  requestHeaders.set(publicPathHeader, route?.path ?? "");
  return NextResponse.next({ request: { headers: requestHeaders } });
}, clerkRouting);

export function proxy(req: NextRequest, event: NextFetchEvent) {
  return clerkAuthMiddleware(req, event);
}

export const config = {
  matcher: [
    "/((?!_next|.well-known/workflow/|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|xml|txt|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
