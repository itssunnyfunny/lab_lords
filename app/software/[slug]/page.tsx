import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { SoftwareLandingPage } from "@/components/software/SoftwareLandingPage";
import { absoluteUrl, siteConfig } from "@/lib/site";
import {
  getSoftwarePage,
  getSoftwarePagePath,
  softwarePageSlugs,
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
  const title = `${page.metaTitle} | ${siteConfig.name}`;

  return {
    title: {
      absolute: title,
    },
    description: page.metaDescription,
    keywords: page.keywords,
    alternates: {
      canonical: absoluteUrl(canonicalPath),
    },
    openGraph: {
      type: "website",
      url: absoluteUrl(canonicalPath),
      siteName: siteConfig.name,
      title,
      description: page.metaDescription,
      images: [
        {
          url: "/opengraph-image.png",
          width: 1200,
          height: 630,
          alt: `${page.shortName} by Lab Lords`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: page.metaDescription,
      images: ["/twitter-image.png"],
    },
  };
}

export default async function SoftwarePageRoute({ params }: SoftwarePageProps) {
  const { slug } = await params;
  const page = getSoftwarePage(slug);

  if (!page) {
    notFound();
  }

  const path = getSoftwarePagePath(page.slug);
  const url = absoluteUrl(path);
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "SoftwareApplication",
      name: `Lab Lords ${page.shortName}`,
      applicationCategory: "BusinessApplication",
      operatingSystem: "Web",
      url,
      description: page.metaDescription,
      audience: {
        "@type": "BusinessAudience",
        audienceType: page.audience.join(", "),
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
        name: faq.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: faq.answer,
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
          name: "Home",
          item: absoluteUrl("/"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Software",
          item: absoluteUrl("/#software"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: page.shortName,
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
