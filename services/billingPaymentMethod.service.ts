import type { ProviderPaymentMethod } from "@/app/generated/prisma/client";

export function normalizeProviderPaymentMethod(
  value: string | ProviderPaymentMethod | null | undefined
): ProviderPaymentMethod {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "card") return "CARD";
  if (normalized === "upi") return "UPI";
  if (normalized === "emandate" || normalized === "netbanking") return "EMANDATE";
  return "UNKNOWN";
}

export function isSupportedProviderPaymentMethod(
  method: ProviderPaymentMethod
): method is Exclude<ProviderPaymentMethod, "UNKNOWN"> {
  return method === "CARD" || method === "UPI" || method === "EMANDATE";
}

export function safeRazorpayHostedUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    if (url.protocol !== "https:" || url.username || url.password || url.port
      || !(hostname === "rzp.io" || hostname === "razorpay.com" || hostname.endsWith(".razorpay.com"))) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}
