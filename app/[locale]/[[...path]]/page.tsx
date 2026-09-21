import { notFound } from "next/navigation";
import Home, { metadata as homeMetadata } from "@/app/page";
import Features, { metadata as featuresMetadata } from "@/app/features/page";
import Pricing, { metadata as pricingMetadata } from "@/app/pricing/page";
import HowItWorks, { metadata as howMetadata } from "@/app/how-it-works/page";
import About, { metadata as aboutMetadata } from "@/app/about/page";
import Faq, { metadata as faqMetadata } from "@/app/faq/page";
import Contact, { metadata as contactMetadata } from "@/app/contact/page";
import Support, { metadata as supportMetadata } from "@/app/support/page";
import Software, { generateMetadata as softwareMetadata } from "@/app/software/[slug]/page";
import { publicRoute, translatedPublicPaths } from "@/lib/public-i18n/routes";
import { localizedPublicMetadata } from "@/lib/public-i18n/metadata";

type Props = { params: Promise<{ locale: string; path?: string[] }> };
// Reject unknown paths before streaming begins, retaining a real HTTP 404.
export const dynamicParams = false;
export function generateStaticParams() {
  return ["hi", "hinglish"].flatMap(locale => translatedPublicPaths.map(path => ({ locale, path: path === "/" ? [] : path.slice(1).split("/") })));
}
const pages = {
  "/": [Home, homeMetadata], "/features": [Features, featuresMetadata], "/pricing": [Pricing, pricingMetadata],
  "/how-it-works": [HowItWorks, howMetadata], "/about": [About, aboutMetadata], "/faq": [Faq, faqMetadata],
  "/contact": [Contact, contactMetadata], "/support": [Support, supportMetadata],
} as const;

async function resolve({ params }: Props) {
  const { locale, path = [] } = await params;
  const route = publicRoute(`/${locale}${path.length ? `/${path.join("/")}` : ""}`);
  if (!route?.translated || route.locale === "en") notFound();
  return route;
}

export async function generateMetadata(props: Props) {
  const route = await resolve(props);
  const entry = pages[route.path as keyof typeof pages];
  const original = entry ? entry[1] : await softwareMetadata({ params: Promise.resolve({ slug: route.path.slice("/software/".length) }) });
  return localizedPublicMetadata(route.locale, route.path, original);
}

export default async function LocalizedPublicPage(props: Props) {
  const route = await resolve(props);
  const entry = pages[route.path as keyof typeof pages];
  if (entry) { const Page = entry[0]; return <Page />; }
  return <Software params={Promise.resolve({ slug: route.path.slice("/software/".length) })} />;
}
