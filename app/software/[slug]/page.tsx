import { publicStrings } from "@/lib/public-i18n/server";
import { publicAlternates } from "@/lib/public-i18n/routes";
import { publicOpenGraph, publicTwitter } from "@/lib/publicSocialMetadata";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SoftwareLandingPage } from "@/components/software/SoftwareLandingPage";
import { LegacyAudiencePage } from "@/components/software/LegacyAudiencePage";
import { publicMetadata } from "@/lib/publicMetadata";
import { absoluteUrl, siteConfig } from "@/lib/site";
import {
  getSoftwarePage,
  getSoftwarePagePath,
  softwarePageSlugs,
  legacySoftwarePageSlugs,
} from "@/lib/softwarePages";

type SoftwarePageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return softwarePageSlugs.map(slug => ({ slug }));
}

export async function generateMetadata({ params }: SoftwarePageProps): Promise<Metadata> {
  const { slug } = await params;
  const page = getSoftwarePage(slug);

  if (!page) {
    return {};
  }

  const canonicalPath = getSoftwarePagePath(page.slug);
  if (legacySoftwarePageSlugs.includes(page.slug)) {
    const audience = page.slug === "coaching-management" ? "coaching centres" : "tuition centres";
    return {
      ...publicMetadata(canonicalPath, `${page.shortName}: our library focus`, `Looking for software for ${audience}? Lab Lords now focuses on self-study libraries, study halls, reading rooms and study rooms.`),
      robots: { index: false, follow: true },
    };
  }
  const title = `${page.metaTitle} | ${siteConfig.name}`;

  return {
    title: {
      absolute: title,
    },
    description: page.metaDescription,
    keywords: page.keywords,
    alternates: {
      canonical: absoluteUrl(canonicalPath), languages: publicAlternates(canonicalPath, absoluteUrl),
    },
    openGraph: {
      ...publicOpenGraph,
      type: "website",
      url: absoluteUrl(canonicalPath),
      siteName: siteConfig.name,
      title,
      description: page.metaDescription,
    },
    twitter: {
      ...publicTwitter,
      card: "summary_large_image",
      title,
      description: page.metaDescription,

    },
  };
}

export default async function SoftwarePageRoute({ params }: SoftwarePageProps) {
  const { t, href: localHref } = await publicStrings();
  const { slug } = await params;
  const page = getSoftwarePage(slug);

  if (!page) {
    notFound();
  }

  const path = getSoftwarePagePath(page.slug);
  if (legacySoftwarePageSlugs.includes(page.slug)) {
    return <LegacyAudiencePage audience={page.slug === "coaching-management" ? "coaching centres" : "tuition centres"} />;
  }
  const url = absoluteUrl(localHref(path));
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: `Lab Lords ${t(page.shortName)}`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url,
      description: t(page.metaDescription),
      audience: {
        "@type": "BusinessAudience",
        audienceType: page.audience.map(item => t(item)).join(", "),
      },
      publisher: {
        "@type": "Organization",
        name: siteConfig.name,
        url: siteConfig.url,
      },
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: page.faqs.map(faq => ({
        "@type": "Question",
        name: t(faq.question),
        acceptedAnswer: {
          "@type": "Answer",
          text: t(faq.answer),
        },
      })),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: t("Home"),
          item: absoluteUrl(localHref("/")),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: t("For your library"),
          item: absoluteUrl(localHref("/#software")),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: t(page.shortName),
          item: url,
        },
      ],
    },
  ];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <SoftwareLandingPage page={page} />
    </>
  );
}
