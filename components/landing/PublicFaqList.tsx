import Link from "next/link";
import { getPublicFaqs } from "@/lib/publicFaqs";

export function PublicFaqList({ ids }: { ids: readonly string[] }) {
  return <div className="marketing-faq">{getPublicFaqs(ids).map(item => (
    <details key={item.id}>
      <summary>{item.question}<span aria-hidden="true">+</span></summary>
      <p>{item.answer} <Link className="underline underline-offset-4" href={item.href}>{item.link}</Link>.</p>
    </details>
  ))}</div>;
}
