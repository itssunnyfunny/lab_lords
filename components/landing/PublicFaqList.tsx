import { publicStrings } from "@/lib/public-i18n/server";
import Link from "next/link";
import { getPublicFaqs } from "@/lib/publicFaqs";
import { publicFaqAnswer } from "@/lib/public-i18n/content";

export async function PublicFaqList({ ids }: { ids: readonly string[] }) {
  const { t, href: localHref } = await publicStrings();
  return <div className="marketing-faq">{getPublicFaqs(ids).map(item => (
    <details key={item.id}>
      <summary>{t(item.question)}<span aria-hidden="true">+</span></summary>
      <p>{publicFaqAnswer(item, t)} <Link className="underline underline-offset-4" href={localHref(item.href)}>{t(item.link)}</Link>.</p>
    </details>
  ))}</div>;
}
